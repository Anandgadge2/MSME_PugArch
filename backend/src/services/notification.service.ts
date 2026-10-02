import prisma from '../lib/prisma.js';
import { publishNotificationEvent } from './realtime.service.js';
import { getTransporter, getTransporterForCompany, compileEmailTemplate } from './mail.service.js';
import { env, getPublicPortalUrl } from '../config/env.js';
import { logger } from '../config/logger.js';
import { smsService, type SmsPurpose } from './sms.service.js';
import { buildGovernmentGradeEmailHtml, ensurePublicUrl, formatIstDateTime, type TableRow } from './email-template.builder.js';

const db = prisma as any;

export interface NotifyOpts {
  title: string;
  message: string;
  type: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  redirectUrl?: string;
  emailSubject?: string;
  emailHtml?: string;
  detailsTable?: TableRow[];
  noticeRef?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  stepInstructions?: {
    title?: string;
    steps: string[];
  };
}

export const resolveSellerOrgName = async (sellerId?: number | string | null): Promise<string> => {
  if (!sellerId) return 'Seller';
  try {
    const numId = Number(sellerId);
    if (!numId || isNaN(numId)) return 'Seller';
    const seller = await db.user.findUnique({
      where: { id: numId },
      select: {
        name: true,
        companyName: true,
        organization: { select: { organizationName: true } },
        sellerProfile: { select: { businessName: true, companyName: true } }
      }
    });
    if (!seller) return 'Seller';
    const name = (
      seller.organization?.organizationName ||
      seller.sellerProfile?.businessName ||
      seller.sellerProfile?.companyName ||
      seller.companyName ||
      seller.name ||
      'Seller'
    ).trim();
    return name || 'Seller';
  } catch {
    return 'Seller';
  }
};

interface EmailOpts {
  subject: string;
  html: string;
  templateSlug?: string;
  variables?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
}

interface SmsOpts {
  message: string;
  templateId?: string;
  purpose?: SmsPurpose;
}

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildNotificationEmailHtml = (opts: {
  title: string;
  message: string;
  type?: string;
  priority?: string;
  redirectUrl?: string;
  detailsTable?: TableRow[];
  noticeRef?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  stepInstructions?: {
    title?: string;
    steps: string[];
  };
}) => {
  const priority = escapeHtml(opts.priority || 'medium');
  const type = (opts.type || 'PORTAL NOTIFICATION').replace(/_/g, ' ');
  const portalUrl = getPublicPortalUrl();
  const actionUrl = opts.redirectUrl ? ensurePublicUrl(opts.redirectUrl) : portalUrl;

  const badgeVariant = opts.badgeVariant || (opts.priority === 'urgent'
    ? 'danger'
    : opts.priority === 'high'
    ? 'warning'
    : opts.priority === 'low'
    ? 'info'
    : 'primary');

  const noticeRef = opts.noticeRef || `JSG-NOTIF/${Date.now().toString().slice(-6)}`;

  return buildGovernmentGradeEmailHtml({
    portalName: 'JSG SMILE Procurement Portal',
    departmentName: 'Government of Odisha • District Administration Jharsuguda',
    noticeType: type,
    noticeRef,
    badgeVariant,
    heading: opts.title,
    summary: opts.message,
    detailsTable: opts.detailsTable && opts.detailsTable.length > 0 ? opts.detailsTable : [
      {
        label: 'Event Type',
        value: type.toUpperCase(),
        isHighlight: true
      },
      {
        label: 'Official Portal Gateway',
        value: `<a href="${portalUrl}" style="color: #1e40af; text-decoration: underline; font-weight: 700;">${portalUrl}</a>`
      }
    ],
    stepInstructions: opts.stepInstructions,
    helpdeskEmail: 'jsgsmileportal@gmail.com',
    actionButton: {
      label: opts.redirectUrl ? 'Open Details in Portal' : 'Access JSG SMILE Portal',
      url: actionUrl
    },
    securityAdvisory: 'Official Administrative Advisory: This is a verified electronic communication from the JSG SMILE Procurement Portal. Ensure you are signed in through official security protocols when viewing active tenders or submissions.'
  });
};

