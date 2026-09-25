import prisma from '../lib/prisma.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { notificationService } from '../services/notification.service.js';

let isJobRunning = false;

export const processAutoSuspensions = async () => {
  try {
    // Find unblacklisted organizations with >= 3 HIGH or URGENT disputes against them
    const candidateRows = await prisma.$queryRaw<Array<{ againstOrgId: number; cnt: bigint | number }>>`
      SELECT d."againstOrgId", COUNT(d.id) as cnt
      FROM "Dispute" d
      JOIN "Organization" o ON o.id = d."againstOrgId"
      WHERE d."againstOrgId" IS NOT NULL
        AND d.priority IN ('HIGH', 'URGENT')
        AND d.status IN ('RESOLVED', 'ESCALATED', 'CLOSED')
        AND o."isBlacklisted" = false
      GROUP BY d."againstOrgId"
      HAVING COUNT(d.id) >= 3
    `.catch((err) => {
      console.error('[AutoSuspensionJob] Query error:', err);
      return [];
    });

    if (!candidateRows || candidateRows.length === 0) {
      return { suspendedCount: 0 };
    }

    let suspendedCount = 0;

    for (const row of candidateRows) {
      const orgId = Number(row.againstOrgId);
      const disputeCount = Number(row.cnt);

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          organizationName: true,
          isBlacklisted: true,
          district: true,
          users: { select: { id: true, email: true, name: true } }
        }
      });

      if (!org || org.isBlacklisted) continue;

      const reason = `Auto-suspended by system: Organization accumulated ${disputeCount} critical/urgent disputes against them.`;

      await prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: orgId },
          data: {
            isBlacklisted: true,
            blacklistReason: reason,
            blacklistedAt: new Date(),
            suspensionType: 'AUTO_DISPUTE',
            verificationStatus: 'SUSPENDED',
            appealStatus: 'NONE'
          }
        });

        await auditLog({
          actorUserId: 1, // System
          actorRole: 'system',
          action: 'organization.auto_suspended',
          entityType: 'organization',
          entityId: orgId,
          ipAddress: '127.0.0.1',
          metadata: {
            reason,
            disputeCount,
            suspensionType: 'AUTO_DISPUTE'
          }
        });
      });

      // 1. Notify organization members about the suspension and how to appeal
      for (const u of org.users) {
        await notificationService.notifyWithEmail(u.id, {
          title: 'Organization Account Suspended',
          message: `Your organization has been suspended due to ${disputeCount} critical disputes. You may submit an appeal from your dashboard.`,
          type: 'organization_suspended',
          priority: 'urgent',
          redirectUrl: '/dashboard',
          emailSubject: 'CRITICAL: Organization Account Suspended — MSME Portal',
          emailHtml: `
            <p>Dear ${u.name || 'User'},</p>
            <p>Your organization <strong>${org.organizationName}</strong> has been suspended on the MSME Portal due to repeated critical dispute resolutions (${disputeCount} critical disputes recorded).</p>
            <p>Your account now has restricted access. You may submit an official clarification or appeal via your Dashboard.</p>
          `
        }).catch(err => console.warn('[AutoSuspensionOrgNotifyError]', err));
      }

      // 2. Notify Collectorate Admins (role: 'admin' only per user instruction)
      const admins = await prisma.user.findMany({
        where: {
          role: 'admin',
          accountStatus: { not: 'BLOCKED' as any }
        },
        select: { id: true, email: true, name: true }
      });

      for (const admin of admins) {
        await notificationService.notifyWithEmail(admin.id, {
          title: 'Auto-Suspension Triggered',
          message: `${org.organizationName} was auto-suspended by system due to ${disputeCount} critical disputes.`,
          type: 'auto_suspension_triggered',
          priority: 'high',
          redirectUrl: '/admin/organizations?status=SUSPENDED',
          emailSubject: `[System Alert] Auto-Suspension Triggered: ${org.organizationName}`,
          emailHtml: `
            <p>Dear ${admin.name || 'Admin'},</p>
            <p>System automated compliance monitoring has suspended organization <strong>${org.organizationName}</strong> (District: ${org.district || 'Unassigned'}).</p>
            <p><strong>Trigger:</strong> ${disputeCount} critical / urgent disputes resolved against this organization.</p>
            <p>Review the organization details in the Platform Administration Desk.</p>
          `
        }).catch(err => console.warn('[AutoSuspensionAdminNotifyError]', err));
      }

      suspendedCount++;
    }

    return { suspendedCount };
  } catch (error) {
    console.error('[AutoSuspensionJob] Error processing auto-suspension:', error);
    return { suspendedCount: 0 };
  }
};

export const startAutoSuspensionCronJobs = () => {
  if (isJobRunning) return;
  isJobRunning = true;

  console.log('[AutoSuspensionJob] Initializing background auto-suspension jobs...');

  // Run initial check 45 seconds after server boot
  setTimeout(async () => {
    try {
      const result = await processAutoSuspensions();
      console.log('[AutoSuspensionJob] Initial compliance check completed:', result);
    } catch (err) {
      console.error('[AutoSuspensionJob] Initial check error:', err);
    }
  }, 45_000);

  // Periodic compliance check: Runs every 6 hours (21,600,000 ms)
  setInterval(async () => {
    try {
      const result = await processAutoSuspensions();
      if (result.suspendedCount > 0) {
        console.log('[AutoSuspensionJob] Auto-suspension completed:', result);
      }
    } catch (err) {
      console.error('[AutoSuspensionJob] Periodic check error:', err);
    }
  }, 6 * 60 * 60 * 1000);
};
