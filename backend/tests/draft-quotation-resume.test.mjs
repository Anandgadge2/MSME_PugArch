import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendSrc = path.resolve(__dirname, '../src');
const frontendSrc = path.resolve(__dirname, '../../frontend/src');

test('1. Backend procurement-bid.service.ts allows seller/shg to receive own participation in serializeBid', () => {
  const serviceContent = fs.readFileSync(path.join(backendSrc, 'modules/procurementBid/procurement-bid.service.ts'), 'utf8');
  assert.match(serviceContent, /const isSellerOrShg = actorRole === 'seller' \|\| actorRole === 'shg';/);
  assert.match(serviceContent, /const canSeeParticipants = options\.includeParticipants \|\| isAdmin \|\| isBuyerOwner \|\| actorRole === 'buyer' \|\| isSellerOrShg;/);
  assert.match(serviceContent, /if \(isSellerOrShg\) \{\s*const isOwn = \(actor\?\.id && Number\(p\.sellerId\) === Number\(actor\.id\)\)/);
  assert.match(serviceContent, /myParticipation: isSellerOrShg \? \(\(\) => \{/);
});

test('2. Backend marketplace.routes.ts includes DRAFT participations when loading seller ownResponse', () => {
  const marketRoutes = fs.readFileSync(path.join(backendSrc, 'routes/marketplace.routes.ts'), 'utf8');
  assert.match(marketRoutes, /if \(!ownResponse && \(req\.user\?\.role === 'seller' \|\| req\.user\?\.role === 'shg'\) && targetBidIds\.size > 0\) \{/);
  assert.match(marketRoutes, /const pbPart = await db\.procurementBidParticipation\.findFirst\(\{[\s\S]*?bidId: \{ in: Array\.from\(targetBidIds\) \},[\s\S]*?sellerId: Number\(req\.user\.id\),[\s\S]*?isWithdrawn: false[\s\S]*?orderBy: \{ updatedAt: 'desc' \}/);
  assert.match(marketRoutes, /status:\s*pbPart\.submissionStatus\s*\|\|\s*'DRAFT'/);
});

test('3. SubmitQuotationPage findSellerParticipation inspects myParticipation and ownResponse', () => {
  const submitPage = fs.readFileSync(path.join(frontendSrc, 'features/rfq/pages/SubmitQuotationPage.tsx'), 'utf8');
  assert.match(submitPage, /if \(bidData\.myParticipation\) \{/);
  assert.match(submitPage, /\.\.\.\(bidData\?\.myParticipation \? \[bidData\.myParticipation\] : \[\]\)/);
  assert.match(submitPage, /\.\.\.\(bidData\?\.ownResponse \? \[bidData\.ownResponse\] : \[\]\)/);
  assert.match(submitPage, /\.\.\.\(bidData\?\.myResponse \? \[bidData\.myResponse\] : \[\]\)/);
});

test('4. SubmitQuotationPage useQuery includes resilient fallback lookups for seller status and marketplace response', () => {
  const submitPage = fs.readFileSync(path.join(frontendSrc, 'features/rfq/pages/SubmitQuotationPage.tsx'), 'utf8');
  assert.match(submitPage, /\/api\/seller\/procurement-bids\/\$\{encodeURIComponent\(String\(targetBidId\)\)\}\/status/);
  assert.match(submitPage, /\/api\/marketplace\/requirements\/\$\{encodeURIComponent\(String\(targetReqId\)\)\}/);
});

test('5. SubmitQuotationPage useQuery enforces fresh data on mount (staleTime: 0, refetchOnMount: always)', () => {
  const submitPage = fs.readFileSync(path.join(frontendSrc, 'features/rfq/pages/SubmitQuotationPage.tsx'), 'utf8');
  assert.match(submitPage, /staleTime:\s*0/);
  assert.match(submitPage, /refetchOnMount:\s*'always'/);
  assert.doesNotMatch(submitPage, /staleTime:\s*60_?000/);
});

test('6. SubmitQuotationPage buildResponseData preserves all line items with brand, model, and partial drafts', () => {
  const submitPage = fs.readFileSync(path.join(frontendSrc, 'features/rfq/pages/SubmitQuotationPage.tsx'), 'utf8');
  assert.match(submitPage, /const hasPrice = line\.unitPrice !== '' && Number\.isFinite\(Number\(line\.unitPrice\)\) && Number\(line\.unitPrice\) >= 0;/);
  assert.match(submitPage, /unitPrice,\s*unitRate:\s*unitPrice/);
  assert.match(submitPage, /const hasAnyLineContent = lines\.some\(l => l\.unitPrice !== '' \|\| l\.makeBrand \|\| l\.model/);
});

test('7. SubmitQuotationPage saveDraft syncs line item totals to offeredPrice and invalidates caches', () => {
  const submitPage = fs.readFileSync(path.join(frontendSrc, 'features/rfq/pages/SubmitQuotationPage.tsx'), 'utf8');
  assert.match(submitPage, /calcOfferedPrice/);
  assert.match(submitPage, /queryClient\.invalidateQueries\(\{\s*queryKey:\s*\['marketplace-requirement-quotation'\]\s*\}\)/);
  assert.match(submitPage, /queryClient\.invalidateQueries\(\{\s*queryKey:\s*\['procurement-bid'\]\s*\}\)/);
  assert.match(submitPage, /clearSellerBidsCache\(\)/);
});

test('8. SellerBidsPage exports clearSellerBidsCache function', () => {
  const sellerBids = fs.readFileSync(path.join(frontendSrc, 'features/procurementBid/pages/SellerBidsPage.tsx'), 'utf8');
  assert.match(sellerBids, /export const clearSellerBidsCache = \(\) => \{/);
});
