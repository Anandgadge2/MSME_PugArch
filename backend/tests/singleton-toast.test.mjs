import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Providers.tsx enforces singleton visibleToasts={1} to prevent deck stacking', () => {
  const source = read('../frontend/src/providers/Providers.tsx');
  assert.match(source, /<Toaster[^>]*visibleToasts=\{1\}/);
  assert.doesNotMatch(source, /visibleToasts=\{[2-9]\}/);
});

test('Login.tsx purges lingering toasts on primary credential submission', () => {
  const source = read('../frontend/src/views/Login.tsx');
  const submitBlock = source.slice(source.indexOf('const handleSubmit = async'), source.indexOf('const handleTwoFactorSubmit'));
  assert.match(submitBlock, /toast\.dismiss\(\);\s*const loadToast = toast\.loading/);
});

test('Login.tsx purges lingering toasts on two-factor code submission', () => {
  const source = read('../frontend/src/views/Login.tsx');
  const twoFactorBlock = source.slice(source.indexOf('const handleTwoFactorSubmit = async'), source.indexOf('const activePill'));
  assert.match(twoFactorBlock, /toast\.dismiss\(\);\s*const loadToast = toast\.loading/);
});

test('Login.tsx purges lingering toasts when switching 2FA delivery channels', () => {
  const source = read('../frontend/src/views/Login.tsx');
  assert.match(source, /toast\.dismiss\(\);\s*const loadToast = toast\.loading\(`Sending code to your/);
});

test('lib/toast.ts retains global deduplication wrapper', () => {
  const source = read('../frontend/src/lib/toast.ts');
  assert.match(source, /TOAST_DEBOUNCE_MS = 350/);
  assert.match(source, /deduplicateToast/);
});
