import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import prisma from '../src/lib/prisma.js';
import { configureGCS } from '../src/config/gcs.js';
import { gcpStorageProvider } from '../src/services/storage/gcp-storage.service.js';
import { mapEntityTypeToFolder } from '../src/services/storage/storage-folders.enum.js';
import { logger } from '../src/config/logger.js';

// Cloudinary client fallback definition (Cloudinary was deprecated in favor of GCP Storage)
const cloudinary: any = {
  utils: {
    download_archive_url: (options: any) => {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
      return `https://api.cloudinary.com/v1_1/${cloudName}/image/download_zip?public_ids=${options.public_ids?.join(',')}`;
    }
  }
};

interface MigrationProgressReport {
  timestamp: string;
  totalAssetsFound: number;
  migratedSuccess: number;
  skippedAlreadyMigrated: number;
  failedCount: number;
  failedItems: Array<{ id: number; url: string; error: string }>;
}

const BATCH_CONCURRENCY = 3;
const MAX_RETRIES = 3;

const isCloudinaryUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
};

const fetchWithRetry = async (url: string, assetKey?: string, mimeType?: string, retries = MAX_RETRIES): Promise<Buffer> => {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      // Step A: Attempt direct HTTP fetch
      const res = await fetch(url);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }

      // Step B: If 401 and assetKey exists, fetch via Cloudinary authenticated zip archive
      if (res.status === 401 && assetKey) {
        console.log(`[Migrate] 401 encountered for ${assetKey}, fetching via Cloudinary archive API...`);
        const resourceType = mimeType?.startsWith('image/') ? 'image' : 'raw';
        const archiveUrl = cloudinary.utils.download_archive_url({
          public_ids: [assetKey],
          resource_type: resourceType,
          type: 'authenticated',
          target_format: 'zip'
        });

        const archiveRes = await fetch(archiveUrl);
        if (archiveRes.ok) {
          const zipBuffer = Buffer.from(await archiveRes.arrayBuffer());
          const zip = new AdmZip(zipBuffer);
          const entries = zip.getEntries();
          if (entries.length > 0) {
            return entries[0].getData();
          }
        }
      }

      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Migrate] Retry ${i + 1}/${retries} failed for ${assetKey || url}: ${err?.message || err}`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastError;
};

const getExtensionFromMimeOrUrl = (mimeType: string, url: string): string => {
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  const urlExt = path.extname(url.split('?')[0]);
  return urlExt || '.bin';
};

async function runMigration() {
  console.log('=== Cloudinary to Google Cloud Storage (GCS) Data Migration ===');
  await configureGCS();
  const startTime = new Date().toISOString();
  
  const report: MigrationProgressReport = {
    timestamp: startTime,
    totalAssetsFound: 0,
    migratedSuccess: 0,
    skippedAlreadyMigrated: 0,
    failedCount: 0,
    failedItems: []
  };

  try {
    // 1. Fetch FileAsset records that use Cloudinary or have Cloudinary URLs
    const fileAssets = await prisma.fileAsset.findMany({
      where: {
        OR: [
          { storageProvider: 'cloudinary' },
          { url: { contains: 'cloudinary.com' } }
        ]
      }
    });

    report.totalAssetsFound = fileAssets.length;
    console.log(`[Migrate] Found ${fileAssets.length} FileAsset records to migrate.`);

    for (let i = 0; i < fileAssets.length; i += BATCH_CONCURRENCY) {
      const batch = fileAssets.slice(i, i + BATCH_CONCURRENCY);
      await Promise.all(
        batch.map(async (asset) => {
          if (asset.storageProvider === 'gcp' && !isCloudinaryUrl(asset.url)) {
            report.skippedAlreadyMigrated++;
            return;
          }

          const targetUrl = asset.url;
          if (!targetUrl || !isCloudinaryUrl(targetUrl)) {
            console.log(`[Migrate] Asset ${asset.id} missing valid Cloudinary URL, skipping.`);
            report.skippedAlreadyMigrated++;
            return;
          }

          try {
            console.log(`[Migrate] Processing asset ${asset.id} (${asset.originalName || asset.key})...`);
            
            // 2. Download asset from Cloudinary (with authenticated archive fallback)
            const fileBuffer = await fetchWithRetry(targetUrl, asset.key, asset.mimeType);

            // 3. Integrity verification
            const downloadedChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            const downloadedSize = fileBuffer.length;

            const folderName = mapEntityTypeToFolder(asset.entityType);
            const folder = `${folderName}/${asset.ownerId}`;
            const ext = getExtensionFromMimeOrUrl(asset.mimeType, targetUrl);
            const secureKey = asset.key.includes('/')
              ? asset.key
              : `${crypto.randomUUID()}${ext}`;

            // 4. Upload to GCS bucket (jsgsmile1)
            const gcsResult = await gcpStorageProvider.uploadBuffer(fileBuffer, secureKey, {
              folder,
              mimeType: asset.mimeType,
              originalName: asset.originalName,
              metadata: {
                legacyCloudinaryUrl: targetUrl,
                originalFileAssetId: String(asset.id)
              }
            });

            // 5. Update Database Record
            await prisma.fileAsset.update({
              where: { id: asset.id },
              data: {
                storageProvider: 'gcp',
                bucket: gcsResult.bucket,
                key: gcsResult.key,
                url: gcsResult.url,
                checksum: downloadedChecksum,
                size: downloadedSize,
                storageProviderEnum: 'GCP'
              }
            });

            await prisma.$executeRawUnsafe(
              `UPDATE "FileAsset" SET "bucketName" = $1, "objectName" = $2, "fileUrl" = $3 WHERE id = $4`,
              gcsResult.bucket,
              gcsResult.key,
              gcsResult.url,
              asset.id
            );

            report.migratedSuccess++;
            console.log(`[Migrate] ✅ Successfully migrated asset ${asset.id} -> GCS key: ${gcsResult.key}`);
          } catch (err: any) {
            report.failedCount++;
            report.failedItems.push({
              id: asset.id,
              url: targetUrl,
              error: err?.message || String(err)
            });
            console.error(`[Migrate] ❌ Failed asset ${asset.id}: ${err?.message || err}`);
          }
        })
      );
    }

    // 6. Generate Migration Report File
    const reportPath = path.resolve(process.cwd(), 'migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n=== MIGRATION SUMMARY REPORT ===');
    console.log(`Total Found:            ${report.totalAssetsFound}`);
    console.log(`Successfully Migrated: ${report.migratedSuccess}`);
    console.log(`Already Migrated:      ${report.skippedAlreadyMigrated}`);
    console.log(`Failed:                ${report.failedCount}`);
    console.log(`Migration report saved to ${reportPath}`);
  } catch (error: any) {
    console.error('[Migrate] Fatal migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
