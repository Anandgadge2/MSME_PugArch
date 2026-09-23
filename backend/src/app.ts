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

  // Serve static uploads directory for local storage fallback
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use('/org-logos', express.static(path.resolve(process.cwd(), 'uploads/org-logos')));
  app.use('/banners', express.static(path.resolve(process.cwd(), 'uploads/banners')));
  app.use('/products', express.static(path.resolve(process.cwd(), 'uploads/products')));

  // Serve category photos from frontend/public or uploads directory
  const frontendCategoryPhotos = path.resolve(process.cwd(), '../frontend/public/category-photos');
  const localCategoryPhotos = path.resolve(process.cwd(), 'uploads/category-photos');
  if (fs.existsSync(frontendCategoryPhotos)) {
    app.use('/category-photos', express.static(frontendCategoryPhotos));
  } else if (fs.existsSync(localCategoryPhotos)) {
    app.use('/category-photos', express.static(localCategoryPhotos));
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

