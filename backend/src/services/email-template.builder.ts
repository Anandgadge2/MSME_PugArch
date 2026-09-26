import { getPublicPortalUrl } from '../config/env.js';

export interface TableRow {
  label: string;
  value: string;
  isCode?: boolean;
  isHighlight?: boolean;
  color?: string;
}

export interface GovernmentGradeEmailOptions {
  portalName?: string;
  departmentName?: string;
  recipientName?: string;
  recipientEmail?: string;
  noticeType?: string; // e.g. "OFFICIAL PROCUREMENT NOTICE", "SECURITY VERIFICATION", "ACCOUNT CREDENTIALS", "PURCHASE ORDER"
  noticeRef?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  heading: string;
  summary?: string;
  detailsTable?: TableRow[];
  bodyHtml?: string;
  actionButton?: {
    label: string;
    url: string;
  };
  secondaryActionButton?: {
    label: string;
    url: string;
  };
  stepInstructions?: {
    title?: string;
    steps: string[];
  };
  securityAdvisory?: string | boolean;
  helpdeskEmail?: string;
  attachmentsNote?: string;
}

/**
 * Ensures that any portal link passed into emails is an official, publicly reachable URL
 * and never contains localhost or 127.0.0.1.
 */
export const ensurePublicUrl = (targetUrl?: string): string => {
  const base = getPublicPortalUrl().replace(/\/+$/, '');
  if (!targetUrl || targetUrl.trim() === '') {
    return base;
  }

  const trimmed = targetUrl.trim();

  // If already an absolute public url (not localhost)
  if (/^https?:\/\//i.test(trimmed)) {
    if (!/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
      return trimmed;
    }
    // If it was localhost, extract the path and prepend the public base
    try {
      const parsed = new URL(trimmed);
      return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return base;
    }
  }

  // Relative path
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
};

export const escapeEmailHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Format current date in Indian Standard Time (IST)
 */
export const formatIstDateTime = (date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date) + ' IST';
  } catch {
    return date.toUTCString();
  }
};

/**
 * Build a state-of-the-art Government Grade & Enterprise Procurement Email (GeM / SAP Ariba style)
 */
