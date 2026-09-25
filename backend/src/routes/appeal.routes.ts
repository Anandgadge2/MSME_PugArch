import { Router, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  authorizeAdmin,
  canAccessOrganization,
  createAuditLog,
  normalizeDistrictList
} from '../middleware/authorize.js';
import { notificationService } from '../services/notification.service.js';
import type { AuthRequest } from '../middleware/authenticate.js';

const router = Router();
const wrap = (fn: (req: AuthRequest, res: Response, next: any) => Promise<unknown>) =>
  (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Appeals Listing (Admin + Master Admin) ─────────────────
// GET /admin/organizations/appeals
router.get(
  '/admin/organizations/appeals',
  authenticate,
  authorizeAdmin,
  wrap(async (req: AuthRequest, res: Response) => {
    const statusFilter = (req.query.status as string) || 'PENDING';

    const where: any = { isBlacklisted: true };
    if (statusFilter !== 'all') {
      where.appealStatus = statusFilter;
    } else {
      where.appealStatus = { in: ['PENDING', 'REJECTED'] };
    }

    // District-scoped filtering for admin role (Collectorate admin)
    if (req.user?.role === 'admin') {
      const districtAssignments = await prisma.userRole.findMany({
        where: {
          userId: req.user.id,
          isActive: true,
          scopeType: 'DISTRICT',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        select: { scopeId: true }
      });
      const districts = normalizeDistrictList(districtAssignments.map(d => d.scopeId));

      if (districts.length > 0) {
        where.district = { in: districts };
      }
    }

    const appeals = await prisma.organization.findMany({
      where,
      select: {
        id: true,
        organizationName: true,
        gstin: true,
        panNumber: true,
        organizationType: true,
        district: true,
        state: true,
        verificationStatus: true,
        isBlacklisted: true,
        blacklistReason: true,
        blacklistedAt: true,
        suspensionType: true,
        appealStatus: true,
        appealMessage: true,
        appealDocumentUrl: true,
        appealSubmittedAt: true,
        appealCount: true,
        appealReviewedAt: true,
        appealRejectionReason: true,
        appealReviewedByUserId: true,
        _count: {
          select: {
            users: true,
            disputesAgainst: true
          }
        },
        users: {
          take: 3,
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true
          }
        }
      },
      orderBy: [
        { appealStatus: 'asc' },     // PENDING first
        { appealSubmittedAt: 'asc' }  // Oldest appeals first
      ]
    });

    res.json({ success: true, data: appeals });
  })
);

// ── Resolve Appeal (Admin + Master Admin) ──────────────────
// POST /admin/organizations/:id/appeal/resolve
router.post(
  '/admin/organizations/:id/appeal/resolve',
  authenticate,
  authorizeAdmin,
  wrap(async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Valid organization ID required.' });
    }

    const schema = z.object({
      verdict: z.enum(['APPROVED', 'REJECTED']),
      adminRemarks: z.string().trim().min(5, 'Remarks must be at least 5 characters').max(1000)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues.map(i => i.message).join(', ')
      });
    }
    const { verdict, adminRemarks } = parsed.data;

    // District scope check for admin
    if (req.user?.role === 'admin') {
      const canAccess = await canAccessOrganization(req, id);
      if (!canAccess) {
        return res.status(403).json({
          error: 'DISTRICT_ACCESS_DENIED',
          message: 'You can only manage organizations within your assigned district.'
        });
      }
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        organizationName: true,
        isBlacklisted: true,
        appealStatus: true,
        users: { select: { id: true, email: true, name: true } }
      }
    });

    if (!org || org.appealStatus !== 'PENDING') {
      return res.status(404).json({
        error: 'APPEAL_NOT_FOUND',
        message: 'No pending appeal found for this organization.'
      });
    }

    // Atomic update guarded by appealStatus: 'PENDING' to prevent double-click race conditions
    const updateResult = await prisma.organization.updateMany({
      where: { id, appealStatus: 'PENDING' },
      data: verdict === 'APPROVED' ? {
        isBlacklisted: false,
        blacklistReason: null,
        blacklistedAt: null,
        blacklistedByUserId: null,
        suspensionType: null,
        verificationStatus: 'VERIFIED',
        appealStatus: 'APPROVED',
        appealReviewedAt: new Date(),
        appealReviewedByUserId: req.user?.id,
        appealRejectionReason: null
      } : {
        appealStatus: 'REJECTED',
        appealReviewedAt: new Date(),
        appealReviewedByUserId: req.user?.id,
        appealRejectionReason: adminRemarks
      }
    });

    if (updateResult.count === 0) {
      return res.status(404).json({
        error: 'APPEAL_NOT_FOUND',
        message: 'No pending appeal found for this organization.'
      });
    }

    // Notify all organization members
    for (const member of org.users) {
      await notificationService.notifyWithEmail(member.id, {
        title: `Suspension Appeal ${verdict === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: verdict === 'APPROVED'
          ? 'Your organization suspension appeal has been approved and portal access has been fully restored.'
          : `Your suspension appeal was reviewed and rejected. Remarks: ${adminRemarks}`,
        type: 'appeal_resolved',
        priority: verdict === 'APPROVED' ? 'high' : 'urgent',
        redirectUrl: '/dashboard',
        emailSubject: `Suspension Appeal ${verdict === 'APPROVED' ? 'Approved' : 'Rejected'} — MSME Portal`,
        emailHtml: `
          <p>Dear ${member.name || 'User'},</p>
          <p>Your organization's appeal regarding platform suspension has been <strong>${verdict}</strong> by administration.</p>
          ${verdict === 'APPROVED'
            ? '<p style="color: #166534; font-weight: bold;">Your organization is now reinstated with active status.</p>'
            : `<p style="color: #991b1b;"><strong>Admin Remarks:</strong> ${adminRemarks}</p>`}
        `
      }).catch(err => console.warn('[AppealNotifyError]', err));
    }

    await createAuditLog(req, {
      action: `organization.appeal_${verdict.toLowerCase()}`,
      entityType: 'organization',
      entityId: id,
      metadata: {
        verdict,
        adminRemarks,
        resolvedByRole: req.user?.role,
        resolvedByUserId: req.user?.id,
        orgName: org.organizationName
      }
    });

    res.json({
      success: true,
      message: `Appeal ${verdict.toLowerCase()} successfully.`
    });
  })
);

export default router;
