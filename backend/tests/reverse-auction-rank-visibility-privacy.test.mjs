import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('1. Backend schema for start-from-bids accepts HIDDEN, SHOW_RANK_ONLY, and SHOW_LOWEST_PRICE', () => {
  const raRoutes = read('src/routes/reverse-auction.routes.ts');

  // Verify line in start-from-bids route has HIDDEN in the enum
  assert.match(
    raRoutes,
    /rankVisibility:\s*z\.enum\(\[\s*['"]SHOW_RANK_ONLY['"],\s*['"]SHOW_LOWEST_PRICE['"],\s*['"]HIDDEN['"]\s*\]\)\.default\(['"]SHOW_RANK_ONLY['"]\)/,
    'start-from-bids must allow HIDDEN in rankVisibility enum'
  );
  assert.doesNotMatch(
    raRoutes,
    /rankVisibility:\s*z\.enum\(\[.*SHOW_ALL_PRICES.*\]\)/,
    'SHOW_ALL_PRICES must not be in reverse auction rankVisibility enum'
  );
});

test('2. Anti-collusion security: competitor names are NEVER unmasked by SHOW_LOWEST_PRICE', () => {
  const phase4 = read('src/routes/phase4.routes.ts');

  assert.doesNotMatch(
    phase4,
    /allowCompetitorNames:\s*config\.rankVisibility === ['"]SHOW_LOWEST_PRICE['"]/,
    'allowCompetitorNames must NOT be automatically enabled by SHOW_LOWEST_PRICE'
  );
  assert.match(
    phase4,
    /allowCompetitorNames:\s*false/,
    'allowCompetitorNames must default to false for anti-collusion safety'
  );
});

test('3. Backend live-summary sanitizes L1 price and rankings according to rankVisibility', () => {
  const raRoutes = read('src/routes/reverse-auction.routes.ts');

  // Verify live-summary masks lowest amount when SHOW_RANK_ONLY or HIDDEN
  assert.match(
    raRoutes,
    /const maskLowest = isBlind \|\| isRankOnly;/,
    'maskLowest must be true for blind or rank-only auctions'
  );
  assert.match(
    raRoutes,
    /currentLowestBid:\s*null,\s*currentLowestAmount:\s*null,\s*currentBid:\s*null/,
    'currentLowestBid and currentLowestAmount must be masked to null when maskLowest is active'
  );
  assert.match(
    raRoutes,
    /minimumNextBid:\s*maskLowest \? null : Number\(calculatedNextBid\.toFixed\(2\)\)/,
    'minimumNextBid must be null when maskLowest is active to prevent reverse-engineering L1'
  );
  assert.match(
    raRoutes,
    /myRank:\s*isBlind \? null : \(participant\?\.currentRank \|\| null\)/,
    'myRank must be null in blind bidding'
  );
});

test('4. Backend /participants and /bids endpoints hide ranks and L1 amounts in blind bidding', () => {
  const raRoutes = read('src/routes/reverse-auction.routes.ts');

  // Verify participants masking
  assert.match(
    raRoutes,
    /currentRank:\s*isBlind \? null : p\.currentRank/,
    'participants currentRank must be null in blind bidding'
  );
  assert.match(
    raRoutes,
    /const bidderLabel = isBlind \? `Bidder \$\{index \+ 1\}` : `Bidder \$\{p\.currentRank \|\| index \+ 1\}`;/,
    'anonymized label in blind bidding must not expose rank'
  );

  // Verify bids masking
  assert.match(
    raRoutes,
    /const bidderRank = isBlind \? null : \(part\?\.currentRank \|\| b\.rankAtSubmission \|\| null\);/,
    'bidderRank must be null for non-managers in blind bidding'
  );
});

test('5. WebSocket and audit broadcasts protect L1 price and bidder identity', () => {
  const raRoutes = read('src/routes/reverse-auction.routes.ts');

  // Public broadcast must not leak sellerOrgId
  assert.match(
    raRoutes,
    /sellerOrgId:\s*null,/,
    'WebSocket broadcast must never expose sellerOrgId publicly'
  );
  // Public broadcast must not leak currentLowest in blind/rank-only mode
  assert.match(
    raRoutes,
    /currentLowest:\s*isBlindOrRankOnly \? null : currentLow,/,
    'WebSocket broadcast must mask currentLowest when isBlindOrRankOnly'
  );
  assert.match(
    raRoutes,
    /minimumNextBid:\s*isBlindOrRankOnly \? null : Number\(nextMax\.toFixed\(2\)\),/,
    'WebSocket broadcast must mask minimumNextBid when isBlindOrRankOnly'
  );
});

test('6. Bid rejection error message does not leak L1 floor in SHOW_RANK_ONLY or HIDDEN', () => {
  const raRoutes = read('src/routes/reverse-auction.routes.ts');

  assert.match(
    raRoutes,
    /const isPrivacyMasked = !isManager && \(String\(auction\.rankVisibility \|\| ''\)\.toUpperCase\(\) === 'SHOW_RANK_ONLY' \|\| String\(auction\.rankVisibility \|\| ''\)\.toUpperCase\(\) === 'HIDDEN'\);/,
    'isPrivacyMasked must be checked during bid rejection'
  );
  assert.match(
    raRoutes,
    /lower than the current leading offer to improve your standing/,
    'Error message must be sanitized to not disclose competitor price floor'
  );
});

test('7. Real-time Toast notification masks price when currentLowest is not provided', () => {
  const hook = read('../frontend/src/features/reverseAuctions/hooks/useReverseAuctionRealtime.ts');

  assert.match(
    hook,
    /triggerDeduplicatedAuctionToast\(`auction-bid-\$\{cleanId\}-masked`/,
    'Hook must use masked toast when priceFmt is null'
  );
  assert.match(
    hook,
    /toast\.info\('New Bid Submitted'/,
    'Masked toast must display generic non-leaking message'
  );
});

test('8. Create Procurement Wizard has accessible dropdown with aria and helper description', () => {
  const wizard = read('../frontend/src/features/procurementWizard/pages/CreateProcurementPage.tsx');

  assert.match(wizard, /id="auction-rank-visibility"/);
  assert.match(wizard, /name="rankVisibility"/);
  assert.match(wizard, /aria-required="true"/);
  assert.match(wizard, /aria-label="Supplier Rank & Competitor Visibility"/);
  assert.match(wizard, /Suppliers only see their own rank/);
  assert.match(wizard, /Blind bidding mode\. Competitor prices, rankings, and standings are completely sealed/);
});

test('9. ReverseAuctionLivePage UI respects privacy modes without leaking L1 or ranks', () => {
  const livePage = read('../frontend/src/features/reverseAuctions/pages/ReverseAuctionLivePage.tsx');

  // Verify definitions
  assert.match(livePage, /const isBlind = !isBuyerOrAdmin && rankVisibility === 'HIDDEN';/);
  assert.match(livePage, /const isLowestPriceVisible = isBuyerOrAdmin \|\| rankVisibility === 'SHOW_LOWEST_PRICE';/);

  // Card 1 privacy
  assert.match(livePage, /isLowestPriceVisible \? \(/);
  assert.match(livePage, /Protected \(Rank Only\)/);
  assert.match(livePage, /Sealed \(Blind Bidding\)/);

  // Card 2 privacy in blind bidding
  assert.match(livePage, /label=\{isBuyerOrAdmin \? "Auction Leader \(L1\)" : isBlind \? "Standing \(Blind Bidding\)" : "My Current Rank"\}/);

  // Chart ReferenceLine check
  assert.match(livePage, /isLowestPriceVisible && currentLowest > 0 && !startAndL1Same/);

  // Leaderboard sealed state
  assert.match(livePage, /Blind Bidding Mode Active/);
  assert.match(livePage, /Competitor standings and rankings are strictly sealed/);
});
