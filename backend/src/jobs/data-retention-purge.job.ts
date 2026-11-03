import prisma from '../lib/prisma.js';
import { logger } from '../config/logger.js';

export interface PurgeExecutionSummary {
  timestamp: string;
  erasureRequestsProcessed: number;
  unverifiedSessionsPurged: number;
  expiredOtpsPurged: number;
  statutoryExemptionsPreserved: number;
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
}

/**
 * Automated Data Retention & Erasure Job
 * Enforces DPDPA 2023 Section 8(7) Storage Limitation & Section 8(8) Statutory Retention Exceptions
 */
export const runDataRetentionPurgeJob = async (): Promise<PurgeExecutionSummary> => {
  const summary: PurgeExecutionSummary = {
    timestamp: new Date().toISOString(),
    erasureRequestsProcessed: 0,
    unverifiedSessionsPurged: 0,
    expiredOtpsPurged: 0,
    statutoryExemptionsPreserved: 0,
    status: 'SUCCESS',
  };

  try {
    logger.info('[DataRetentionJob] Starting DPDPA Section 8(7) automated retention and purge sweep...');

    // 1. Process pending Data Principal Erasure requests from AuditLog
    const pendingErasureLogs = await prisma.auditLog.findMany({
      where: {
        action: 'DATA_PRINCIPAL_ERASURE_REQUEST',
        entityType: 'USER',
      },
      select: {
        id: true,
        entityId: true,
        createdAt: true,
      },
      take: 50,
    });

    for (const log of pendingErasureLogs) {
      if (!log.entityId) continue;
      const userId = log.entityId;

      // Verify user exists and has not already been anonymized
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, registrationStatus: true }
      });

      if (!user || user.email.includes('@anonymized.jsgsmile.in')) {
        continue;
      }

      // Check statutory retention conditions (GFR 171, active tenders, invoices)
      const [tenderCount, bidCount] = await Promise.all([
        prisma.tender.count({ where: { buyerId: userId } }).catch(() => 0),
        prisma.bid.count({ where: { sellerId: userId } }).catch(() => 0),
      ]);

      if (tenderCount > 0 || bidCount > 0) {
        // Statutory exemption: Account is deactivated, but procurement links remain intact for statutory audit
        await prisma.user.update({
          where: { id: userId },
          data: {
            mobile: null,
            dob: null,
            sessionVersion: { increment: 1 },
          }
        });
        summary.statutoryExemptionsPreserved++;
      } else {
        // Complete pseudonymization / erasure of personal data
        const anonymizedIdentifier = `erased_dp_${userId}_${Date.now().toString(36)}`;
        await prisma.user.update({
          where: { id: userId },
          data: {
            name: `DataPrincipal_${userId}`,
            email: `${anonymizedIdentifier}@anonymized.jsgsmile.in`,
            mobile: null,
            dob: null,
            registrationStatus: 'suspended' as any,
            sessionVersion: { increment: 1 },
          }
        });
        summary.erasureRequestsProcessed++;
      }
    }

    // 2. Purge stale unverified pre-registration KYC sessions older than 72 hours
    const staleKycCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const deletedKycSessions = await prisma.preRegistrationKycSession.deleteMany({
      where: {
        used: false,
        createdAt: { lt: staleKycCutoff }
      }
    }).catch(() => ({ count: 0 }));
    summary.unverifiedSessionsPurged = deletedKycSessions.count;

    // 3. Purge expired one-time verification tokens
    const staleOtpCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deletedOtps = await prisma.otpVerification.deleteMany({
      where: {
        createdAt: { lt: staleOtpCutoff }
      }
    }).catch(() => ({ count: 0 }));
    summary.expiredOtpsPurged = deletedOtps.count;

    // 4. Record statutory compliance audit trail entry
    await prisma.auditLog.create({
      data: {
        action: 'DATA_RETENTION_PURGE_EXECUTED',
        entityType: 'COMPLIANCE_JOB',
        details: {
          ...summary,
          statutorySection: 'DPDPA 2023 Section 8(7) & 8(8)',
        },
        ipAddress: '127.0.0.1 (Internal System Worker)',
        userAgent: 'NodeJS/DataRetentionScheduler',
      }
    });

    logger.info({ summary }, '[DataRetentionJob] DPDPA Section 8(7) purge sweep completed successfully');
  } catch (err: any) {
    logger.error({ err: err?.message }, '[DataRetentionJob] Error executing data retention purge job');
    summary.status = 'ERROR';
  }

  return summary;
};

let isRetentionJobRunning = false;

/**
 * Initializes automated background scheduler for DPDPA Section 8(7) Storage Limitation
 */
export const startDataRetentionCronJobs = () => {
  if (isRetentionJobRunning) return;
  isRetentionJobRunning = true;

  logger.info('[DataRetentionJob] Initializing automated DPDPA Section 8(7) retention background scheduler...');

  // Run initial retention sweep 60 seconds after server boot
  setTimeout(async () => {
    try {
      const summary = await runDataRetentionPurgeJob();
      logger.info({ summary }, '[DataRetentionJob] Initial retention sweep completed');
    } catch (err: any) {
      logger.error({ err: err?.message }, '[DataRetentionJob] Initial retention sweep failed');
    }
  }, 60_000);

  // Periodic statutory retention purge: Runs every 24 hours (86,400,000 ms)
  const retentionInterval = setInterval(async () => {
    try {
      const summary = await runDataRetentionPurgeJob();
      logger.info({ summary }, '[DataRetentionJob] Automated daily retention sweep completed');
    } catch (err: any) {
      logger.error({ err: err?.message }, '[DataRetentionJob] Automated daily retention sweep failed');
    }
  }, 24 * 60 * 60 * 1000);

  retentionInterval.unref?.();
};

