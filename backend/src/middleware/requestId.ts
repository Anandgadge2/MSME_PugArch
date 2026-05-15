import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const incomingId = req.headers['x-request-id'];
  req.id = Array.isArray(incomingId) ? incomingId[0] : incomingId || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
