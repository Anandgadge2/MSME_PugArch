import prisma from '../lib/prisma.js';
import { logger } from '../config/logger.js';

export const CANONICAL_METHOD_PREFIXES = ['RFQ', 'RFP', 'TND', 'LTND', 'RC', 'DP', 'RA', 'PO', 'INV', 'DSP'] as const;
export type CanonicalMethodPrefix = typeof CANONICAL_METHOD_PREFIXES[number];

/**
 * Generates an atomic, collision-proof, year-based canonical sequence number:
 * Format: [PREFIX]-[YEAR]-[5-DIGIT-SEQUENCE]
 * Example: RFQ-2026-00001, TND-2026-00049, PO-2026-00120
 *
 * Uses PostgreSQL atomic INSERT ... ON CONFLICT DO UPDATE RETURNING to guarantee
 * zero race conditions under concurrent multi-user load without table locks.
 */
export async function getNextCanonicalSequence(
  prefix: CanonicalMethodPrefix | string,
  yearOverride?: number
): Promise<string> {
  const pfx = String(prefix || 'RFQ').trim().toUpperCase();
  const year = yearOverride && yearOverride > 2000 ? yearOverride : new Date().getFullYear();
  const sequenceId = `${pfx}-${year}`;

  try {
    const result = await prisma.$queryRawUnsafe<Array<{ lastVal: number }>>(
      `
      INSERT INTO "EntitySequence" ("id", "prefix", "year", "lastVal", "updatedAt")
      VALUES ($1, $2, $3, 1, NOW())
      ON CONFLICT ("id")
      DO UPDATE SET "lastVal" = "EntitySequence"."lastVal" + 1, "updatedAt" = NOW()
      RETURNING "lastVal";
      `,
      sequenceId,
      pfx,
      year
    );

    const nextVal = result?.[0]?.lastVal || 1;
    const formattedSeq = String(nextVal).padStart(5, '0');
    return `${pfx}-${year}-${formattedSeq}`;
  } catch (err: any) {
    logger.warn({ err: err?.message, sequenceId }, '[SequenceService] Falling back to Prisma transaction sequence increment');
    // Transactional fallback in case raw SQL table isn't migrated yet
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.entitySequence.findUnique({ where: { id: sequenceId } });
      if (!existing) {
        return tx.entitySequence.create({
          data: {
            id: sequenceId,
            prefix: pfx,
            year,
            lastVal: 1,
          },
        });
      }
      return tx.entitySequence.update({
        where: { id: sequenceId },
        data: {
          lastVal: { increment: 1 },
        },
      });
    });

    const formattedSeq = String(record.lastVal).padStart(5, '0');
    return `${pfx}-${year}-${formattedSeq}`;
  }
}
