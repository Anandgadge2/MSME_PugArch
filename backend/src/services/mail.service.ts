import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import prisma from '../lib/prisma.js';

const db = prisma as any;

// Transporter Cache per companyId (key: companyId, value: transporter)
const transporterCache = new Map<number, nodemailer.Transporter>();
let globalTransporter: nodemailer.Transporter | null = null;

/**
 * Resolve or create a nodemailer SMTP transporter for the specified company.
 */
export const getTransporterForCompany = async (companyId: number): Promise<nodemailer.Transporter> => {
  if (transporterCache.has(companyId)) {
    return transporterCache.get(companyId)!;
  }

  try {
    const stored = db.companySetting
      ? await db.companySetting.findUnique({
          where: { companyId_key: { companyId, key: 'portal-email-settings' } }
        }).catch(() => null)
      : (db.globalSetting
          ? await db.globalSetting.findUnique({ where: { key: 'portal-email-settings' } }).catch(() => null)
          : null);

    const val = stored?.value || {};
    // If custom SMTP is enabled and has a host/username, construct a transporter
    if (val.emailEnabled && val.host && val.username) {
      const dynamicTransporter = nodemailer.createTransport({
        host: val.host,
        port: Number(val.port || 587),
        secure: Boolean(val.secure),
        auth: {
          user: val.username,
          pass: val.password || ''
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000
      });

      transporterCache.set(companyId, dynamicTransporter);
      return dynamicTransporter;
    }
  } catch (err) {
    console.error(`[SMTP Resolver] Failed to resolve SMTP config for company ${companyId}:`, err);
  }

  // Fallback to global SMTP transporter
  if (!globalTransporter) {
    globalTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER && env.SMTP_PASS ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });
  }

  return globalTransporter;
};

/**
 * Legacy compatibility helper. Returns the global transporter.
 */
export const getTransporter = () => {
  if (!globalTransporter) {
    globalTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER && env.SMTP_PASS ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });
  }
  return globalTransporter;
};

/**
 * Replace template placeholders like {{variableName}} with their values.
 */
export const compileEmailTemplate = (
  subject: string,
  htmlBody: string,
  variables: Record<string, string>
): { subject: string; html: string } => {
  let compiledSubject = subject;
  let compiledHtml = htmlBody;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    compiledSubject = compiledSubject.replace(regex, value || '');
    compiledHtml = compiledHtml.replace(regex, value || '');
  }

  return { subject: compiledSubject, html: compiledHtml };
};

/**
 * Send an OTP verification email using company-specific settings and templates when available.
 */
