import pino from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: isProduction ? undefined : { service: 'msme-backend' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.otp',
      'req.body.pan',
      'req.body.aadhaar',
      'req.body.accountNumber',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey'
    ],
    censor: '[REDACTED]'
  }
});
