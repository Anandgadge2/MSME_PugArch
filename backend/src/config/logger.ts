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
      'req.body.gstin',
      'req.body.ifsc',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.pan',
      '*.aadhaar',
      '*.gstin',
      '*.accountNumber',
      '*.ifsc'
    ],
    censor: '[REDACTED]'
  }
};

if (canUsePinoPretty) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname,service,context',
      singleLine: true,
      messageFormat: '{if context}[{context}] {end}{msg}'
    }
  };
}

export const logger = pino(loggerOptions);

/**
 * Creates a scoped child logger with an attached context namespace
 * e.g. createChildLogger('Database') -> logs will display [Database] prefix
 */
export const createChildLogger = (context: string) => logger.child({ context });



