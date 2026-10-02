import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBackend = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readFrontend = relativePath => readFileSync(new URL(`../../frontend/${relativePath}`, import.meta.url), 'utf8');

test('Limited Procurement & Category Sourcing Isolation Test Suite', async (t) => {
  await t.test('1. Notification Service: Restricted/Selected Pool isolation & Invite popup trigger', () => {
    const notificationService = readBackend('src/services/notification.service.ts');
    
    // Checks for limited tender, private visibility, and selected sourcing strategy
    assert.match(notificationService, /isInvitedSelectedPool\s*=/);
    assert.match(notificationService, /visibility\s*===\s*'PRIVATE'/);
    assert.match(notificationService, /\['SELECTED',\s*'SELECT',\s*'LIMITED',\s*'INVITED'\]\.includes\(sourcingStrategy\)/);
    assert.match(notificationService, /LIMITED_TENDER/);

    // Dispatches bid.invitation type for invited sellers so InviteLoginPopup is triggered
    assert.match(notificationService, /isInvitation\s*\?/);
    assert.match(notificationService, /type:\s*'bid\.invitation'/);

    // If no invited users match, returns early without notifying any other seller
    assert.match(notificationService, /if\s*\(isInvitedSelectedPool\)\s*\{[\s\S]*?if\s*\(!targetUsers\.length\)\s*return;/);
  });

  await t.test('2. Notification Service: Category-matched vendor filtering', () => {
    const notificationService = readBackend('src/services/notification.service.ts');
    
    // Checks for CATEGORY sourcing strategy
    assert.match(notificationService, /sourcingStrategy.*===\s*'CATEGORY'/);

    // Queries category and filters target users to matching organizations and profiles
    assert.match(notificationService, /matchedOrgIds/);
    assert.match(notificationService, /sellerProfile/);
  });

  await t.test('3. Marketplace Routes: Backend query and filter level isolation', () => {
    const marketplaceRoutes = readBackend('src/routes/marketplace.routes.ts');

    // Public legacy requirements exclude limited methods
    assert.match(marketplaceRoutes, /getPublicLegacyRequirementWhere/);
    assert.match(marketplaceRoutes, /LIMITED_TENDER/);

    // loadLatestProcurementBids enforces visibility PUBLIC and excludes limited tender and selected pool
    assert.match(marketplaceRoutes, /loadLatestProcurementBids/);
    assert.match(marketplaceRoutes, /visibility:\s*'PUBLIC'/);
    assert.match(marketplaceRoutes, /tp\.vendors\?\.selection/);
    assert.match(marketplaceRoutes, /\['SELECTED',\s*'SELECT',\s*'LIMITED',\s*'INVITED'\]\.includes\(selection\)/);

    // loadLatestRequirements enforces visibility PUBLIC and filters out limited/selected requirements
    assert.match(marketplaceRoutes, /loadLatestRequirements/);
    assert.match(marketplaceRoutes, /rfqType\s*===\s*'LIMITED'/);
  });

  await t.test('4. Frontend LatestBids: Active Procurement Opportunities filters out restricted procurements', () => {
    const latestBids = readFrontend('src/features/marketplace/components/LatestBids.tsx');

    // Has isRestrictedOpportunity helper
    assert.match(latestBids, /const isRestrictedOpportunity =/);
    assert.match(latestBids, /LIMITED_TENDER/);
    assert.match(latestBids, /LIMITED_RFQ/);
    assert.match(latestBids, /vendorsSelection === 'SELECTED'/);

    // Filters tenders, bids, and requirements before displaying
    assert.match(latestBids, /\.filter\(t => !isRestrictedOpportunity\(t\)\)/);
    assert.match(latestBids, /\.filter\(b => !isRestrictedOpportunity\(b\)\)/);
    assert.match(latestBids, /\.filter\(r => !isRestrictedOpportunity\(r\)\)/);
  });

  await t.test('5. Logic Simulation: Ensure restricted opportunity detector accurately catches all variations', () => {
    // Replicate the isolation helper logic to test edge cases
    const isRestrictedOpportunity = (raw) => {
      if (!raw) return false;
      const visibility = String(raw.visibility || '').toUpperCase();
      if (visibility === 'PRIVATE' || visibility === 'INVITED_SELLERS_ONLY') return true;

      const method = String(
        raw.procurementMethod || 
        raw.canonicalMethod || 
        raw.method || 
        raw.methodSlug || 
        raw.bidType || 
        ''
      ).toUpperCase();
      if (method === 'LIMITED_TENDER' || method === 'LIMITED_RFQ' || method.includes('LIMITED_')) return true;

      const rfqType = String(raw.rfqType || raw.payload?.rfqType || '').toUpperCase();
      if (rfqType === 'LIMITED') return true;

      const payload = raw.payload || raw.technicalPacket || {};
      const vendorsSelection = String(
        payload?.vendors?.selection || 
        payload?.sourcingStrategy || 
        raw.sourcingStrategy || 
        raw.vendorsSelection || 
        ''
      ).toUpperCase();
      if (vendorsSelection === 'SELECTED' || vendorsSelection === 'LIMITED' || vendorsSelection === 'INVITED') {
        return true;
      }

      const desc = String(raw.description || '');
      if (/Sourcing Method:\s*Limited/i.test(desc)) return true;

      return false;
    };

    // Edge cases that MUST be marked restricted (hidden from MarketplaceHome & public)
    assert.equal(isRestrictedOpportunity({ visibility: 'PRIVATE' }), true);
    assert.equal(isRestrictedOpportunity({ procurementMethod: 'LIMITED_TENDER' }), true);
    assert.equal(isRestrictedOpportunity({ canonicalMethod: 'LIMITED_RFQ' }), true);
    assert.equal(isRestrictedOpportunity({ rfqType: 'LIMITED' }), true);
    assert.equal(isRestrictedOpportunity({ payload: { rfqType: 'LIMITED' } }), true);
    assert.equal(isRestrictedOpportunity({ technicalPacket: { vendors: { selection: 'Selected' } } }), true);
    assert.equal(isRestrictedOpportunity({ payload: { vendors: { selection: 'Selected' } } }), true);
    assert.equal(isRestrictedOpportunity({ sourcingStrategy: 'Selected' }), true);
    assert.equal(isRestrictedOpportunity({ description: 'Sourcing Method: Limited Tender | Urgency: High' }), true);

    // Open public opportunities MUST NOT be marked restricted
    assert.equal(isRestrictedOpportunity({ visibility: 'PUBLIC', procurementMethod: 'OPEN_TENDER' }), false);
    assert.equal(isRestrictedOpportunity({ visibility: 'PUBLIC', rfqType: 'OPEN', sourcingStrategy: 'Open' }), false);
    assert.equal(isRestrictedOpportunity({ visibility: 'PUBLIC', sourcingStrategy: 'Category' }), false);
  });
});
