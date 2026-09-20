import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: req => req.id,
  autoLogging: {
    ignore: req => {
      const url = String(req.originalUrl || req.url || '');
      return url.startsWith('/api/notifications/stream');
    }
  },
  customLogLevel: (req: any, res: any) => {
    const url = String(req.originalUrl || req.url || '');
    const path = String(req.path || req.baseUrl || '');
    const target = `${url} ${path}`;
    if (
      (res.statusCode === 401 &&
        (target.includes('/auth/me') ||
          target.includes('/me') ||
          target.includes('/auth/refresh') ||
          target.includes('/refresh') ||
          target.includes('/auth/logout') ||
          target.includes('/logout') ||
          target.includes('/navigation/summary') ||
          target.includes('/notifications'))) ||
      (res.statusCode === 426 && (target.includes('/ws') || target.startsWith('/api/ws')))
    ) {
      return 'silent';
    }
    if (res.statusCode === 404 && (target.includes('favicon.ico') || target.includes('favicon.png'))) {
      return 'silent';
    }
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: req => ({
    context: 'HTTP',
    actorId: (req as any).user?.id,
    actorRole: (req as any).user?.role
  }),
  customSuccessMessage: (req: any, res: any, responseTime: number) => {
    const statusText = res.statusMessage ? ` ${res.statusMessage}` : '';
    return `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode}${statusText} (${Math.round(responseTime)}ms)`;
  },
  customErrorMessage: (req: any, res: any, err: Error) => {
    const statusText = res.statusMessage ? ` ${res.statusMessage}` : '';
    return `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode}${statusText} - ${err.message}`;
  },
  serializers: {
    req(req) {
      if (process.env.NODE_ENV === 'production') {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          remotePort: req.remotePort
        };
      }
      return undefined;
    },
    res(res) {
      if (process.env.NODE_ENV === 'production') {
        return {
          statusCode: res.statusCode
        };
      }
      return undefined;
    }
  }
});

