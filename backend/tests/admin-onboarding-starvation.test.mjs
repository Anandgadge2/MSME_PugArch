import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBackend = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readFrontend = relativePath => readFileSync(new URL(`../../frontend/${relativePath}`, import.meta.url), 'utf8');

test('Admin Onboarding Starvation & Truncation Resolution Test Suite', async (t) => {
  await t.test('1. Backend phase4.routes.ts supports shg and all in paginationQuery role enum', () => {
    const phase4Routes = readBackend('src/routes/phase4.routes.ts');
    assert.match(
      phase4Routes,
      /role:\s*z\.enum\(\[\s*['"]buyer['"],\s*['"]seller['"],\s*['"]shg['"],\s*['"]all['"]\s*\]\)\.optional\(\)/,
      'paginationQuery must allow buyer, seller, shg, and all for role filtering'
    );
  });

  await t.test('2. Backend listWindow supports up to 1000 records per page', () => {
    const phase4Routes = readBackend('src/routes/phase4.routes.ts');
    assert.match(
      phase4Routes,
      /Math\.min\(1000,\s*Math\.max\(1,\s*Number\(query\.pageSize\s*\?\?\s*query\.take/,
      'listWindow must allow up to 1000 records'
    );
  });

  await t.test('3. Backend phase4.routes.ts queries sellers and buyers independently when unconstrained to prevent starvation', () => {
    const phase4Routes = readBackend('src/routes/phase4.routes.ts');
    assert.match(
      phase4Routes,
      /const sellerWhere = \{ \.\.\.baseWhere, role: \{ in: \['seller', 'shg'\] \} \};/,
      'sellerWhere must query seller and shg independently'
    );
    assert.match(
      phase4Routes,
      /const buyerWhere = \{ \.\.\.baseWhere, role: 'buyer' \};/,
      'buyerWhere must query buyer independently'
    );
    assert.match(
      phase4Routes,
      /Promise\.all\(\[\s*db\.user\.findMany\(\{\s*where: sellerWhere/,
      'sellerUsers and buyerUsers must be fetched via Promise.all'
    );
  });

  await t.test('4. Backend index.ts also queries sellers and buyers independently', () => {
    const indexTs = readBackend('index.ts');
    assert.match(
      indexTs,
      /const sellerWhere = \{ \.\.\.baseWhere, role: \{ in: \['seller', 'shg'\] \} \};/,
      'index.ts must query seller and shg independently'
    );
    assert.match(
      indexTs,
      /const buyerWhere = \{ \.\.\.baseWhere, role: 'buyer' \};/,
      'index.ts must query buyer independently'
    );
  });

  await t.test('5. Frontend AdminOnboarding requests pageSize=1000 to prevent local cutoff', () => {
    const adminOnboarding = readFrontend('src/views/AdminOnboarding.tsx');
    assert.match(
      adminOnboarding,
      /\/api\/admin\/onboarding\?pageSize=1000/,
      'AdminOnboarding must request pageSize=1000'
    );
  });
});
