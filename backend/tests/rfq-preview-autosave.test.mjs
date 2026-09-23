import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const backendSrc = path.resolve(process.cwd(), 'src');
const frontendSrc = path.resolve(process.cwd(), '../frontend/src');

test('1. Backend /upload returns viewUrl to guarantee proxy accessibility for all uploaded assets', () => {
  const phase4Content = fs.readFileSync(path.join(backendSrc, 'routes/phase4.routes.ts'), 'utf8');
  assert.match(phase4Content, /router\.post\('\/upload'/);
  assert.match(phase4Content, /const viewUrl = `\/api\/files\/\$\{asset\.id\}\/view`;/);
  // Ensure we do NOT return private GCS bucket URL
  assert.doesNotMatch(phase4Content, /const publicUrl = isImage && asset\.url && \/\^https\?:/);
});

test('2. Backend /files/raw/:key includes db.fileAsset lookup fallback for resilient streaming', () => {
  const phase4Content = fs.readFileSync(path.join(backendSrc, 'routes/phase4.routes.ts'), 'utf8');
  assert.match(phase4Content, /router\.get\('\/files\/raw\/:key\(\*\)'/);
  assert.match(phase4Content, /db\.fileAsset\.findFirst/);
  assert.match(phase4Content, /getFileContent\(asset\.id, publicActor/);
});

test('3. SubmitQuotationPage strictly disables automatic background draft saving', () => {
  const submitPage = fs.readFileSync(path.join(frontendSrc, 'features/rfq/pages/SubmitQuotationPage.tsx'), 'utf8');
  // Confirm auto-save timer ref and auto-save useEffect are absent
  assert.doesNotMatch(submitPage, /autoSaveTimerRef/);
  assert.doesNotMatch(submitPage, /autoSaveTimerRef\.current = setTimeout/);
  assert.doesNotMatch(submitPage, /\/\/ Auto-save on field changes/);
  // Confirm savingDraft state exists and guards manual saving
  assert.match(submitPage, /const \[savingDraft, setSavingDraft\] = useState\(false\);/);
  assert.match(submitPage, /disabled=\{submitting \|\| savingDraft \|\| isReadOnly\}/);
});

test('4. SubmitQuotationPage UploadState records asset ID and local file blob previews', () => {
  const submitPage = fs.readFileSync(path.join(frontendSrc, 'features/rfq/pages/SubmitQuotationPage.tsx'), 'utf8');
  assert.match(submitPage, /id\?: number \| string;/);
  assert.match(submitPage, /fileAssetId\?: number \| null;/);
  assert.match(submitPage, /if \(item\.file instanceof File\) \{/);
  assert.match(submitPage, /const blobUrl = URL\.createObjectURL\(item\.file\);/);
});

test('5. DocumentPreviewModal implements resilient authenticated fallback on image errors', () => {
  const modalContent = fs.readFileSync(path.join(frontendSrc, 'components/DocumentPreviewModal.tsx'), 'utf8');
  assert.match(modalContent, /handleImageError/);
  assert.match(modalContent, /api\.fetch\(targetUrl/);
  assert.match(modalContent, /URL\.createObjectURL\(blob\)/);
  assert.match(modalContent, /imageLoadError/);
  assert.match(modalContent, /Direct Image Preview Unavailable/);
});

test('6. Frontend files.ts prioritizes local files and streams viewEndpoint blobs', () => {
  const filesContent = fs.readFileSync(path.join(frontendSrc, 'lib/files.ts'), 'utf8');
  assert.match(filesContent, /if \(fileAsset\?\.file instanceof File\) \{/);
  assert.match(filesContent, /URL\.createObjectURL\(fileAsset\.file\)/);
  assert.match(filesContent, /const blobUrl = URL\.createObjectURL\(blob\);/);
});
