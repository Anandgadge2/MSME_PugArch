import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBackend = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readFrontend = relativePath => readFileSync(new URL(`../../frontend/${relativePath}`, import.meta.url), 'utf8');

test('Admin Notice Circular & Mass Broadcast Suite', async (t) => {
  await t.test('1. Backend notice-circular.routes.ts implements all required endpoints and security', () => {
    const code = readBackend('src/routes/notice-circular.routes.ts');
    
    // Role restriction
    assert.match(code, /authorize\('admin',\s*'master_admin'\)/, 'Must restrict broadcast to admin and master_admin');
    
    // Live recipient counts endpoint
    assert.match(code, /router\.get\('\/admin\/notices\/recipient-counts'/, 'Must provide live recipient counts endpoint');
    assert.match(code, /all:/, 'Must return all users count');
    assert.match(code, /sellers:/, 'Must return sellers count');
    assert.match(code, /shg:/, 'Must return shg count');
    assert.match(code, /buyers:/, 'Must return buyers count');
    
    // Broadcast endpoint
    assert.match(code, /router\.post\('\/admin\/notices\/broadcast'/, 'Must provide broadcast endpoint');
    assert.match(code, /targetAudience:\s*z\.enum\(\['ALL_USERS',\s*'SELLERS_ONLY',\s*'SHG_ONLY',\s*'BUYERS_ONLY'\]\)/, 'Must validate target audience');
    assert.match(code, /channels:\s*z\.array\(z\.enum\(\['in_app',\s*'email',\s*'sms'\]\)\)/, 'Must validate delivery channels');
    assert.match(code, /buildGovernmentGradeEmailHtml\(/, 'Must construct government-grade HTML email');
    assert.match(code, /type:\s*'OFFICIAL_NOTICE_CIRCULAR'/, 'Must dispatch notification with OFFICIAL_NOTICE_CIRCULAR type');
    assert.match(code, /auditLog\(/, 'Must log audit event for administrative broadcast');

    // Pop-up endpoints
    assert.match(code, /router\.get\('\/notices\/active-popup'/, 'Must provide endpoint to fetch unread popup notices for logged in user');
    assert.match(code, /router\.post\('\/notices\/:id\/acknowledge'/, 'Must provide endpoint to acknowledge and dismiss popup notice');
  });

  await t.test('2. Backend routes index.ts mounts noticeCircularRoutes', () => {
    const indexCode = readBackend('src/routes/index.ts');
    assert.match(indexCode, /import noticeCircularRoutes from '\.\/notice-circular\.routes\.js'/, 'Must import noticeCircularRoutes');
    assert.match(indexCode, /router\.use\('\/',\s*noticeCircularRoutes\)/, 'Must mount noticeCircularRoutes');
  });

  await t.test('3. Frontend mounts TargetedNoticePopup in App.tsx for logged-in users', () => {
    const appCode = readFrontend('src/App.tsx');
    assert.match(appCode, /import\('\.\/features\/notifications\/TargetedNoticePopup'\)/, 'App.tsx must lazy-import TargetedNoticePopup');
    assert.match(appCode, /<TargetedNoticePopup\s*\/>/, 'App.tsx must render TargetedNoticePopup for authenticated users');
  });

  await t.test('4. Frontend MasterAdminPage.tsx integrates AdminNoticeCircularModal with Broadcast button', () => {
    const adminCode = readFrontend('src/features/masterAdmin/pages/MasterAdminPage.tsx');
    assert.match(adminCode, /import AdminNoticeCircularModal from '\.\.\/components\/AdminNoticeCircularModal'/, 'Must import AdminNoticeCircularModal');
    assert.match(adminCode, /isNoticeModalOpen/, 'Must maintain modal open state');
    assert.match(adminCode, /Broadcast Notice/, 'Must render Broadcast Notice button');
    assert.match(adminCode, /<AdminNoticeCircularModal/, 'Must render AdminNoticeCircularModal component');
  });

  await t.test('5. TargetedNoticePopup.tsx implements centered popup with accessibility and acknowledgment', () => {
    const popupCode = readFrontend('src/features/notifications/TargetedNoticePopup.tsx');
    assert.match(popupCode, /role="dialog"/, 'Must have dialog role');
    assert.match(popupCode, /aria-modal="true"/, 'Must have aria-modal');
    assert.match(popupCode, /FocusTrap/, 'Must trap focus for accessibility');
    assert.match(popupCode, /fixed inset-0 z-\[100\] flex items-center justify-center/, 'Must center popup in screen');
    assert.match(popupCode, /postApi\(`\/api\/notices\/\$\{notice\.id\}\/acknowledge`/, 'Must acknowledge notice on dismissal');
    assert.match(popupCode, /I Acknowledge & Dismiss/, 'Must provide clear acknowledgment CTA');
  });

  await t.test('6. AdminNoticeCircularModal.tsx provides multi-audience selector and live preview', () => {
    const modalCode = readFrontend('src/features/masterAdmin/components/AdminNoticeCircularModal.tsx');
    assert.match(modalCode, /ALL_USERS/, 'Must support All Users');
    assert.match(modalCode, /SELLERS_ONLY/, 'Must support Sellers Only');
    assert.match(modalCode, /SHG_ONLY/, 'Must support SHG Clusters Only');
    assert.match(modalCode, /BUYERS_ONLY/, 'Must support Buyers Only');
    assert.match(modalCode, /\/api\/admin\/notices\/recipient-counts/, 'Must fetch live recipient counts from DB');
    assert.match(modalCode, /\/api\/admin\/notices\/broadcast/, 'Must post to broadcast endpoint');
    assert.match(modalCode, /Show Live Pop-up & Email Preview/, 'Must include live preview mode');
  });
});
