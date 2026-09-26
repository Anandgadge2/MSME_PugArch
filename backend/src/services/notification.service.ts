import prisma from '../lib/prisma.js';
import { publishNotificationEvent } from './realtime.service.js';
import { getTransporter, getTransporterForCompany, compileEmailTemplate } from './mail.service.js';
import { env, getPublicPortalUrl } from '../config/env.js';
import { logger } from '../config/logger.js';
import { smsService, type SmsPurpose } from './sms.service.js';
import { buildGovernmentGradeEmailHtml, ensurePublicUrl } from './email-template.builder.js';

const db = prisma as any;

interface NotifyOpts {
  title: string;
  message: string;
  type: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  redirectUrl?: string;
}

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
}) => {
  const priority = escapeHtml(opts.priority || 'medium');
  const type = (opts.type || 'PORTAL NOTIFICATION').replace(/_/g, ' ');
  const portalUrl = getPublicPortalUrl();
  const actionUrl = opts.redirectUrl ? ensurePublicUrl(opts.redirectUrl) : portalUrl;

  const badgeVariant = opts.priority === 'urgent'
    ? 'danger'
    : opts.priority === 'high'
    ? 'warning'
    : opts.priority === 'low'
    ? 'info'
    : 'primary';

  return buildGovernmentGradeEmailHtml({
    portalName: 'JSG SMILE Procurement Portal',
    departmentName: 'Government of Odisha • District Administration Jharsuguda',
    noticeType: type,
    noticeRef: `JSG-NOTIF/${Date.now().toString().slice(-6)}`,
    badgeVariant,
    heading: opts.title,
    summary: opts.message,
    detailsTable: [
      {
        label: 'Event Type',
        value: type.toUpperCase(),
        isHighlight: true
      },
      {
        label: 'Priority Level',
        value: priority.toUpperCase(),
        color: opts.priority === 'urgent' ? '#b91c1c' : opts.priority === 'high' ? '#b45309' : '#1e3a8a',
        isHighlight: true
      },
      {
        label: 'Official Portal Gateway',
        value: `<a href="${portalUrl}" style="color: #1e40af; text-decoration: underline; font-weight: 700;">${portalUrl}</a>`
      }
    ],
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
        subject: `${opts.title} - MSME Procurement Portal`,
        html: buildNotificationEmailHtml(opts)
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

  /** Notify sellers & SHG users about a published public or invited procurement opportunity */
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
    invitedSellerOrgIds?: number[];
    invitedUserIds?: number[];
  }) {
    try {
      const isLimited = procurement.visibility === 'LIMITED' || procurement.visibility === 'INVITED_SELLERS_ONLY';
      let targetUsers: Array<{ id: number; email?: string | null; role?: string }> = [];

      if (isLimited) {
        const invitedOrgIds = procurement.invitedSellerOrgIds || [];
        const invitedUserIds = procurement.invitedUserIds || [];
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
      } else {
        // Public procurement: Notify all active Sellers and SHGs
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

      const notifyOpts: NotifyOpts = {
        title: `New Procurement Opportunity: ${titleStr}`,
        message: `${orgStr} published a new ${methodStr} requirement (${numStr}). Open portal to view details and submit your proposal.`,
        type: 'procurement.opportunity',
        priority: 'high',
        redirectUrl: `/seller/opportunities`
      };

      const emailOpts: EmailOpts = {
        subject: `[JsgSmile] New Procurement Opportunity: ${titleStr} (${numStr})`,
        html: `
          <div style="margin: 0 0 20px; padding: 18px 20px; background: #0c2340; border-radius: 8px; color: #ffffff;">
            <p style="margin: 0 0 6px; color: #c5a556; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">NEW ${escapeHtml(methodStr)} OPPORTUNITY</p>
            <h2 style="margin: 0; color: #ffffff; font-size: 20px; line-height: 1.3;">${escapeHtml(titleStr)}</h2>
            <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 13px;">Ref No: <strong>${escapeHtml(numStr)}</strong> | Issued by: <strong>${escapeHtml(orgStr)}</strong></p>
          </div>
          <p style="margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.6;">
            A new public procurement opportunity matching registered Seller and SHG business categories has been published on the portal.
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
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #0f172a;">${new Date(procurement.endDate).toLocaleString()}</td>
            </tr>` : ''}
          </table>
        `,
        variables: {
          actionUrl: '/seller/opportunities'
        }
      };

      // Dispatch in-app and email to all targeted sellers & SHGs
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
