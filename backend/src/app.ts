import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { corsOptions, preflightCors } from './config/cors.js';
import { applySecurityMiddleware } from './config/security.js';
import apiRouter from './routes/index.js';

export const createApp = () => {
  const app = express();

  app.use(preflightCors);
  app.use(cors(corsOptions));
  applySecurityMiddleware(app);

  // Explicitly block direct unauthenticated access to sensitive documents and private uploads
  app.use(['/uploads/documents', '/uploads/private'], (_req, res) => {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED_ACCESS',
        message: 'Direct static access to sensitive documents is prohibited. Please access files via authenticated /api/files endpoints.'
      }
    });
  });

  const staticAssetOptions = {
    maxAge: '1d',
    setHeaders: (res: express.Response) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  };

  // Serve static public uploads directory for local storage fallback
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), staticAssetOptions));
  app.use('/org-logos', express.static(path.resolve(process.cwd(), 'uploads/org-logos'), staticAssetOptions));
  app.use('/banners', express.static(path.resolve(process.cwd(), 'uploads/banners'), staticAssetOptions));
  app.use('/products', express.static(path.resolve(process.cwd(), 'uploads/products'), staticAssetOptions));
  app.use('/company-logos', express.static(path.resolve(process.cwd(), 'uploads/company-logos'), staticAssetOptions));

  // Serve category photos from frontend/public or uploads directory
  const frontendCategoryPhotos = path.resolve(process.cwd(), '../frontend/public/category-photos');
  const localCategoryPhotos = path.resolve(process.cwd(), 'uploads/category-photos');
  if (fs.existsSync(frontendCategoryPhotos)) {
    app.use('/category-photos', express.static(frontendCategoryPhotos, staticAssetOptions));
  } else if (fs.existsSync(localCategoryPhotos)) {
    app.use('/category-photos', express.static(localCategoryPhotos, staticAssetOptions));
  }

  // Serve inline transparent favicon to avoid browser 404s
  const faviconBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  app.get('/favicon.ico', (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': faviconBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(faviconBuffer);
  });
  app.get('/favicon.png', (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': faviconBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(faviconBuffer);
  });

  // Static uploads directory
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // Unified API Routing layer
  app.use('/api', apiRouter);

  return app;
};

