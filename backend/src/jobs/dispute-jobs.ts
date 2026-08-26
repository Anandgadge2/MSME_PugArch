/**
 * Dispute Module Background Jobs.
 *
 * Runs scheduled interval jobs for:
 * 1. 5-Day Auto-Escalation for Disputes awaiting clarification
 */

import prisma from '../lib/prisma.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { notificationService } from '../services/notification.service.js';

let isJobsRunning = false;

export const processDisputeAutoEscalation = async () => {
  try {
    const disputesToEscalate = await prisma.$queryRaw<Array<{ id: number; disputeNo: string | null }>>`
      SELECT id, "disputeNo"
      FROM "Dispute"
      WHERE status = 'CLARIFICATION_REQUESTED'
        AND "responseDueAt" IS NOT NULL
        AND "responseDueAt" < NOW()
    `.catch(() => []);

    if (!disputesToEscalate || disputesToEscalate.length === 0) return { escalatedCount: 0 };

    let escalatedCount = 0;

    for (const dispute of disputesToEscalate) {
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`
          UPDATE "Dispute"
          SET status = 'ESCALATED', "statusEnum" = 'ESCALATED', "escalatedAt" = NOW()
          WHERE id = ${dispute.id} AND status = 'CLARIFICATION_REQUESTED'
        `;

        await auditLog({
          actorUserId: 1, // System
          actorRole: 'system',
          action: 'dispute.auto_escalated',
          entityType: 'dispute',
          entityId: dispute.id,
          ipAddress: '127.0.0.1',
          metadata: { reason: '5-day response deadline exceeded' }
        });

        await notificationService.notifyAdmins({
          title: 'Dispute Auto-Escalated',
          message: `${dispute.disputeNo || `DSP-${dispute.id}`} was auto-escalated due to missed deadline.`,
          type: 'dispute_escalated',
          priority: 'high',
          redirectUrl: '/admin/disputes'
        });

        escalatedCount++;
      });
    }

    return { escalatedCount };
  } catch (error) {
    console.error('[DisputeJobs] Error processing auto-escalation:', error);
    return { escalatedCount: 0 };
  }
};

export const startDisputeCronJobs = () => {
  if (isJobsRunning) return;
  isJobsRunning = true;

  console.log('[DisputeJobs] Initializing background dispute cron jobs...');

  // Check 30 seconds after startup
  setTimeout(async () => {
    try {
      const result = await processDisputeAutoEscalation();
      console.log('[DisputeJobs] Initial auto-escalation check completed:', result);
    } catch (err) {
      console.error('[DisputeJobs] Initial check error:', err);
    }
  }, 30_000);

  // Auto-Escalation Monitoring: Runs every 1 hour (3,600,000 ms)
  setInterval(async () => {
    try {
      const result = await processDisputeAutoEscalation();
      if (result.escalatedCount > 0) {
        console.log('[DisputeJobs] Auto-escalation check updated:', result);
      }
    } catch (err) {
      console.error('[DisputeJobs] Auto-escalation check error:', err);
    }
  }, 60 * 60 * 1000);
};
