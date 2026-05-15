import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ZodError } from 'zod';
import { apiResponse } from '../utils/apiResponse.js';

type RequestSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

export const validate = (schemas: RequestSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as any;
      if (schemas.query) req.query = schemas.query.parse(req.query) as any;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return apiResponse.error(res, 400, 'Request validation failed', 'VALIDATION_ERROR', error.flatten());
      }
      return next(error);
    }
  };
};
