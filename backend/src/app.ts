import cors from 'cors';
import express from 'express';
import { corsOptions } from './config/cors.js';
import { applySecurityMiddleware } from './config/security.js';

export const createApp = () => {
  const app = express();

  app.use(cors(corsOptions));
  applySecurityMiddleware(app);

  return app;
};
