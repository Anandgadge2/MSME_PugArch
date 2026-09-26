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
          gstin: true,
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
          emailSubject: `[ACTION REQUIRED] Organization Account Suspended — ${org.organizationName}`,
          emailHtml: `
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              This is an official statutory notice that compliance monitoring has suspended access privileges for <strong>${org.organizationName}</strong> on the JSG SMILE Procurement Portal.
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 6px; padding: 14px 18px; margin: 18px 0;">
              <strong style="color: #991b1b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">
                Compliance Suspension Particulars
              </strong>
              <table style="width: 100%; font-size: 13px; color: #334155; line-height: 1.8;">
                <tr>
                  <td style="width: 40%; font-weight: 600; color: #64748b;">Organization Name:</td>
                  <td><strong>${org.organizationName}</strong></td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #64748b;">GSTIN / Identifier:</td>
                  <td>${org.gstin || 'Not Provided'}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #64748b;">Statutory Trigger:</td>
                  <td style="color: #dc2626; font-weight: 700;">${disputeCount} Critical / Unresolved Disputes</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #64748b;">Account Status:</td>
                  <td style="color: #dc2626; font-weight: 800;">SUSPENDED (RESTRICTED ACCESS)</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
              Under district portal governance regulations, all active bidding, quotations, and contract creation have been paused. You are entitled to submit a formal appeal and clarification directly via your Portal Dashboard.
            </p>
          `
        }).catch(err => console.warn('[AutoSuspensionOrgNotifyError]', err));
      }

      // 2. Notify Collectorate Admins (role: 'admin' only per user instruction, scoped to district)
      const admins = await prisma.user.findMany({
        where: {
          role: 'admin',
          accountStatus: { not: 'BLOCKED' as any }
        },
        select: { id: true, email: true, name: true, assignedUserRoles: true }
      });

      const { matchesDistrictScope } = await import('../middleware/authorize.js');
      const targetAdmins = org.district
        ? admins.filter(a => {
            if (!a.assignedUserRoles || a.assignedUserRoles.length === 0) return true;
            return a.assignedUserRoles.some((r: any) => !r.scopeId || matchesDistrictScope(r.scopeId, org.district));
          })
        : admins;

      for (const admin of (targetAdmins.length > 0 ? targetAdmins : admins)) {
        await notificationService.notifyWithEmail(admin.id, {
          title: 'Auto-Suspension Triggered',
          message: `${org.organizationName} was auto-suspended by system due to ${disputeCount} critical disputes.`,
          type: 'auto_suspension_triggered',
          priority: 'high',
          redirectUrl: '/admin/organizations?status=SUSPENDED',
          emailSubject: `[System Compliance Alert] Auto-Suspension Triggered: ${org.organizationName}`,
          emailHtml: `
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              Automated compliance surveillance has flagged and suspended an organization profile within your administrative jurisdiction.
            </p>
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 6px; padding: 14px 18px; margin: 18px 0;">
              <table style="width: 100%; font-size: 13px; color: #334155; line-height: 1.8;">
                <tr>
                  <td style="width: 40%; font-weight: 600; color: #64748b;">Suspended Entity:</td>
                  <td><strong>${org.organizationName}</strong></td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #64748b;">District Jurisdiction:</td>
                  <td>${org.district || 'Unassigned / District Wide'}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #64748b;">Dispute Threshold:</td>
                  <td style="color: #b45309; font-weight: 700;">${disputeCount} Critical / Urgent Disputes</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #64748b;">Recommended Action:</td>
                  <td>Review organization dossier in the Collectorate Administration Desk.</td>
                </tr>
              </table>
            </div>
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
