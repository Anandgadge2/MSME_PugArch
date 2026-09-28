/**
 * compress-logos.mjs — Compresses oversized PNG logos in frontend/public/
 *
 * The original 1254×1254 PNGs are ~1.25 MB each.
 * This script creates properly-sized versions:
 * - favicon.png: 64×64 PNG (~3 KB)
 * - logoo.png, logo.png, msme-logo.png: 256×256 PNG (~15 KB)
 *
 * Run from the project root: node frontend/scripts/compress-logos.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

const configs = [
  { file: 'favicon.png', size: 64 },
  { file: 'logoo.png', size: 256 },
  { file: 'logo.png', size: 256 },
  { file: 'msme-logo.png', size: 256 },
];

async function compress() {
  for (const { file, size } of configs) {
    const filePath = path.join(publicDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${file} (not found)`);
      continue;
    }

    const stat = fs.statSync(filePath);
    const originalKB = (stat.size / 1024).toFixed(1);

    // Back up original
    const backupPath = filePath + '.original';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }

    // Compress
    const buffer = await sharp(filePath + '.original')
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(filePath, buffer);

    const newKB = (buffer.length / 1024).toFixed(1);
    const savings = ((1 - buffer.length / stat.size) * 100).toFixed(1);
    console.log(`✅ ${file}: ${originalKB} KB → ${newKB} KB (${savings}% reduction, ${size}×${size}px)`);
  }

  console.log('\n🎉 Logo compression complete!');
}

compress().catch(console.error);
