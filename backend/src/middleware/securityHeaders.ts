import helmet from 'helmet';

export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: {
    maxAge: 15552000,
    includeSubDomains: true,
    preload: false
  }
});
