import nodemailer from 'nodemailer';
import { env, getPublicPortalUrl } from '../config/env.js';
import prisma from '../lib/prisma.js';
import { buildGovernmentGradeEmailHtml } from './email-template.builder.js';

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
      const cleanPurpose = subjectDefault.replace(/\[.*?\]\s*/g, '').trim() || 'Authentication / Security Verification';
      finalSubject = `[SECURE AUTH] One-Time Password (OTP) - ${portalName}`;
      finalHtml = buildGovernmentGradeEmailHtml({
        portalName,
        departmentName: 'Government of Odisha • District Administration Jharsuguda',
        recipientName: user?.name || 'Authorized User',
        recipientEmail: email,
        noticeType: 'AUTHENTICATION VERIFICATION CODE',
        noticeRef: `JSG-AUTH/OTP/${Date.now().toString().slice(-6)}`,
        badgeVariant: 'primary',
        heading: 'One-Time Verification Code (OTP)',
        summary: `A security verification request has been initiated for your account on the official MSME Procurement Portal (${portalName}). Use the authorization credentials detailed below to proceed.`,
        detailsTable: [
          {
            label: 'One-Time Password (OTP)',
            value: `<span style="font-family: Consolas, Monaco, monospace; font-size: 26px; font-weight: 800; letter-spacing: 8px; color: #0b2545; background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 14px; border-radius: 6px; display: inline-block;">${otp}</span>`
          },
          {
            label: 'Validity Duration',
            value: 'Valid for 10 Minutes (Single Use Only)',
            isHighlight: true,
            color: '#b45309'
          },
          {
            label: 'Associated Email ID',
            value: email,
            isCode: true
          },
          {
            label: 'Verification Purpose',
            value: cleanPurpose
          }
        ],
        stepInstructions: {
          title: 'Verification Instructions',
          steps: [
            'Enter the 6-digit verification code above into the portal prompt window.',
            'Ensure you do not refresh or close your browser tab until authentication completes.',
            'If this code expires, you may request a new OTP from the portal interface.'
          ]
        },
        actionButton: {
          label: 'Access JSG SMILE Portal',
          url: getPublicPortalUrl()
        },
        securityAdvisory: 'Statutory Security Notice: District Administration officials, helpdesk staff, and procurement officers will NEVER ask for your OTP, password, or digital certificate PIN. If you did not initiate this authentication request, please change your password and report the incident immediately to the portal security desk.'
      });
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
    const portalUrl = getPublicPortalUrl().replace(/\/+$/, '');
    const loginUrl = `${portalUrl}/login`;
    const resetUrl = `${portalUrl}/forgot-password`;
    const portalName = 'JSG SMILE Procurement Portal';
    const fromEmail = env.SMTP_USER || 'no-reply@jsgsmile.gov.in';
    const fromName = 'JSG SMILE District Administration';

    const roleTitle = String(role || 'ADMIN').toUpperCase().replace(/_/g, ' ');
    const subject = isReset 
      ? `[${portalName}] Official Notice: Administrative Password Reset`
      : `[${portalName}] Official Provisioning: Administrator Account Credentials`;

    const html = buildGovernmentGradeEmailHtml({
      portalName,
      departmentName: 'Government of Odisha • District Administration Jharsuguda',
      recipientName: name || 'Designated Administrator',
      recipientEmail: email,
      noticeType: isReset ? 'PASSWORD RESET NOTIFICATION' : 'ADMINISTRATIVE ACCESS PROVISIONING',
      noticeRef: `JSG-ADM/CRED/${Date.now().toString().slice(-6)}`,
      badgeVariant: 'primary',
      heading: isReset ? 'Administrator Password Reset Authorization' : 'Welcome to JSG SMILE Administrative Desk',
      summary: isReset
        ? 'Your administrative account password on the JSG SMILE Procurement Portal has been reset by Master Administration. You may now authenticate using the provisional credentials detailed below.'
        : 'An official administrative account has been provisioned for you on the JSG SMILE Portal (Jharsuguda Synergy for MSME & Industry Linkage Ecosystem). Below are your official access credentials and security instructions.',
      detailsTable: [
        {
          label: 'Official Portal URL',
          value: `<a href="${loginUrl}" style="color: #1e40af; text-decoration: underline; font-weight: 700;">${loginUrl}</a>`
        },
        {
          label: 'Authorized Email ID',
          value: email,
          isCode: true
        },
        ...(userId ? [{
          label: 'System User Identifier',
          value: userId,
          isCode: true
        }] : []),
        {
          label: 'Assigned Authority Role',
          value: roleTitle,
          isHighlight: true,
          color: '#0f172a'
        },
        ...(temporaryPassword ? [{
          label: 'Temporary Access Pass',
          value: `<span style="font-family: Consolas, Monaco, monospace; font-size: 16px; font-weight: 800; color: #b45309; background-color: #fef3c7; border: 1px dashed #f59e0b; padding: 4px 10px; border-radius: 4px; display: inline-block;">${temporaryPassword}</span>`
        }] : [])
      ],
      stepInstructions: {
        title: 'Mandatory Security & Activation Checklist',
        steps: [
          'Navigate to the official portal login interface using the secure button below.',
          'Authenticate using your registered email address and the temporary password provided above.',
          'Upon first login, the security gateway will require you to establish a new, strong permanent password.',
          'Verify your assigned district administrative privileges on the control dashboard.'
        ]
      },
      actionButton: {
        label: 'Access Administrative Portal',
        url: loginUrl
      },
      secondaryActionButton: {
        label: 'Password Recovery Desk',
        url: resetUrl
      },
      securityAdvisory: 'Statutory Administrative Advisory: Never disclose administrative passwords or 2FA credentials. For security auditing, all administrative sessions and state transitions are logged with immutable cryptographic audit trails.'
    });

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

