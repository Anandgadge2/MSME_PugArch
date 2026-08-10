import pino from 'pino';
import { createRequire } from 'module';
import { env, isProduction } from './env.js';

const require = createRequire(import.meta.url);

let canUsePinoPretty = false;
if (!isProduction && !process.env.VERCEL && !process.env.VERCEL_ENV) {
  try {
    require.resolve('pino-pretty');
    canUsePinoPretty = true;
  } catch {
    canUsePinoPretty = false;
  }
}

const loggerOptions: pino.LoggerOptions = {
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
};

if (canUsePinoPretty) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname,service'
    }
  };
}

export const logger = pino(loggerOptions);