export const buildGovernmentGradeEmailHtml = (options: GovernmentGradeEmailOptions): string => {
  const portalName = options.portalName || 'JSG SMILE Procurement Portal';
  const departmentName = options.departmentName || 'Government of Odisha • District Administration Jharsuguda';
  const recipientName = options.recipientName || 'Authorized Representative';
  const noticeType = (options.noticeType || 'OFFICIAL COMMUNICATION').toUpperCase();
  const noticeRef = options.noticeRef || `JSG-MSME/NOTIF/${Date.now().toString().slice(-6)}`;
  const badgeVariant = options.badgeVariant || 'primary';
  const dateTimeStr = formatIstDateTime();
  const helpdeskEmail = options.helpdeskEmail || 'support@jsgsmile.odisha.gov.in';

  // Badge & alert styling palettes
  const colorPalettes = {
    primary: {
      bg: '#eff6ff',
      border: '#bfdbfe',
      badgeBg: '#1e40af',
      badgeText: '#ffffff',
      title: '#1e3a8a'
    },
    success: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      badgeBg: '#166534',
      badgeText: '#ffffff',
      title: '#14532d'
    },
    warning: {
      bg: '#fffbeb',
      border: '#fde68a',
      badgeBg: '#b45309',
      badgeText: '#ffffff',
      title: '#78350f'
    },
    danger: {
      bg: '#fef2f2',
      border: '#fecaca',
      badgeBg: '#b91c1c',
      badgeText: '#ffffff',
      title: '#7f1d1d'
    },
    info: {
      bg: '#f8fafc',
      border: '#e2e8f0',
      badgeBg: '#334155',
      badgeText: '#ffffff',
      title: '#0f172a'
    }
  };

  const palette = colorPalettes[badgeVariant] || colorPalettes.primary;

  // Build CTA links
  const primaryActionUrl = options.actionButton ? ensurePublicUrl(options.actionButton.url) : null;
  const secondaryActionUrl = options.secondaryActionButton ? ensurePublicUrl(options.secondaryActionButton.url) : null;

  // Build Details Table HTML
  let detailsTableHtml = '';
  if (options.detailsTable && options.detailsTable.length > 0) {
    const rowsHtml = options.detailsTable.map((row, idx) => {
      const isEven = idx % 2 === 0;
      const bg = isEven ? '#f8fafc' : '#ffffff';
      const valStyle = row.isCode
        ? 'font-family: Consolas, Monaco, "Courier New", monospace; font-size: 14px; font-weight: 700; color: ' + (row.color || '#0b2545') + ';'
        : row.isHighlight
        ? 'font-size: 14px; font-weight: 800; color: ' + (row.color || '#1e40af') + ';'
        : 'font-size: 13px; color: ' + (row.color || '#1e293b') + ';';

      return `
        <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 14px; width: 38%; font-weight: 600; color: #475569; font-size: 13px; vertical-align: top; border-right: 1px solid #e2e8f0;">
            ${escapeEmailHtml(row.label)}
          </td>
          <td style="padding: 10px 14px; ${valStyle} vertical-align: top;">
            ${row.value}
          </td>
        </tr>
      `;
    }).join('');

    detailsTableHtml = `
      <div style="margin: 22px 0 24px 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="background-color: #f1f5f9; padding: 10px 14px; border-bottom: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">
          Official Record Particulars
        </div>
        <table role="presentation" style="width: 100%; border-collapse: collapse; text-align: left;">
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Step Instructions HTML
  let stepsHtml = '';
  if (options.stepInstructions && options.stepInstructions.steps.length > 0) {
    const listItems = options.stepInstructions.steps.map(s => `
      <li style="margin-bottom: 8px; line-height: 1.5; color: #334155;">${s}</li>
    `).join('');

    stepsHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1e40af; border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
        <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
          ${escapeEmailHtml(options.stepInstructions.title || 'Required Next Steps')}
        </div>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px;">
          ${listItems}
        </ol>
      </div>
    `;
  }

  // Security Advisory
  let securityAdvisoryHtml = '';
  if (options.securityAdvisory !== false) {
    const customText = typeof options.securityAdvisory === 'string'
      ? options.securityAdvisory
      : 'Government of Odisha and JSG SMILE administrative officials will never solicit your login password, 2FA OTP, or DigiLocker PIN. Always confirm that the address bar displays the official HTTPS domain before submitting authentication credentials.';

    securityAdvisoryHtml = `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; border-radius: 6px; padding: 14px 16px; margin: 24px 0 16px 0; font-size: 12px; color: #92400e; line-height: 1.6;">
        <strong style="display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; color: #b45309;">
          🛡️ Statutory Security &amp; Anti-Fraud Advisory
        </strong>
        ${escapeEmailHtml(customText)}
      </div>
    `;
  }

  // Action Button HTML
  let actionButtonsHtml = '';
  if (options.actionButton && primaryActionUrl) {
    actionButtonsHtml = `
      <div style="text-align: center; margin: 28px 0 20px 0;">
        <table role="presentation" style="margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="background-color: #0b2545; border-radius: 6px; text-align: center;">
              <a href="${escapeEmailHtml(primaryActionUrl)}" style="background-color: #0b2545; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-block; border-radius: 6px; letter-spacing: 0.03em; border: 1px solid #081d3b;">
                ${escapeEmailHtml(options.actionButton.label)} &rarr;
              </a>
            </td>
            ${options.secondaryActionButton && secondaryActionUrl ? `
            <td style="padding-left: 12px;">
              <a href="${escapeEmailHtml(secondaryActionUrl)}" style="background-color: #ffffff; color: #0b2545; padding: 13px 24px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block; border-radius: 6px; border: 1px solid #cbd5e1;">
                ${escapeEmailHtml(options.secondaryActionButton.label)}
              </a>
            </td>` : ''}
          </tr>
        </table>
      </div>

      <!-- Raw Link Fallback Block for restricted mail clients -->
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 11px; color: #64748b; line-height: 1.5; word-break: break-all;">
        <span style="font-weight: 600; color: #475569;">Direct Portal Access URL:</span><br/>
        <a href="${escapeEmailHtml(primaryActionUrl)}" style="color: #1e40af; text-decoration: underline; font-family: monospace;">${escapeEmailHtml(primaryActionUrl)}</a>
      </div>
    `;
  }

  // Attachments note
  const attachmentsNoteHtml = options.attachmentsNote ? `
    <div style="background-color: #f1f5f9; border-radius: 6px; padding: 10px 14px; margin: 16px 0; font-size: 12px; color: #475569;">
      📎 <strong>Document Enclosure:</strong> ${escapeEmailHtml(options.attachmentsNote)}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeEmailHtml(options.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 640px; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); text-align: left;">
          
          <!-- Official Tiranga Accent Bar (100% email client compatible) -->
          <tr>
            <td style="padding: 0; line-height: 0; font-size: 0;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="height: 5px;">
                <tr>
                  <td width="33.33%" style="background-color: #FF9933; height: 5px;"></td>
                  <td width="33.34%" style="background-color: #FFFFFF; height: 5px;"></td>
                  <td width="33.33%" style="background-color: #138808; height: 5px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Official Government Header -->
          <tr>
            <td style="background-color: #07172e; padding: 26px 28px; text-align: center; border-bottom: 3px solid #c5a556;">
              <!-- Authority text -->
              <div style="font-size: 11px; font-weight: 800; color: #c5a556; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">
                ${escapeEmailHtml(departmentName)}
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.04em; text-transform: uppercase;">
                ${escapeEmailHtml(portalName)}
              </h1>
              <div style="margin-top: 6px; font-size: 11px; color: #94a3b8; letter-spacing: 0.05em;">
                Jharsuguda Synergy for MSME &amp; Industry Linkage Ecosystem • Official Gateway
              </div>
            </td>
          </tr>

          <!-- Official Dispatch Metadata Bar -->
          <tr>
            <td style="background-color: #0d233e; padding: 10px 24px; border-bottom: 1px solid #1e3a5f;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 11px; color: #cbd5e1;">
                <tr>
                  <td align="left" style="font-family: Consolas, Monaco, monospace; color: #e2e8f0;">
                    REF: <strong>${escapeEmailHtml(noticeRef)}</strong>
                  </td>
                  <td align="right" style="color: #94a3b8;">
                    ${dateTimeStr}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 32px 30px; background-color: #ffffff;">
              
              <!-- Notice Banner / Alert Card -->
              <div style="background-color: ${palette.bg}; border: 1px solid ${palette.border}; border-left: 4px solid ${palette.badgeBg}; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: ${palette.badgeBg}; color: ${palette.badgeText}; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 4px; margin-bottom: 8px;">
                  ${escapeEmailHtml(noticeType)}
                </div>
                <h2 style="margin: 4px 0 0 0; color: ${palette.title}; font-size: 18px; font-weight: 800; line-height: 1.4;">
                  ${escapeEmailHtml(options.heading)}
                </h2>
              </div>

              <!-- Salutation -->
              <div style="font-size: 14px; font-weight: 700; color: #0b2545; margin-bottom: 14px;">
                Dear ${escapeEmailHtml(recipientName)},
              </div>

              <!-- Executive Summary -->
              ${options.summary ? `
              <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 18px 0;">
                ${escapeEmailHtml(options.summary)}
              </p>` : ''}

              <!-- Body HTML (if provided) -->
              ${options.bodyHtml ? `
              <div style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 18px 0;">
                ${options.bodyHtml}
              </div>` : ''}

              <!-- Enclosure Note -->
              ${attachmentsNoteHtml}

              <!-- Particulars Table -->
              ${detailsTableHtml}

              <!-- Next Steps / Instructions -->
              ${stepsHtml}

              <!-- Call To Action -->
              ${actionButtonsHtml}

              <!-- Security Notice -->
              ${securityAdvisoryHtml}

              <!-- Closing Sign-off -->
              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #475569; line-height: 1.5;">
                <strong>Procurement &amp; MSME Linkage Desk</strong><br/>
                District Administration Jharsuguda, Government of Odisha<br/>
                <span style="font-size: 11px; color: #64748b;">Inquiries: <a href="mailto:${escapeEmailHtml(helpdeskEmail)}" style="color: #1e40af; text-decoration: none;">${escapeEmailHtml(helpdeskEmail)}</a></span>
              </div>

            </td>
          </tr>

          <!-- Official Statutory Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 22px 28px; text-align: center; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b; line-height: 1.6;">
              <div style="font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                Official Digital Gateway • Government of Odisha
              </div>
              <div>
                Collectorate Complex, Jharsuguda, Odisha - 768204 • Helpline: 1800-345-6789
              </div>
              <div style="margin-top: 10px; font-size: 10px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
                CONFIDENTIALITY NOTICE: This transmission is intended solely for the designated recipient and may contain privileged, sensitive, or statutory procurement data. Any unauthorized interception or copying is strictly prohibited under the Information Technology Act. If you received this in error, notify the administrator immediately and delete this communication.
              </div>
              <div style="margin-top: 8px; font-size: 10px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} JSG SMILE • District Administration Jharsuguda. All Rights Reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};
