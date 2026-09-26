import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ApiError } from '../utils/ApiError.js';
import { notificationService, escapeHtml } from '../services/notification.service.js';
import { buildGovernmentGradeEmailHtml, ensurePublicUrl } from '../services/email-template.builder.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { logger } from '../config/logger.js';
import { getPublicPortalUrl } from '../config/env.js';

const router = Router();
const db = prisma as any;

const wrap = (handler: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

const adminOnly = [authenticate, authorize('admin', 'master_admin')] as const;

// 1. Live Recipient Count Endpoint
router.get('/admin/notices/recipient-counts', ...adminOnly, wrap(async (_req, res) => {
  const [allCount, sellerCount, shgCount, buyerCount] = await Promise.all([
    db.user.count({
      where: {
        accountStatus: { not: 'BLOCKED' as any }
      }
    }),
    db.user.count({
      where: {
        role: 'seller' as any,
        accountStatus: { not: 'BLOCKED' as any }
      }
    }),
    db.user.count({
      where: {
        role: 'shg' as any,
        accountStatus: { not: 'BLOCKED' as any }
      }
    }),
    db.user.count({
      where: {
        role: { in: ['buyer', 'dept_admin'] as any },
        accountStatus: { not: 'BLOCKED' as any }
      }
    })
  ]);

  return res.json({
    success: true,
    data: {
      all: allCount,
      sellers: sellerCount,
      shg: shgCount,
      buyers: buyerCount
    }
  });
}));

const broadcastSchema = z.object({
  targetAudience: z.enum(['ALL_USERS', 'SELLERS_ONLY', 'SHG_ONLY', 'BUYERS_ONLY']),
  channels: z.array(z.enum(['in_app', 'email', 'sms'])).min(1, 'Select at least one delivery channel'),
  title: z.string().trim().min(3, 'Notice title must be at least 3 characters').max(180),
  message: z.string().trim().min(5, 'Notice message must be at least 5 characters').max(4000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  referenceNumber: z.string().trim().max(100).optional(),
  actionUrl: z.string().trim().max(500).optional(),
  showModalPopup: z.boolean().default(true)
});

// 2. Broadcast Notice Endpoint
router.post('/admin/notices/broadcast', ...adminOnly, wrap(async (req, res) => {
  const body = broadcastSchema.parse(req.body);

  let roleFilter: string[] = [];
  let audienceLabel = 'All Registered Users';

  switch (body.targetAudience) {
    case 'SELLERS_ONLY':
      roleFilter = ['seller'];
      audienceLabel = 'Registered Sellers & Suppliers';
      break;
    case 'SHG_ONLY':
      roleFilter = ['shg'];
      audienceLabel = 'Self-Help Groups (SHG)';
      break;
    case 'BUYERS_ONLY':
      roleFilter = ['buyer', 'dept_admin'];
      audienceLabel = 'Procurement Buyers & Departments';
      break;
    case 'ALL_USERS':
    default:
      roleFilter = ['seller', 'shg', 'buyer', 'dept_admin', 'admin', 'master_admin'];
      audienceLabel = 'All Portal Users';
      break;
  }

  // Fetch real target users from database
  const targetUsers = await db.user.findMany({
    where: {
      role: { in: roleFilter as any },
      accountStatus: { not: 'BLOCKED' as any }
    },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true
    }
  });

  if (targetUsers.length === 0) {
    return res.json({
      success: true,
      data: {
        recipientCount: 0,
        message: 'No eligible active recipients found for the selected audience.'
      }
    });
  }

  const generatedRef = body.referenceNumber || `JSGSMILE/CIRCULAR/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
  const portalUrl = getPublicPortalUrl();
  const directActionUrl = body.actionUrl ? ensurePublicUrl(body.actionUrl) : portalUrl;

  const badgeVariant =
    body.priority === 'urgent'
      ? 'danger'
      : body.priority === 'high'
      ? 'warning'
      : body.priority === 'low'
      ? 'info'
      : 'primary';

  // Government-grade HTML email template
  const emailHtml = buildGovernmentGradeEmailHtml({
    portalName: 'JSG SMILE Procurement Portal',
    departmentName: 'Government of Odisha • District Administration Jharsuguda',
    noticeType: 'OFFICIAL ADMINISTRATIVE NOTICE',
    noticeRef: generatedRef,
    badgeVariant,
    heading: body.title,
    summary: `Official Circular addressed to: ${audienceLabel}`,
    detailsTable: [
      {
        label: 'Notice Ref',
        value: generatedRef,
        isHighlight: true
      },
      {
        label: 'Target Audience',
        value: audienceLabel,
        isHighlight: true
      },
      {
        label: 'Priority Level',
        value: body.priority.toUpperCase(),
        color: body.priority === 'urgent' ? '#b91c1c' : body.priority === 'high' ? '#b45309' : '#1e3a8a',
        isHighlight: true
      },
      {
        label: 'Issued Date',
        value: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    ],
    bodyHtml: `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px; margin: 20px 0;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #0f172a; font-weight: 700;">Notice Directive:</h3>
        <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(body.message)}</p>
      </div>
    `,
    actionButton: {
      label: body.actionUrl ? 'Open Details in Portal' : 'Access JSG SMILE Portal',
      url: directActionUrl
    },
    securityAdvisory: 'Official Administrative Circular: This is a verified electronic communication issued by the JSG SMILE Portal Administration. Please log in to your account dashboard to view and acknowledge full notice details.'
  });

  const notifyOpts = {
    title: `[CIRCULAR] ${body.title}`,
    message: body.message,
    type: 'OFFICIAL_NOTICE_CIRCULAR',
    priority: body.priority,
    redirectUrl: body.actionUrl || ''
  };

  // Dispatch across selected channels concurrently
  let inAppDispatched = 0;
  let emailDispatched = 0;
  let smsDispatched = 0;

  const dispatchPromises: Promise<any>[] = [];

  for (const user of targetUsers) {
    if (body.channels.includes('in_app')) {
      dispatchPromises.push(
        notificationService.notifyNow(user.id, notifyOpts).then(res => {
          if (res) inAppDispatched++;
        }).catch(err => {
          logger.warn({ err, userId: user.id }, 'In-app notice dispatch failed');
        })
      );
    }

    if (body.channels.includes('email') && user.email) {
      dispatchPromises.push(
        notificationService.sendEmail(user.id, {
          subject: `[CIRCULAR ${generatedRef}] ${body.title} - JSG SMILE Portal`,
          html: emailHtml
        }).then(res => {
          if (res) emailDispatched++;
        }).catch(err => {
          logger.warn({ err, userId: user.id }, 'Email notice dispatch failed');
        })
      );
    }

    if (body.channels.includes('sms') && user.mobile) {
      dispatchPromises.push(
        notificationService.sendSmsNotificationForUser(user.id, {
          message: `JSG SMILE NOTICE: ${body.title}. Ref: ${generatedRef}. Check portal for details.`
        }).then(res => {
          if (res) smsDispatched++;
        }).catch(err => {
          logger.warn({ err, userId: user.id }, 'SMS notice dispatch failed');
        })
      );
    }
  }

  await Promise.allSettled(dispatchPromises);

  // Audit Log
  auditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    action: 'ADMIN_NOTICE_BROADCAST',
    entityType: 'NOTICE_CIRCULAR',
    metadata: {
      targetAudience: body.targetAudience,
      audienceLabel,
      channels: body.channels,
      referenceNumber: generatedRef,
      priority: body.priority,
      title: body.title,
      totalRecipients: targetUsers.length,
      inAppDispatched,
      emailDispatched,
      smsDispatched
    }
  });

  return res.json({
    success: true,
    data: {
      referenceNumber: generatedRef,
      targetAudience: body.targetAudience,
      audienceLabel,
      recipientCount: targetUsers.length,
      dispatched: {
        inApp: inAppDispatched,
        email: emailDispatched,
        sms: smsDispatched
      }
    },
    message: `Notice circular successfully broadcasted to ${targetUsers.length} recipients.`
  });
}));

// 3. User Active Notice Pop-up Endpoint (fetches unread circular for logged-in user)
router.get('/notices/active-popup', authenticate, wrap(async (req, res) => {
  const currentUserId = req.user?.id;
  if (!currentUserId) throw new ApiError(401, 'Unauthorized');

  const notice = await db.notification.findFirst({
    where: {
      userId: currentUserId,
      type: 'OFFICIAL_NOTICE_CIRCULAR',
      isRead: false,
      isArchived: false
    },
    orderBy: { createdAt: 'desc' }
  });

  return res.json({
    success: true,
    data: notice || null
  });
}));

// 4. Acknowledge / Dismiss Notice Pop-up Endpoint
router.post('/notices/:id/acknowledge', authenticate, wrap(async (req, res) => {
  const currentUserId = req.user?.id;
  if (!currentUserId) throw new ApiError(401, 'Unauthorized');

  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    throw new ApiError(400, 'Invalid notice notification ID');
  }

  await db.notification.updateMany({
    where: {
      id,
      userId: currentUserId
    },
    data: {
      isRead: true
    }
  });

  return res.json({
    success: true,
    message: 'Notice acknowledged and dismissed'
  });
}));

export default router;