export const sendOtpEmail = async (
  email: string,
  otp: string,
  subjectDefault = '[SECURE AUTH] Verification Code',
  templateSlug = 'common-otp'
): Promise<boolean> => {
  try {
    // 1. Resolve user's company ID
    const user = await db.user.findFirst({
      where: { email },
      select: { name: true, organizationId: true }
    }).catch(() => null);
    const companyId = (user as any)?.companyId || user?.organizationId || 1;

    // 2. Fetch company portal details (branding)
    let portalName = 'JsgSmile Portal';
    let companyName = portalName;
    if (db.company) {
      const company = await db.company.findUnique({
        where: { id: companyId },
        select: { portalDisplayName: true, name: true }
      }).catch(() => null);
      if (company) {
        portalName = company.portalDisplayName || company.name || portalName;
        companyName = company.name || portalName;
      }
    } else if (db.organization && user?.organizationId) {
      const org = await db.organization.findUnique({
        where: { id: user.organizationId },
        select: { organizationName: true }
      }).catch(() => null);
      if (org?.organizationName) {
        portalName = org.organizationName;
        companyName = org.organizationName;
      }
    }

    // 3. Resolve dynamic SMTP credentials & sender details
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
      console.warn(`[OTP] Email sending is disabled for company ${companyId} (${email})`);
      return false;
    }

    // 4. Resolve template
    const templatesSetting = db.companySetting
      ? await db.companySetting.findUnique({
          where: { companyId_key: { companyId, key: 'email-templates' } }
        }).catch(() => null)
      : (db.globalSetting
          ? await db.globalSetting.findUnique({ where: { key: 'email-templates' } }).catch(() => null)
          : null);
    const templates = Array.isArray(templatesSetting?.value) ? templatesSetting.value : [];
    const template = templates.find((t: any) => t.slug === templateSlug && t.isActive);

    let finalSubject = subjectDefault;
    let finalHtml = '';

    const templateVars = {
      otp,
      userName: user?.name || 'User',
      userEmail: email,
      portalName,
      companyName,
      currentDate: new Date().toLocaleDateString()
    };

    if (template) {
      const compiled = compileEmailTemplate(template.subject, template.htmlBody, templateVars);
      finalSubject = compiled.subject;
      finalHtml = compiled.html;
    } else {
      // Hardcoded fallback template matching the old style
      finalHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background:#12335f;color:white;padding:18px;text-align:center;font-weight:700;">${portalName} Secure Verification</div>
          <div style="padding:28px;color:#1e293b;">
            <p>Use this verification code to continue:</p>
            <div style="font-size:32px;letter-spacing:10px;font-weight:800;text-align:center;margin:24px 0;color:#12335f;">${otp}</div>
            <p style="font-size:12px;color:#64748b;">This code expires in 10 minutes. If you did not request it, ignore this message and contact support.</p>
          </div>
        </div>
      `;
    }

    const transporter = await getTransporterForCompany(companyId);

    // If no transporter auth credentials resolved and no global credentials, fail without leaking OTP.
    const hasAuth = val.username || (env.SMTP_USER && env.SMTP_PASS);
    if (!hasAuth) {
      console.warn(`[OTP] No SMTP credentials configured for ${email}`);
      return false;
    }

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: finalSubject,
      html: finalHtml
    });

    return true;
  } catch (error: any) {
    console.error(`[OTP] Failed to send email to ${email}. Error:`, error);
    return false;
  }
};

export interface SendAdminWelcomeEmailParams {
  email: string;
  name: string;
  role: string;
  userId?: string;
  temporaryPassword?: string;
  isReset?: boolean;
}

/**
 * Send welcome/invitation email with login details, portal link, temporary password, and reset link to admin users.
 */
export const sendAdminWelcomeEmail = async (params: SendAdminWelcomeEmailParams): Promise<boolean> => {
  const { email, name, role, userId, temporaryPassword, isReset = false } = params;
  try {
    const rawPortalUrl = env.FRONTEND_URL || process.env.PRODUCTION_URL || process.env.PUBLIC_URL || process.env.APP_URL || process.env.PORTAL_URL || 'http://localhost:3000';
    const portalUrl = rawPortalUrl.trim().replace(/\/+$/, '');
    const loginUrl = `${portalUrl}/login`;
    const resetUrl = `${portalUrl}/forgot-password`;
    const portalName = 'JSG SMILE Portal';
    const fromEmail = env.SMTP_USER || 'no-reply@jsgsmile.gov.in';
    const fromName = 'JSG SMILE District Administration';

    const roleTitle = String(role || 'ADMIN').toUpperCase().replace(/_/g, ' ');
    const subject = isReset 
      ? `[${portalName}] Your Password Has Been Reset`
      : `[${portalName}] Welcome - Your Admin Account Credentials`;

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
        <!-- Tricolor Accent Top Bar -->
        <div style="height: 4px; background: linear-gradient(to right, #f59e0b, #ffffff, #10b981);"></div>
        
        <!-- Header Banner -->
        <div style="background-color: #07172e; color: #ffffff; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #ffffff; text-transform: uppercase;">
            ${portalName}
          </h1>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px;">
            Jharsuguda Synergy for MSME & Industry Linkage Ecosystem
          </p>
        </div>

        <!-- Content Body -->
        <div style="padding: 32px 28px; color: #1e293b; line-height: 1.6;">
          <h2 style="margin-top: 0; font-size: 18px; color: #0f172a; font-weight: 700;">
            Hello ${name || 'Administrator'},
          </h2>

          <p style="font-size: 14px; color: #334155;">
            ${isReset 
              ? 'Your account password has been reset by the Master Administrator. You can log in using your updated temporary credentials below:'
              : 'Your administrator account has been successfully created on the JSG SMILE Portal. Below are your official access credentials:'}
          </p>

          <!-- Credentials Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #12335f; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">Portal Login:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">
                  <a href="${loginUrl}" style="color: #2563eb; text-decoration: underline;">${loginUrl}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Account Email:</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 14px; font-weight: 700;">${email}</td>
              </tr>
              ${userId ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">System User ID:</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 14px; font-weight: 700;">${userId}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Assigned Role:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${roleTitle}</td>
              </tr>
              ${temporaryPassword ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Temporary Pass:</td>
                <td style="padding: 6px 0; color: #d97706; font-family: monospace; font-size: 15px; font-weight: 800; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                  ${temporaryPassword}
                </td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" style="background-color: #12335f; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(18,51,95,0.25);">
              Login to JSG SMILE Portal &rarr;
            </a>
          </div>

          <!-- Security Instructions -->
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px; font-size: 13px; color: #92400e;">
            <strong>Security Advisory:</strong> For security reasons, please change your password upon your first login. You can reset or update your password anytime at:
            <br />
            <a href="${resetUrl}" style="color: #b45309; font-weight: 700; text-decoration: underline; word-break: break-all;">${resetUrl}</a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
          <div>Government of Odisha &bull; District Administration Jharsuguda</div>
          <div>Official MSME Linkage Gateway &bull; Confidential Administrative Access</div>
        </div>
      </div>
    `;

    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject,
      html
    });

    console.log(`[AdminMail] Welcome email sent to ${email} (MessageID: ${info?.messageId || 'sent'})`);
    return true;
  } catch (error: any) {
    console.error(`[AdminMail] Failed to send email to ${email}:`, error?.message || error);
    return false;
  }
};