/**
 * Send invitation email to a sub-user with direct login link and auto-generated temporary password.
 */
export const sendSubUserInvitationEmail = async (
  email: string,
  data: {
    name: string;
    organizationName: string;
    roleName: string;
    tempPassword: string;
    loginUrl?: string;
  }
): Promise<boolean> => {
  const { name, organizationName, roleName, tempPassword } = data;
  const portalUrl = getPublicPortalUrl().replace(/\/+$/, '');
  const loginUrl = `${portalUrl}/login`;
  const fromName = 'JSG SMILE Procurement Administration';
  const fromEmail = env.SMTP_USER || 'no-reply@jsgsmile.odisha.gov.in';
  const subject = `[JSG SMILE] Account Activation Credentials — Sub-User for ${organizationName}`;

  console.log(`\n========================================`);
  console.log(`[SUB-USER INVITE GENERATED]`);
  console.log(`To: ${email} (${name})`);
  console.log(`Organization: ${organizationName}`);
  console.log(`Role: ${roleName}`);
  console.log(`Temporary Password: ${tempPassword}`);
  console.log(`Login URL: ${loginUrl}`);
  console.log(`========================================\n`);

  try {
    const html = buildGovernmentGradeEmailHtml({
      portalName: 'JSG SMILE Procurement Portal',
      departmentName: 'Government of Odisha • District Administration Jharsuguda',
      recipientName: name || 'Authorized Team Member',
      recipientEmail: email,
      noticeType: 'SUB-USER ACCOUNT PROVISIONING',
      noticeRef: `JSG-ORG/INV/${Date.now().toString().slice(-6)}`,
      badgeVariant: 'primary',
      heading: 'Sub-User Procurement Account Provisioned',
      summary: `An official sub-user account has been provisioned for you under ${organizationName} on the JSG SMILE Procurement Gateway. You have been delegated administrative access with the role of ${roleName}.`,
      detailsTable: [
        {
          label: 'Affiliated Enterprise',
          value: organizationName,
          isHighlight: true
        },
        {
          label: 'Assigned Enterprise Role',
          value: roleName,
          isHighlight: true,
          color: '#1e40af'
        },
        {
          label: 'Registered Login Email',
          value: email,
          isCode: true
        },
        {
          label: 'Provisional Password',
          value: `<span style="font-family: Consolas, Monaco, monospace; font-size: 16px; font-weight: 800; color: #b45309; background-color: #fef3c7; border: 1px dashed #f59e0b; padding: 4px 10px; border-radius: 4px; display: inline-block;">${tempPassword}</span>`
        },
        {
          label: 'Portal Access URL',
          value: `<a href="${loginUrl}" style="color: #1e40af; text-decoration: underline; font-weight: 700;">${loginUrl}</a>`
        }
      ],
      stepInstructions: {
        title: 'First-Time Login & Activation Instructions',
        steps: [
          'Click the Login & Activate button below to navigate to the secure login gateway.',
          'Authenticate using your registered email ID and the provisional password shown above.',
          'Set your personal permanent password and complete mobile number verification via OTP.',
          'Once verified, access your organization dashboard to participate in tenders, RFQs, and purchase orders.'
        ]
      },
      actionButton: {
        label: 'Login & Activate Account',
        url: loginUrl
      },
      securityAdvisory: 'Statutory Security Advisory: Your sub-user credentials grant direct access to create, submit, or manage official commercial orders and bids. Do not share your login credentials with unauthorized personnel.'
    });

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject,
      html
    });

    console.log(`[SubUserMail] Invitation email sent to ${email}`);
    return true;
  } catch (error: any) {
    console.error(`[SubUserMail] Failed to send email to ${email}:`, error?.message || error);
    return false;
  }
};
