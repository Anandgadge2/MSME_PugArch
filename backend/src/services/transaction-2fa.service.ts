import prisma from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOtp, storeOtp, verifyOtp, consumeOtp } from './otp.service.js';
import { sendOtpEmail } from './mail.service.js';
import { smsService } from './sms.service.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { maskSensitive } from '../utils/maskSensitive.js';

export interface TransactionActor {
  id: number;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SendTransactionOtpInput {
  actionType: string;
  amount?: number;
  orderId?: number | string;
  channel?: 'email' | 'sms';
  description?: string;
}

export interface VerifyTransactionOtpInput {
  actionType: string;
  otp: string;
  amount?: number;
  orderId?: number | string;
}

const formatActionName = (actionType: string): string => {
  return actionType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
};

const maskEmail = (email: string): string => {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 3))}${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
};

const maskMobile = (mobile: string): string => {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(1, digits.length - 4))}${digits.slice(-2)}`;
};

export const transaction2faService = {
  /**
   * Generates and dispatches a transaction-bound OTP via email or SMS.
   */
  async sendTransactionOtp(actor: TransactionActor, input: SendTransactionOtpInput) {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        mobile: true,
        mobileVerified: true,
        name: true,
        role: true,
        preferredOtpChannel: true,
        twoFactorChannel: true
      }
    });

    if (!user) throw new ApiError(404, 'User account not found', 'USER_NOT_FOUND');

    const actionLabel = formatActionName(input.actionType);
    const amountLabel = input.amount !== undefined ? ` ₹${Number(input.amount).toLocaleString('en-IN')}` : '';
    const orderLabel = input.orderId ? ` for Order #${input.orderId}` : '';

    // Determine channel (Email vs SMS)
    const configuredChannel = input.channel || (user as any).twoFactorChannel || (user as any).preferredOtpChannel || 'email';
    const canUseSms = Boolean(user.mobileVerified && user.mobile && smsService.isEnabled());
    let channel: 'email' | 'sms' = configuredChannel === 'sms' && canUseSms ? 'sms' : 'email';
    let identity = channel === 'sms' && user.mobile ? user.mobile : user.email;

    const otp = generateOtp();
    const metadata = {
      userId: user.id,
      actionType: input.actionType,
      amount: input.amount,
      orderId: input.orderId,
      channel,
      description: input.description
    };

    // Store OTP in database/Redis with 10-min TTL
    await storeOtp('transaction_2fa', identity, otp, metadata, channel);

    const emailSubject = `[SECURITY 2FA] Authorize ${actionLabel}${amountLabel}`;
    let deliverySuccess = false;

    if (channel === 'sms' && user.mobile) {
      const smsRes = await smsService.sendOtpSms(user.mobile, otp, 'common_otp');
      deliverySuccess = smsRes.success;
      if (!deliverySuccess) {
        // Fallback to email
        channel = 'email';
        identity = user.email;
        await storeOtp('transaction_2fa', identity, otp, metadata, channel);
        deliverySuccess = await sendOtpEmail(user.email, otp, emailSubject);
      }
    } else {
      deliverySuccess = await sendOtpEmail(user.email, otp, emailSubject);
    }

    void auditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'transaction.2fa.otp_sent',
      entityType: 'transaction2fa',
      entityId: user.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: {
        actionType: input.actionType,
        orderId: input.orderId,
        amount: input.amount,
        channel,
        deliverySuccess
      }
    }).catch(() => undefined);

    const maskedDestination = channel === 'sms' && user.mobile ? maskMobile(user.mobile) : maskEmail(user.email);

    return {
      success: true,
      channel,
      destination: maskedDestination,
      message: `2FA verification code sent to ${maskedDestination}`,
      actionType: input.actionType,
      orderId: input.orderId,
      amount: input.amount
    };
  },

  /**
   * Verifies the submitted OTP against stored transaction metadata.
   */
  async verifyTransactionOtp(actor: TransactionActor, input: VerifyTransactionOtpInput) {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        mobile: true,
        role: true
      }
    });

    if (!user) throw new ApiError(404, 'User account not found', 'USER_NOT_FOUND');

    const cleanOtp = String(input.otp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      throw new ApiError(400, 'Please enter a valid 6-digit OTP', 'OTP_INVALID_FORMAT');
    }

    // Try verifying on primary email
    let verification = await verifyOtp('transaction_2fa', user.email, cleanOtp);
    let usedIdentity = user.email;

    // Try mobile if email didn't match and mobile exists
    if (!verification.valid && user.mobile) {
      const mobileVerification = await verifyOtp('transaction_2fa', user.mobile, cleanOtp);
      if (mobileVerification.valid) {
        verification = mobileVerification;
        usedIdentity = user.mobile;
      }
    }

    if (!verification.valid) {
      void auditLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'transaction.2fa.failed',
        entityType: 'transaction2fa',
        entityId: user.id,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        metadata: {
          actionType: input.actionType,
          orderId: input.orderId,
          amount: input.amount,
          reason: verification.reason
        }
      }).catch(() => undefined);

      throw new ApiError(400, verification.reason || 'Invalid or expired 2FA code', 'OTP_VERIFICATION_FAILED');
    }

    // Consume OTP so it cannot be re-used
    await consumeOtp('transaction_2fa', usedIdentity);

    void auditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'transaction.2fa.verified',
      entityType: 'transaction2fa',
      entityId: user.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      metadata: {
        actionType: input.actionType,
        orderId: input.orderId,
        amount: input.amount
      }
    }).catch(() => undefined);

    return {
      verified: true,
      actionType: input.actionType,
      verifiedAt: new Date()
    };
  }
};
