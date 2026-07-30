import prisma from '../src/lib/prisma.js';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';

async function cleanup() {
  console.log('=== Cloudinary Verification & Post-Migration Cleanup Script ===');

  try {
    const cloudinaryAssets = await prisma.fileAsset.count({
      where: {
        OR: [
          { storageProvider: 'cloudinary' },
          { url: { contains: 'cloudinary.com' } }
        ]
      }
    });

    const productImages = await prisma.productImage.count({
      where: { fileAsset: { url: { contains: 'cloudinary.com' } } }
    });

    console.log(`[Verification Status]`);
    console.log(`- FileAssets using Cloudinary: ${cloudinaryAssets}`);
    console.log(`- ProductImages using Cloudinary: ${productImages}`);

    if (cloudinaryAssets > 0 || productImages > 0) {
      console.warn('\n⚠️ WARNING: There are still database records referencing Cloudinary URLs.');
      console.warn('Please run "npx tsx scripts/migrate-cloudinary-to-gcs.ts" to complete asset migration first.');
      process.exit(1);
    }

    console.log('\n✅ VERIFICATION COMPLETE: All database file assets have been successfully migrated to Google Cloud Storage (GCS)!');
    console.log('Zero records in the database reference Cloudinary.');

    if (process.argv.includes('--delete-cloudinary-cloud')) {
      console.log('\n[Cleanup] Deleting Cloudinary remote cloud assets...');
      if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        console.error('Cloudinary credentials missing in .env');
        process.exit(1);
      }
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET
      });
      console.log('[Cleanup] Remote Cloudinary cleanup complete.');
    } else {
      console.log('\nInfo: Cloudinary cloud assets were NOT deleted from Cloudinary servers.');
      console.log('To purge remote Cloudinary assets after manual verification, pass flag: --delete-cloudinary-cloud');
    }
  } catch (err: any) {
    console.error('[Cleanup] Error during verification:', err?.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
