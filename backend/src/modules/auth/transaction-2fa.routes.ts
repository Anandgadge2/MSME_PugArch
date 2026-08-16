import { Router } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { transaction2faService } from '../../services/transaction-2fa.service.js';
import { handleSecureRouteError } from '../../utils/routeHelpers.js';
import { maskSensitive } from '../../utils/maskSensitive.js';

const router = Router();

const sendOtpSchema = z.object({
  actionType: z.string().trim().min(2).max(80),
  amount: z.coerce.number().nonnegative().optional(),
  orderId: z.union([z.coerce.number().int().positive(), z.string().trim().max(80)]).optional(),
  channel: z.enum(['email', 'sms']).optional(),
  description: z.string().trim().max(500).optional()
});

const verifyOtpSchema = z.object({
  actionType: z.string().trim().min(2).max(80),
  otp: z.string().trim().length(6, 'OTP must be 6 digits'),
  amount: z.coerce.number().nonnegative().optional(),
  orderId: z.union([z.coerce.number().int().positive(), z.string().trim().max(80)]).optional()
});

const actorFrom = (req: AuthRequest) => ({
  id: Number(req.user?.id),
  role: String(req.user?.role || ''),
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});

/**
 * POST /api/2fa/transaction/send-otp
 * Triggers dispatch of a 6-digit transaction 2FA code
 */
router.post('/send-otp', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = sendOtpSchema.parse(req.body);
    const result = await transaction2faService.sendTransactionOtp(actorFrom(req), parsed);
    res.json(maskSensitive({ success: true, data: result }));
  } catch (error) {
    return handleSecureRouteError(res, error, 'Failed to send transaction 2FA OTP');
  }
});

/**
 * POST /api/2fa/transaction/verify-otp
 * Verifies the 6-digit transaction 2FA code
 */
router.post('/verify-otp', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = verifyOtpSchema.parse(req.body);
    const result = await transaction2faService.verifyTransactionOtp(actorFrom(req), parsed);
    res.json(maskSensitive({ success: true, data: result }));
  } catch (error) {
    return handleSecureRouteError(res, error, '2FA verification failed');
  }
});

export default router;