export const notificationService = {
  /** Create in-app notification + publish via Redis */
  async notify(userId: number, opts: NotifyOpts) {
    void this.notifyNow(userId, opts);
    return null;
  },

  async notifyUser(userId: number, opts: NotifyOpts, channels?: Array<'in_app' | 'email' | 'sms'>) {
    const selected = channels?.length ? channels : ['in_app', 'email', 'sms'];
    if (selected.includes('in_app')) await this.notifyNow(userId, opts);
    if (selected.includes('email')) {
      await this.sendEmail(userId, {
        subject: opts.emailSubject || `${opts.title} - MSME Procurement Portal`,
        html: opts.emailHtml || buildNotificationEmailHtml(opts)
      });
    }
    if (selected.includes('sms')) {
      await this.sendSmsNotificationForUser(userId, {
        message: `${opts.title}: ${opts.message}`,
        purpose: opts.type?.includes('tender') || opts.type?.includes('procurement') ? 'tender_alert' : 'notification'
      });
    }
  },

  async notifyNow(userId: number, opts: NotifyOpts) {
    try {
      const notification = await db.notification.create({
        data: {
          userId,
          title: opts.title,
          message: opts.message,
          type: opts.type,
          priority: opts.priority || 'medium',
          redirectUrl: opts.redirectUrl
        }
      });
      await publishNotificationEvent(userId, notification);
      return notification;
    } catch (error) {
      logger.warn({ error, userId, type: opts.type }, 'Failed to create notification');
      return null;
    }
  },

  /** Notify all admin users */
  async notifyAdmins(opts: NotifyOpts) {
    try {
      const admins = await db.user.findMany({
        where: { role: { in: ['admin', 'master_admin'] as any } },
        select: { id: true }
      });
      await Promise.allSettled(
        admins.map((admin: { id: number }) => this.notifyUser(admin.id, opts, ['in_app', 'sms']))
      );
    } catch (error) {
      logger.warn({ error, type: opts.type }, 'Failed to notify admins');
    }
  },

  /** Notify sellers & SHG users about a published public, invited, or category-matched procurement opportunity */
  async notifySellersAndShgsOfProcurement(procurement: {
    id: number | string;
    title: string;
    bidNumber?: string;
    requirementNumber?: string;
    procurementType?: string;
    canonicalMethod?: string;
    buyerOrganizationName?: string;
    estimatedValue?: number | null;
    endDate?: Date | string | null;
    visibility?: string;
    sourcingStrategy?: string;
    category?: string;
    categoryId?: number;
    invitedSellerOrgIds?: number[];
    invitedUserIds?: number[];
  }) {
    try {
      const canonicalMethod = String(procurement.canonicalMethod || procurement.procurementType || '').toUpperCase().replace(/[- ]+/g, '_');
      const sourcingStrategy = String(procurement.sourcingStrategy || '').trim().toUpperCase();
      const isLimitedMethod = canonicalMethod === 'LIMITED_TENDER' || canonicalMethod.includes('LIMITED');
      const isSelectedStrategy = ['SELECTED', 'SELECT', 'LIMITED', 'INVITED'].includes(sourcingStrategy);
      const isPrivateVisibility = procurement.visibility === 'PRIVATE' || procurement.visibility === 'LIMITED' || procurement.visibility === 'INVITED_SELLERS_ONLY';
      const isInvitedSelectedPool = isLimitedMethod || isSelectedStrategy || isPrivateVisibility;

      let targetUsers: Array<{ id: number; email?: string | null; role?: string }> = [];
      let isInvitation = false;
      let isCategoryMatched = false;

      if (isInvitedSelectedPool) {
        isInvitation = true;
        let invitedOrgIds = Array.isArray(procurement.invitedSellerOrgIds) ? [...procurement.invitedSellerOrgIds] : [];
        let invitedUserIds = Array.isArray(procurement.invitedUserIds) ? [...procurement.invitedUserIds] : [];

        // If no invited IDs passed in options, look up relational invitations or technicalPacket from the bid
        if (!invitedOrgIds.length && !invitedUserIds.length && procurement.id) {
          const numId = Number(procurement.id);
          if (Number.isFinite(numId) && numId > 0) {
            const [relationalInvs, bidRow] = await Promise.all([
              db.procurementBidInvitation.findMany({
                where: { bidId: numId },
                select: { sellerOrgId: true, sellerUserId: true }
              }).catch(() => []),
              db.procurementBid.findUnique({
                where: { id: numId },
                select: { technicalPacket: true }
              }).catch(() => null)
            ]);
            for (const r of relationalInvs) {
              if (r.sellerOrgId) invitedOrgIds.push(r.sellerOrgId);
              if (r.sellerUserId) invitedUserIds.push(r.sellerUserId);
            }

            if (!invitedOrgIds.length && !invitedUserIds.length && bidRow?.technicalPacket) {
              const tp: any = bidRow.technicalPacket;
              const rawList = Array.isArray(tp?.vendors?.invitedSellers)
                ? tp.vendors.invitedSellers
                : (Array.isArray(tp?.qualifiedVendors) ? tp.qualifiedVendors : []);
              for (const entry of rawList) {
                const rawVal = (entry && typeof entry === 'object')
                  ? (entry.sellerOrgId ?? entry.supplierId ?? entry.organizationId ?? entry.sellerUserId ?? entry.userId ?? entry.id)
                  : entry;
                const n = Number(rawVal);
                if (Number.isFinite(n) && n > 0) invitedOrgIds.push(n);
              }
            }
          }
        }

        invitedOrgIds = Array.from(new Set(invitedOrgIds.filter(id => Number.isFinite(id) && id > 0)));
        invitedUserIds = Array.from(new Set(invitedUserIds.filter(id => Number.isFinite(id) && id > 0)));

        if (invitedOrgIds.length || invitedUserIds.length) {
          targetUsers = await db.user.findMany({
            where: {
              role: { in: ['seller', 'shg'] as any },
              accountStatus: { not: 'BLOCKED' as any },
              OR: [
                ...(invitedOrgIds.length ? [{ organizationId: { in: invitedOrgIds } }] : []),
                ...(invitedUserIds.length ? [{ id: { in: invitedUserIds } }] : [])
              ]
            },
            select: { id: true, email: true, role: true }
          });
        }

        // STRICT RULE: If invited/limited/selected pool, ONLY invited sellers get notified.
        // If no invited users found, return immediately without notifying anyone else.
        if (!targetUsers.length) return;

      } else if (sourcingStrategy === 'CATEGORY') {
        isCategoryMatched = true;
        const categoryName = (procurement.category || '').trim();
        const catId = procurement.categoryId;

        let resolvedCategoryIds: number[] = catId ? [catId] : [];
        if (categoryName) {
          const matchingCats = await db.category.findMany({
            where: {
              OR: [
                { name: { equals: categoryName, mode: 'insensitive' } },
                { name: { contains: categoryName, mode: 'insensitive' } },
                { slug: { equals: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), mode: 'insensitive' } }
              ]
            },
            select: { id: true }
          }).catch(() => []);
          matchingCats.forEach(c => {
            if (!resolvedCategoryIds.includes(c.id)) resolvedCategoryIds.push(c.id);
          });
        }

        const orgConditions: any[] = [];
        if (resolvedCategoryIds.length) {
          orgConditions.push(
            { products: { some: { status: 'ACTIVE', categoryId: { in: resolvedCategoryIds } } } },
            { services: { some: { status: 'ACTIVE', categoryId: { in: resolvedCategoryIds } } } }
          );
        }
        if (categoryName) {
          orgConditions.push(
            { products: { some: { status: 'ACTIVE', category: { name: { contains: categoryName, mode: 'insensitive' } } } } },
            { services: { some: { status: 'ACTIVE', category: { name: { contains: categoryName, mode: 'insensitive' } } } } }
          );
        }

        let matchedOrgIds: number[] = [];
        if (orgConditions.length) {
          const matchingOrgs = await db.organization.findMany({
            where: {
              verificationStatus: 'VERIFIED',
              isBlacklisted: false,
              deletedAt: null,
              OR: orgConditions
            },
            select: { id: true }
          }).catch(() => []);
          matchedOrgIds = matchingOrgs.map(o => o.id);
        }

        const userConditions: any[] = [];
        if (matchedOrgIds.length) {
          userConditions.push({ organizationId: { in: matchedOrgIds } });
        }
        if (resolvedCategoryIds.length) {
          userConditions.push(
            { products: { some: { status: 'ACTIVE', categoryId: { in: resolvedCategoryIds } } } },
            { services: { some: { status: 'ACTIVE', categoryId: { in: resolvedCategoryIds } } } }
          );
        }
        if (categoryName) {
          userConditions.push(
            { products: { some: { status: 'ACTIVE', category: { name: { contains: categoryName, mode: 'insensitive' } } } } },
            { services: { some: { status: 'ACTIVE', category: { name: { contains: categoryName, mode: 'insensitive' } } } } },
            { sellerProfile: { productCategories: { has: categoryName } } }
          );
        }

        if (userConditions.length) {
          targetUsers = await db.user.findMany({
            where: {
              role: { in: ['seller', 'shg'] as any },
              accountStatus: { not: 'BLOCKED' as any },
              OR: userConditions
            },
            select: { id: true, email: true, role: true }
          });
        }

        // STRICT RULE: If Category sourcing strategy, ONLY strictly matched vendors get notified.
        if (!targetUsers.length) return;

      } else {
        // Public procurement: Notify all active Sellers and SHGs (only if PUBLIC)
        if (procurement.visibility === 'PRIVATE') return;
        targetUsers = await db.user.findMany({
          where: {
            role: { in: ['seller', 'shg'] as any },
            accountStatus: { not: 'BLOCKED' as any }
          },
          select: { id: true, email: true, role: true }
        });
      }

      if (!targetUsers.length) return;

      const titleStr = procurement.title || 'Procurement Opportunity';
      const numStr = procurement.bidNumber || procurement.requirementNumber || `PRC-${procurement.id}`;
      const methodStr = (procurement.canonicalMethod || procurement.procurementType || 'Public Sourcing').replace(/_/g, ' ');
      const orgStr = procurement.buyerOrganizationName || 'Verified Buyer';

      let targetRedirect = `/bids/${encodeURIComponent(numStr)}`;
      if (canonicalMethod.includes('REVERSE') || canonicalMethod.includes('AUCTION')) {
        targetRedirect = `/seller/procurement/reverse-auction/${encodeURIComponent(procurement.id || numStr)}`;
      } else if (canonicalMethod.includes('RATE') || numStr.startsWith('RC-')) {
        targetRedirect = `/seller/procurement/rate-contract/${encodeURIComponent(numStr)}`;
      } else if (canonicalMethod === 'RFQ' || numStr.startsWith('RFQ-')) {
        targetRedirect = `/seller/procurement/rfq/${encodeURIComponent(numStr)}`;
      } else if (canonicalMethod === 'RFP' || numStr.startsWith('RFP-')) {
        targetRedirect = `/seller/procurement/rfp/${encodeURIComponent(numStr)}`;
      } else if (canonicalMethod === 'OPEN_TENDER' || numStr.startsWith('TND-')) {
        targetRedirect = `/seller/procurement/open-tender/${encodeURIComponent(numStr)}`;
      } else if (canonicalMethod === 'LIMITED_TENDER' || numStr.startsWith('LTND-')) {
        targetRedirect = `/seller/procurement/limited-tender/${encodeURIComponent(numStr)}`;
      }

      // For invited sellers, notification type MUST contain 'invit' (e.g. 'bid.invitation')
      // so InviteLoginPopup displays the pending invitation banner popup!
      const notifyOpts: NotifyOpts = isInvitation ? {
        title: `Procurement Invitation: ${titleStr}`,
        message: `Your organization has been invited by ${orgStr} to participate in ${methodStr} (${numStr}).`,
        type: 'bid.invitation',
        priority: 'high',
        redirectUrl: targetRedirect
      } : {
        title: isCategoryMatched ? `New Category Opportunity: ${titleStr}` : `New Procurement Opportunity: ${titleStr}`,
        message: `${orgStr} published a new ${methodStr} requirement (${numStr}). Open portal to view details and submit your proposal.`,
        type: 'procurement.opportunity',
        priority: 'high',
        redirectUrl: targetRedirect
      };

      const emailSubject = isInvitation
        ? `[JsgSmile] Invitation to Bid: ${titleStr} (${numStr})`
        : (isCategoryMatched
          ? `[JsgSmile] New Opportunity in your category: ${titleStr} (${numStr})`
          : `[JsgSmile] New Procurement Opportunity: ${titleStr} (${numStr})`);

      const emailOpts: EmailOpts = {
        subject: emailSubject,
        html: `
          <div style="margin: 0 0 20px; padding: 18px 20px; background: #0c2340; border-radius: 8px; color: #ffffff;">
            <p style="margin: 0 0 6px; color: #c5a556; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${isInvitation ? 'INVITATION TO BID' : `NEW ${escapeHtml(methodStr)} OPPORTUNITY`}</p>
            <h2 style="margin: 0; color: #ffffff; font-size: 20px; line-height: 1.3;">${escapeHtml(titleStr)}</h2>
            <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 13px;">Ref No: <strong>${escapeHtml(numStr)}</strong> | Issued by: <strong>${escapeHtml(orgStr)}</strong></p>
          </div>
          <p style="margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.6;">
            ${isInvitation
              ? `Your organization has been formally invited by <strong>${escapeHtml(orgStr)}</strong> to participate in an exclusive / limited procurement opportunity on the portal.`
              : (isCategoryMatched
                ? `A new procurement opportunity matching your registered business category (<strong>${escapeHtml(procurement.category || 'Category')}</strong>) has been published on the portal.`
                : `A new public procurement opportunity matching registered Seller and SHG business categories has been published on the portal.`)}
          </p>
          <table role="presentation" style="width: 100%; margin: 0 0 22px; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 700; color: #475569; width: 35%;">Procurement Method</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(methodStr)}</td>
            </tr>
            ${procurement.estimatedValue ? `
            <tr>
              <td style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 700; color: #475569;">Estimated Budget</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">₹${Number(procurement.estimatedValue).toLocaleString('en-IN')}</td>
            </tr>` : ''}
            ${procurement.endDate ? `
            <tr>
              <td style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 700; color: #475569;">Submission Deadline</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${formatIstDateTime(procurement.endDate)}</td>
            </tr>` : ''}
          </table>
        `,
        variables: {
          actionUrl: targetRedirect
        }
      };

      // Dispatch in-app and email to strictly targeted sellers & SHGs
      await Promise.allSettled(
        targetUsers.map(user => this.notifyUser(user.id, notifyOpts, ['in_app', 'email']))
      );
    } catch (error) {
      logger.warn({ error, procurementId: procurement.id }, 'Failed to notify sellers and SHGs of published procurement');
    }
  },

  async sendSmsNotification(phone: string, message: string, templateId?: string, purpose: SmsPurpose = 'notification') {
    return smsService.sendNotificationSms(phone, message, templateId, purpose);
  },

  async sendSmsNotificationForUser(userId: number, opts: SmsOpts) {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { mobile: true, mobileVerified: true, }
      });
      if (!user?.mobile || !user.mobileVerified) return null;



      const pref = await db.notificationPreference.findUnique({ where: { userId } });
      if (pref && !pref.smsNotifications) return null;

      const result = await this.sendSmsNotification(user.mobile, opts.message, opts.templateId, opts.purpose || 'notification');
      await db.notificationLog.create({
        data: {
          userId,
          channel: 'SMS',
          recipient: smsService.normalizeMobile(user.mobile) || user.mobile,
          status: result.success ? 'SENT' : 'FAILED',
          sentAt: result.success ? new Date() : null,
          providerResponse: { provider: 'msg91', reason: result.reason, skipped: result.skipped }
        }
      }).catch(() => null);
      return result;
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to send SMS notification');
      await db.notificationLog.create({
        data: {
          userId,
          channel: 'SMS',
          recipient: 'unknown',
          status: 'FAILED',
          providerResponse: { error: String(error) }
        }
      }).catch(() => null);
      return null;
    }
  },

  /** Send email respecting user preferences */
  async sendEmail(userId: number, opts: EmailOpts) {
    try {
      // Check notification preferences
      const pref = await db.notificationPreference.findUnique({ where: { userId } });
      if (pref && !pref.emailNotifications) return null;

      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, } });
      if (!user?.email) return null;

      const companyId = 1;

      // 1. Resolve company portal details (branding)
      let portalName = 'JsgSmile Portal';
      if (db.company) {
        const company = await db.company.findUnique({
          where: { id: companyId },
          select: { portalDisplayName: true, name: true }
        }).catch(() => null);
        portalName = company?.portalDisplayName || company?.name || portalName;
      }

      // 2. Resolve dynamic SMTP credentials & sender details
      const settings = db.companySetting
        ? await db.companySetting.findUnique({
            where: { companyId_key: { companyId, key: 'portal-email-settings' } }
          }).catch(() => null)
        : (db.globalSetting
            ? await db.globalSetting.findUnique({ where: { key: 'portal-email-settings' } }).catch(() => null)
            : null);
      const val = settings?.value || {};
      const fromEmail = val.fromEmail || env.SMTP_USER;
      const fromName = val.fromName || portalName;

      // Verify if email is actually enabled for this tenant
      const emailEnabled = val.emailEnabled ?? Boolean(env.SMTP_USER && env.SMTP_PASS);
      if (!emailEnabled) {
        logger.warn({ userId }, `Email sending is disabled for company ${companyId}. Notification: ${opts.subject}`);
        return null;
      }

      // 3. Resolve template
      const templateSlug = opts.templateSlug || 'notification';
      const templatesSetting = db.companySetting
        ? await db.companySetting.findUnique({
            where: { companyId_key: { companyId, key: 'email-templates' } }
          }).catch(() => null)
        : (db.globalSetting
            ? await db.globalSetting.findUnique({ where: { key: 'email-templates' } }).catch(() => null)
            : null);
      const templates = Array.isArray(templatesSetting?.value) ? templatesSetting.value : [];
      const template = templates.find((t: any) => t.slug === templateSlug && t.isActive);

      let finalSubject = opts.subject;
      let finalHtml = '';

      const portalUrl = getPublicPortalUrl().replace(/\/+$/, '');
      const relativeActionUrl = opts.variables?.actionUrl || '';
      const actionUrl = relativeActionUrl ? ensurePublicUrl(relativeActionUrl) : portalUrl;

      const templateVars = {
        userName: user.name || 'User',
        userEmail: user.email,
        portalName,
        companyName: portalName,
        actionUrl,
        currentDate: new Date().toLocaleDateString(),
        title: opts.variables?.title || opts.subject,
        message: opts.variables?.message || '',
        ...opts.variables
      };

      if (template) {
        const compiled = compileEmailTemplate(template.subject, template.htmlBody, templateVars);
        finalSubject = compiled.subject;
        finalHtml = compiled.html;
      } else {
        if (opts.html && (opts.html.includes('<!DOCTYPE') || opts.html.includes('<html'))) {
          finalHtml = opts.html;
        } else {
          const sanitizedBody = (opts.html || '').replace(/^\s*<p>\s*Dear\s+[^<]+<\/p>\s*/i, '');
          finalHtml = buildGovernmentGradeEmailHtml({
            portalName,
            departmentName: 'Government of Odisha • District Administration Jharsuguda',
            recipientName: user.name || 'Authorized Representative',
            recipientEmail: user.email,
            noticeType: 'OFFICIAL SYSTEM NOTIFICATION',
            noticeRef: `JSG-SYS/${Date.now().toString().slice(-6)}`,
            badgeVariant: 'primary',
            heading: opts.subject,
            bodyHtml: sanitizedBody,
            actionButton: {
              label: 'Access JSG SMILE Portal',
              url: actionUrl
            },
            securityAdvisory: 'Official Administrative Advisory: Verify all official communications through your dashboard on the JSG SMILE Portal. Official staff will never ask for your account credentials.'
          });
        }
      }

      const transporter = await getTransporterForCompany(companyId);

      const hasAuth = val.username || (env.SMTP_USER && env.SMTP_PASS);
      if (!hasAuth) {
        logger.warn({ userId }, 'No SMTP credentials configured; email not sent');
        return null;
      }

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: user.email,
        subject: finalSubject,
        html: finalHtml,
        attachments: opts.attachments
      });

      // Log delivery
      await db.notificationLog.create({
        data: {
          userId,
          channel: 'EMAIL',
          recipient: user.email,
          status: 'SENT',
          sentAt: new Date(),
          providerResponse: { messageId: info?.messageId }
        }
      }).catch(() => null);

      return info;
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to send email notification');
      // Log failure
      await db.notificationLog.create({
        data: {
          userId,
          channel: 'EMAIL',
          recipient: 'unknown',
          status: 'FAILED',
          providerResponse: { error: String(error) }
        }
      }).catch(() => null);
      return null;
    }
  },

  async notifyWithEmail(
    userId: number,
    opts: NotifyOpts & {
      emailSubject?: string;
      emailHtml?: string;
      attachments?: Array<{
        filename: string;
        content?: Buffer | string;
        path?: string;
        contentType?: string;
      }>;
    }
  ) {
    void (async () => {
      await this.notifyNow(userId, opts);
      await this.sendEmail(userId, {
        subject: opts.emailSubject || `${opts.title} - MSME Procurement Portal`,
        html: opts.emailHtml || buildNotificationEmailHtml(opts),
        templateSlug: opts.type?.replace(/_/g, '-'),
        variables: {
          title: opts.title,
          message: opts.message,
          actionUrl: opts.redirectUrl || ''
        },
        attachments: opts.attachments
      });
      await this.sendSmsNotificationForUser(userId, {
        message: `${opts.title}: ${opts.message}`,
        purpose: opts.type?.includes('tender') || opts.type?.includes('procurement') ? 'tender_alert' : 'notification'
      });
    })().catch(err => {
      logger.warn({ err, userId }, 'Background notification failed');
    });
    return null;
  },

  /** Notify admins with email */
  async notifyAdminsWithEmail(opts: NotifyOpts & { emailSubject?: string; emailHtml?: string }) {
    try {
      const admins = await db.user.findMany({
        where: { role: 'admin' },
        select: { id: true }
      });
      await Promise.allSettled(
        admins.map((admin: { id: number }) => this.notifyWithEmail(admin.id, opts))
      );
    } catch (error) {
      logger.warn({ error, type: opts.type }, 'Failed to notify admins with email');
    }
  },

  /** Send direct email to an arbitrary email address (e.g. citizen / unregistered grievance complainant) */
  async sendDirectEmail(
    toEmail: string,
    recipientName: string,
    opts: {
      subject: string;
      html: string;
      attachments?: Array<{
        filename: string;
        content?: Buffer | string;
        path?: string;
        contentType?: string;
      }>;
    }
  ) {
    try {
      if (!toEmail || !toEmail.includes('@')) return null;

      const companyId = 1;
      let portalName = 'JsgSmile Portal';
      if (db.company) {
        const company = await db.company.findUnique({
          where: { id: companyId },
          select: { portalDisplayName: true, name: true }
        }).catch(() => null);
        portalName = company?.portalDisplayName || company?.name || portalName;
      }

      const settings = db.companySetting
        ? await db.companySetting.findUnique({
            where: { companyId_key: { companyId, key: 'portal-email-settings' } }
          }).catch(() => null)
        : (db.globalSetting
            ? await db.globalSetting.findUnique({ where: { key: 'portal-email-settings' } }).catch(() => null)
            : null);
      const val = settings?.value || {};
      const fromEmail = val.fromEmail || env.SMTP_USER;
      const fromName = val.fromName || portalName;

      const emailEnabled = val.emailEnabled ?? Boolean(env.SMTP_USER && env.SMTP_PASS);
      if (!emailEnabled) {
        logger.warn({ toEmail }, `Email sending is disabled for company ${companyId}. Direct Email: ${opts.subject}`);
        return null;
      }

      let finalHtml = '';
      if (opts.html && (opts.html.includes('<!DOCTYPE') || opts.html.includes('<html'))) {
        finalHtml = opts.html;
      } else {
        const sanitizedBody = (opts.html || '').replace(/^\s*<p>\s*Dear\s+[^<]+<\/p>\s*/i, '');
        const portalUrl = getPublicPortalUrl().replace(/\/+$/, '');
        finalHtml = buildGovernmentGradeEmailHtml({
          portalName,
          departmentName: 'Government of Odisha • District Administration Jharsuguda',
          recipientName: recipientName || 'Citizen / Stakeholder',
          recipientEmail: toEmail,
          noticeType: 'GRIEVANCE & CITIZEN SERVICES',
          noticeRef: `JSG-GRV/${Date.now().toString().slice(-6)}`,
          badgeVariant: 'primary',
          heading: opts.subject,
          bodyHtml: sanitizedBody,
          actionButton: {
            label: 'Track Status on Portal',
            url: `${portalUrl}/disputes`
          },
          securityAdvisory: 'Statutory Notice: The District Grievance & Facilitation Cell processes all submissions under public service delivery regulations. Quote your ticket reference in all subsequent correspondence.'
        });
      }

      const transporter = await getTransporterForCompany(companyId);
      const hasAuth = val.username || (env.SMTP_USER && env.SMTP_PASS);
      if (!hasAuth) {
        logger.warn({ toEmail }, 'No SMTP credentials configured; direct email not sent');
        return null;
      }

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmail,
        subject: opts.subject,
        html: finalHtml,
        attachments: opts.attachments
      });

      logger.info({ toEmail, subject: opts.subject, messageId: info?.messageId }, 'Direct email sent successfully');
      return info;
    } catch (error) {
      logger.warn({ error, toEmail }, 'Failed to send direct email');
      return null;
    }
  }
};