export interface SendTeamInvitationCredentialsParams {
  email: string;
  name: string;
  temporaryPassword: string;
  roleNames: string[];
  inviterName: string;
  workspaceName: string;
  organizationId?: number | null;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/**
 * Sends one-time credentials for a scoped team account. The temporary
 * password is never persisted outside the user's password hash and this
 * delivery attempt.
 */
export const sendTeamInvitationCredentialsEmail = async (
  params: SendTeamInvitationCredentialsParams
): Promise<boolean> => {
  const {
    email,
    name,
    temporaryPassword,
    roleNames,
    inviterName,
    workspaceName,
    organizationId
  } = params;

  try {
    const rawPortalUrl = env.FRONTEND_URL || process.env.PRODUCTION_URL || process.env.PUBLIC_URL || process.env.APP_URL || process.env.PORTAL_URL || 'http://localhost:3000';
    const portalUrl = rawPortalUrl.trim().replace(/\/+$/, '');
    const loginUrl = `${portalUrl}/login?email=${encodeURIComponent(email)}`;
    const tenantId = organizationId || 1;
    const settings = db.companySetting
      ? await db.companySetting.findUnique({
          where: { companyId_key: { companyId: tenantId, key: 'portal-email-settings' } }
        }).catch(() => null)
      : null;
    const mailSettings = settings?.value || {};
    const fromEmail = mailSettings.fromEmail || env.SMTP_USER || 'no-reply@jsgsmile.gov.in';
    const fromName = mailSettings.fromName || 'JSG SMILE Portal';
    const transporter = await getTransporterForCompany(tenantId);
    const safeRoles = roleNames.length ? roleNames.map(escapeHtml).join(', ') : 'Workspace user';

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: `[JSG SMILE] You have been invited to ${workspaceName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#f4f7fb;padding:28px;color:#172033;">
          <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dbe3ef;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(15,35,65,.08);">
            <div style="height:5px;background:linear-gradient(90deg,#f59e0b 0 33%,#fff 33% 66%,#10b981 66%);"></div>
            <div style="background:#0b2447;color:#fff;padding:28px 32px;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b9c9de;">JSG SMILE secure access</div>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;">Welcome to ${escapeHtml(workspaceName)}</h1>
            </div>
            <div style="padding:30px 32px;">
              <p style="margin-top:0;font-size:16px;">Hello <strong>${escapeHtml(name)}</strong>,</p>
              <p style="font-size:14px;line-height:1.7;color:#475569;">${escapeHtml(inviterName)} created a secure sub-login for you. Your access is limited to the roles and permissions assigned inside this workspace.</p>
              <div style="margin:24px 0;border:1px solid #dbe3ef;border-radius:12px;background:#f8fafc;padding:20px;">
                <div style="margin-bottom:12px;font-size:12px;font-weight:800;text-transform:uppercase;color:#64748b;">Login credentials</div>
                <table style="width:100%;font-size:14px;border-collapse:collapse;">
                  <tr><td style="padding:7px 0;color:#64748b;width:145px;">Email</td><td style="padding:7px 0;font-weight:700;">${escapeHtml(email)}</td></tr>
                  <tr><td style="padding:7px 0;color:#64748b;">Temporary password</td><td style="padding:7px 0;font-family:monospace;font-size:16px;font-weight:800;color:#9a5b00;">${escapeHtml(temporaryPassword)}</td></tr>
                  <tr><td style="padding:7px 0;color:#64748b;">Assigned role(s)</td><td style="padding:7px 0;font-weight:700;">${safeRoles}</td></tr>
                </table>
              </div>
              <div style="text-align:center;margin:28px 0;">
                <a href="${loginUrl}" style="display:inline-block;background:#12335f;color:#fff;padding:14px 28px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:800;">Sign in and activate account</a>
              </div>
              <div style="border-radius:10px;background:#fff7e6;border:1px solid #f8d594;padding:15px;color:#7a4a00;font-size:13px;line-height:1.6;">
                <strong>Required on first login:</strong> change this temporary password, then verify your mobile number using OTP. Dashboard access remains locked until both steps are complete.
              </div>
              <p style="margin:22px 0 0;font-size:12px;color:#64748b;">If you were not expecting this account, contact ${escapeHtml(inviterName)} and do not use these credentials.</p>
            </div>
          </div>
        </div>
      `
    });
    return true;
  } catch (error: any) {
    console.error(`[TeamInviteMail] Failed to send credentials to ${email}:`, error?.message || error);
    return false;
  }
};
