import type { Request, Response } from 'express';
import { apiResponse } from '../../utils/apiResponse.js';

export const authController = {
  health(_req: Request, res: Response) {
    return apiResponse.success(res, { module: 'auth' });
  }
};
