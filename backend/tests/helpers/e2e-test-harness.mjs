/**
 * E2E Reference Test Harness & Authoritative Specification Oracles
 * Derived from ORIGINAL_REQUEST.md, PROJECT.md Interface Contracts, and GFR 2017.
 */
import path from 'node:path';
import crypto from 'node:crypto';

// ============================================================================
// 1. FILE SERVING & PATH TRAVERSAL ORACLE (PROJECT.md Interface Contract 1)
// ============================================================================

export const PUBLIC_STORAGE_PREFIX = 'categories/photos/';

export function evaluateFileAccess(rawKey, baseDir = '/app/uploads', isAuthenticated = false) {
  if (!rawKey || typeof rawKey !== 'string') {
    return { allowed: false, status: 400, code: 'KEY_REQUIRED' };
  }

  // Null byte or control character detection
  if (rawKey.includes('\0') || /[\x00-\x1f]/.test(rawKey)) {
    return { allowed: false, status: 403, code: 'PATH_TRAVERSAL_DETECTED' };
  }

  // Normalization / decode check for double encoding
  let decodedKey = rawKey;
  try {
    decodedKey = decodeURIComponent(rawKey);
    // If decoding again changes it, it was double-encoded
    if (decodeURIComponent(decodedKey) !== decodedKey) {
      decodedKey = decodeURIComponent(decodedKey);
    }
  } catch {
    return { allowed: false, status: 400, code: 'INVALID_ENCODING' };
  }

  // Sanitize and normalize key using path.posix.normalize
  const normalizedRawKey = path.posix.normalize(rawKey.replace(/\\/g, '/'));
  const normalizedKey = path.posix.normalize(decodedKey.replace(/\\/g, '/')).replace(/^(\/|\.)+/, '');

  const hasTraversal = (
    rawKey.includes('..') ||
    decodedKey.includes('..') ||
    normalizedRawKey.includes('..') ||
    normalizedKey.includes('..')
  );

  // Public whitelist check: categories/photos/ does not require auth.
  // Keys with .. or traversal characters are NOT treated as public.
  const isPublicPrefix = (
    (normalizedKey.startsWith(PUBLIC_STORAGE_PREFIX) || normalizedKey.startsWith('public/')) &&
    !hasTraversal
  );

  if (!isPublicPrefix && !isAuthenticated) {
    return { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' };
  }

  // Traversal attempts are rejected
  if (hasTraversal) {
    return { allowed: false, status: 403, code: 'PATH_TRAVERSAL_DETECTED' };
  }

  // Strict path bounds checking via path.resolve and path.relative
  const resolved = path.resolve(baseDir, normalizedKey);
  const relative = path.relative(baseDir, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative) || path.isAbsolute(decodedKey)) {
    return { allowed: false, status: 403, code: 'PATH_TRAVERSAL_DETECTED', resolved };
  }

  return { allowed: true, status: 200, resolved, isPublic: isPublicPrefix };
}

// ============================================================================
// 2. BOLA PAYMENT PROOF AUTHORIZATION ORACLE (PROJECT.md Interface Contract 2)
// ============================================================================

export function evaluatePaymentProofAccess(actor, proof, action = 'verify') {
  if (!actor || !proof) {
    return { allowed: false, status: 401, code: 'UNAUTHORIZED' };
  }

  // Platform admin check
  const isPlatformAdmin = actor.role === 'admin' || actor.role === 'master_admin' || actor.isFinanceAdmin === true;

  // Payee seller check: actor must match sellerOrgId or sellerUserId on the payment proof
  const isPayeeSeller = (
    (proof.sellerOrgId && actor.organizationId === proof.sellerOrgId) ||
    (proof.sellerUserId && actor.id === proof.sellerUserId)
  );

  // Cross-tenant or unrelated seller MUST be rejected even if role is 'seller'
  if (!isPlatformAdmin && !isPayeeSeller) {
    return { allowed: false, status: 403, code: 'PERMISSION_DENIED', action };
  }

  return { allowed: true, status: 200, verifiedBy: actor.id, action };
}

// ============================================================================
// 3. CRYPTOGRAPHIC RNG ORACLE (ORIGINAL_REQUEST.md R2 & PROJECT.md F2.3)
// ============================================================================

export function generateSecureOtp() {
  // Uses crypto.randomInt spanning 100000 to 999999 inclusive
  return String(crypto.randomInt(100000, 1000000));
}

export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function isCryptographicallySecureRng(sourceCode) {
  const hasInsecureMathRandom = /Math\.random\(\)/.test(sourceCode);
  const hasCryptoRandom = /crypto\.randomInt|crypto\.randomBytes/.test(sourceCode);
  return !hasInsecureMathRandom && hasCryptoRandom;
}

// ============================================================================
// 4. SSRF LOGO FETCH PROTECTION ORACLE (PROJECT.md F2.4)
// ============================================================================

export function isSafeFetchUrl(urlStr, allowedDomains = ['jsgsmile.in', 'storage.googleapis.com', 'res.cloudinary.com']) {
  if (!urlStr || typeof urlStr !== 'string') return false;

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.toLowerCase();

  // Loopback addresses
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    return false;
  }

  // Cloud metadata services
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname.endsWith('.metadata.google.internal')) {
    return false;
  }

  // RFC 1918 Private IPv4 address ranges
  // 10.0.0.0 – 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  // 172.16.0.0 – 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  // 192.168.0.0 – 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;

  // Decimal, octal, hex IP notation bypassing string regex (e.g. 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) return false;

  // Domain whitelist check
  const isAllowed = allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  return isAllowed;
}

// ============================================================================
// 5. CORS ORIGIN ENFORCEMENT ORACLE (PROJECT.md F2.5)
// ============================================================================

export function isAllowedCorsOriginOracle(origin, isProduction = true, configuredOrigins = ['https://jsgsmile.in']) {
  if (!origin) return false;

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  // Localhost allowed only in non-production
  if (!isProduction && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
    return true;
  }

  // MUST reject generic wildcard *.run.app in production
  if (parsed.hostname.endsWith('.run.app') || parsed.hostname.endsWith('.a.run.app')) {
    return false;
  }

  // Official production domains
  if (parsed.protocol === 'https:' && (parsed.hostname === 'jsgsmile.in' || parsed.hostname.endsWith('.jsgsmile.in'))) {
    return true;
  }

  return configuredOrigins.includes(origin);
}

// ============================================================================
// 6. AADHAAR KYC ENFORCEMENT ORACLE (PROJECT.md F2.6)
// ============================================================================

export function evaluateAadhaarKyc(aadhaarNumber, verificationProof = null) {
  const cleaned = String(aadhaarNumber ?? '').replace(/\s+/g, '');
  if (!cleaned || !/^\d{12}$/.test(cleaned)) {
    return { valid: false, status: 400, code: 'INVALID_AADHAAR_FORMAT' };
  }

  // Requires verified UIDAI / DigiLocker verification record
  if (!verificationProof || !verificationProof.verified || !['UIDAI', 'DIGILOCKER'].includes(verificationProof.provider)) {
    return { valid: false, status: 403, code: 'AADHAAR_VERIFICATION_REQUIRED' };
  }

  const masked = `XXXXXXXX${cleaned.slice(-4)}`;
  const hash = crypto.createHash('sha256').update(cleaned + ':aadhaar_vault').digest('hex');

  return {
    valid: true,
    masked,
    hash,
    verified: true,
    provider: verificationProof.provider
  };
}

// ============================================================================
// 7. DISTRICT MULTI-TENANCY SCOPING ORACLE (PROJECT.md F2.7)
// ============================================================================

export function scopeQueryByDistrict(actor, requestedDistrictId = null) {
  if (actor.role === 'master_admin') {
    return requestedDistrictId ? { districtId: requestedDistrictId } : {};
  }

  if (actor.role === 'admin') {
    // District admin is strictly bounded to their assigned scopeId / districtId
    const assignedDistrictId = actor.districtAssignment?.scopeId || actor.districtId;
    if (!assignedDistrictId) {
      throw new Error('ADMIN_DISTRICT_SCOPE_REQUIRED');
    }
    // Cannot override assigned district with arbitrary query
    return { districtId: assignedDistrictId };
  }

  // Ordinary user (buyer/seller)
  return { organizationId: actor.organizationId };
}

// ============================================================================
// 8. DIRECT PURCHASE THRESHOLD & GFR RULE 154 ORACLE (PROJECT.md Interface Contract 3)
// ============================================================================

export const DIRECT_PURCHASE_THRESHOLD = 25000;

export function evaluateDirectPurchaseOrder({ items = [], rule154Certificate = null }) {
  // Aggregate items by sellerId
  const itemsBySeller = {};
  for (const item of items) {
    const sId = item.sellerId || 1;
    if (!itemsBySeller[sId]) itemsBySeller[sId] = [];
    itemsBySeller[sId].push(item);
  }

  const sellerResults = {};

  for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
    const totalAmount = sellerItems.reduce((acc, it) => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice || 0);
      const taxRate = Number(it.taxRate || 0);
      const line = qty * price * (1 + taxRate / 100);
      return acc + line;
    }, 0);

    if (totalAmount <= DIRECT_PURCHASE_THRESHOLD) {
      sellerResults[sellerId] = {
        allowed: true,
        totalAmount,
        requiresCertificate: false,
        certificateApplied: false
      };
    } else {
      // Exceeds threshold: requires valid GFR Rule 154 Certificate
      const hasValidCert = Boolean(
        rule154Certificate &&
        rule154Certificate.certifierName &&
        rule154Certificate.designation &&
        rule154Certificate.reason &&
        rule154Certificate.certifiedDate
      );

      if (!hasValidCert) {
        sellerResults[sellerId] = {
          allowed: false,
          totalAmount,
          status: 400,
          code: 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED',
          error: `Order total ₹${totalAmount.toFixed(2)} exceeds ₹25,000 threshold without mandatory Rule 154 certificate.`
        };
      } else {
        sellerResults[sellerId] = {
          allowed: true,
          totalAmount,
          requiresCertificate: true,
          certificateApplied: true,
          certificate: rule154Certificate
        };
      }
    }
  }

  const allAllowed = Object.values(sellerResults).every(r => r.allowed);
  return {
    allowed: allAllowed,
    orders: sellerResults
  };
}

// ============================================================================
// 9. UNAPPROVED BINDING PO PREVENTION ORACLE (ORIGINAL_REQUEST.md R3 & PROJECT.md F3.2)
// ============================================================================

export function evaluateSellerInvoiceSubmission({ invoiceBody, existingPO, quotation }) {
  // If no existing PO is found in DB, creation of invoice must fail; auto-creating a PO is strictly prohibited!
  if (!existingPO) {
    return {
      allowed: false,
      status: 400,
      code: 'PURCHASE_ORDER_REQUIRED',
      error: 'Cannot submit invoice without an existing approved Purchase Order.'
    };
  }

  // Existing PO must belong to authenticated seller
  if (existingPO.sellerId !== quotation.sellerUserId) {
    return {
      allowed: false,
      status: 403,
      code: 'FORBIDDEN_PO_SELLER_MISMATCH'
    };
  }

  // PO must be in valid fulfillment status (cannot invoice draft, cancelled, or rejected POs)
  const validStatuses = ['accepted', 'in_fulfillment', 'delivered', 'ACCEPTED', 'IN_FULFILLMENT', 'DELIVERED'];
  if (!validStatuses.includes(existingPO.status) && !validStatuses.includes(existingPO.poStatus)) {
    return {
      allowed: false,
      status: 409,
      code: 'INVALID_PO_STATUS_FOR_INVOICE',
      poStatus: existingPO.status
    };
  }

  return { allowed: true, poId: existingPO.id };
}

// ============================================================================
// 10. MULTI-VENDOR L1 COMPARISON ENGINE ORACLE (PROJECT.md Interface Contract 4)
// ============================================================================

export function evaluateL1Comparison(quotes = []) {
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return {
      meetsQuorum: false,
      l1VendorId: null,
      l1Price: null,
      compliantQuotes: [],
      error: 'NO_QUOTES_PROVIDED'
    };
  }

  // Aggregate line items per vendor
  const vendorMap = new Map();
  for (const q of quotes) {
    const vId = q.vendorId || q.sellerId;
    if (!vendorMap.has(vId)) {
      vendorMap.set(vId, {
        vendorId: vId,
        vendorName: q.vendorName || q.sellerName || `Vendor #${vId}`,
        totalPrice: 0,
        compliant: q.compliant !== false && q.complianceStatus !== 'Non-compliant',
        submittedAt: q.submittedAt || new Date().toISOString()
      });
    }
    const entry = vendorMap.get(vId);
    const lineTotal = Number(q.totalPrice !== undefined ? q.totalPrice : (q.unitPrice * (q.quantity || 1)));
    entry.totalPrice += lineTotal;
    if (q.compliant === false || q.complianceStatus === 'Non-compliant') {
      entry.compliant = false;
    }
  }

  const allVendors = Array.from(vendorMap.values());
  const compliantVendors = allVendors.filter(v => v.compliant);

  // Quorum check: requires at least 3 distinct vendor organizations
  const uniqueCompliantCount = compliantVendors.length;
  const meetsQuorum = uniqueCompliantCount >= 3;

  if (!meetsQuorum) {
    return {
      meetsQuorum: false,
      compliantVendorsCount: uniqueCompliantCount,
      totalVendorsCount: allVendors.length,
      l1VendorId: null,
      l1Price: null,
      compliantQuotes: compliantVendors,
      code: 'INSUFFICIENT_VENDORS_FOR_QUORUM',
      error: 'INSUFFICIENT_VENDORS_FOR_QUORUM',
      notice: `Quorum requires minimum 3 distinct compliant vendors; received ${uniqueCompliantCount}.`
    };
  }

  // Sort compliant vendors by aggregate total price ascending, breaking ties by earlier submittedAt
  compliantVendors.sort((a, b) => {
    if (a.totalPrice !== b.totalPrice) return a.totalPrice - b.totalPrice;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  const l1 = compliantVendors[0];

  return {
    meetsQuorum: true,
    compliantVendorsCount: uniqueCompliantCount,
    totalVendorsCount: allVendors.length,
    l1VendorId: l1.vendorId,
    l1VendorName: l1.vendorName,
    l1Price: l1.totalPrice,
    rankings: compliantVendors.map((v, index) => ({
      rank: `L${index + 1}`,
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      totalPrice: v.totalPrice,
      isL1: index === 0
    }))
  };
}

// ============================================================================
// 11. WEBSOCKET PRICE REDACTION & BID SECRECY ORACLE (PROJECT.md F3.4)
// ============================================================================

export function sanitizeWebSocketBroadcast(eventType, payload, tenderStage = 'TECHNICAL_EVALUATION') {
  if (eventType === 'QUOTATION_SUBMITTED') {
    // Before financial opening / tender conclusion, offeredPrice and sellerOrgId MUST be completely redacted
    const isFinancialOpened = tenderStage === 'FINANCIAL_EVALUATION' || tenderStage === 'AWARDED';

    if (!isFinancialOpened) {
      const sanitized = { ...payload };
      delete sanitized.offeredPrice;
      delete sanitized.sellerOrgId;
      delete sanitized.unitPrice;
      delete sanitized.totalAmount;
      return {
        ...sanitized,
        priceRedacted: true,
        sellerRedacted: true
      };
    }
  }

  return payload;
}

// ============================================================================
// 12. BILATERAL PO STATUS TRANSITIONS ORACLE (PROJECT.md Interface Contract 5)
// ============================================================================

export const PO_VALID_TRANSITIONS = {
  draft: ['issued', 'cancelled'],
  issued: ['accepted', 'rejected', 'cancelled', 'draft'],
  order_placed: ['accepted', 'rejected', 'cancelled'],
  pending_acceptance: ['accepted', 'rejected', 'cancelled'],
  // Accepted and in_fulfillment require bilateral workflow: direct cancelled disallowed!
  accepted: ['in_fulfillment', 'cancellation_requested'],
  in_fulfillment: ['delivered', 'cancellation_requested'],
  cancellation_requested: ['cancelled', 'accepted', 'in_fulfillment'],
  delivered: ['inspection_accepted', 'invoice_submitted'],
  inspection_accepted: ['invoice_submitted'],
  invoice_submitted: ['payment_initiated'],
  payment_initiated: ['escrow_held'],
  escrow_held: ['completed', 'cancellation_requested'],
  completed: [],
  cancelled: [],
  rejected: []
};

export function evaluatePOTransition(currentStatus, nextStatus, counterpartyApproved = false) {
  const normCurrent = String(currentStatus).toLowerCase();
  const normNext = String(nextStatus).toLowerCase();

  // Check direct transition map
  const allowedNext = PO_VALID_TRANSITIONS[normCurrent] || [];

  if (normNext === 'cancelled' && (normCurrent === 'accepted' || normCurrent === 'in_fulfillment')) {
    return {
      allowed: false,
      status: 409,
      code: 'BILATERAL_CANCELLATION_REQUIRED',
      error: `PO in '${normCurrent}' status cannot be unilaterally cancelled. Must initiate 'cancellation_requested'.`
    };
  }

  if (normCurrent === 'cancellation_requested' && normNext === 'cancelled') {
    if (!counterpartyApproved) {
      return {
        allowed: false,
        status: 403,
        code: 'COUNTERPARTY_APPROVAL_REQUIRED',
        error: 'Cancellation requires counterparty approval.'
      };
    }
    return { allowed: true, from: normCurrent, to: normNext };
  }

  if (!allowedNext.includes(normNext)) {
    return {
      allowed: false,
      status: 409,
      code: 'STATUS_TRANSITION_INVALID',
      error: `Purchase order cannot transition from '${normCurrent}' to '${normNext}'.`
    };
  }

  return { allowed: true, from: normCurrent, to: normNext };
}

// ============================================================================
// 13. RATE CONTRACT DRAWDOWN CUMULATIVE FINANCIAL CAP ORACLE (PROJECT.md F3.6)
// ============================================================================

export function evaluateRateContractCallOff(contractTotalValue, existingOrders = [], newCallOffItems = []) {
  const currentUtilized = existingOrders
    .filter(po => !['cancelled', 'rejected'].includes(po.status?.toLowerCase()))
    .reduce((sum, po) => sum + Number(po.totalValue || po.amount || 0), 0);

  const newOrderValue = newCallOffItems.reduce((sum, it) => {
    const qty = Number(it.quantity || 0);
    const rate = Number(it.unitPrice || 0);
    const taxRate = Number(it.taxRate || 0);
    return sum + (qty * rate * (1 + taxRate / 100));
  }, 0);

  const remainingValue = contractTotalValue - currentUtilized;

  if (newOrderValue > remainingValue) {
    return {
      allowed: false,
      status: 400,
      code: 'RATE_CONTRACT_CAP_EXCEEDED',
      contractTotalValue,
      currentUtilized,
      remainingValue,
      requestedOrderValue: newOrderValue,
      error: `Call-off order ₹${newOrderValue.toFixed(2)} exceeds remaining contract limit ₹${remainingValue.toFixed(2)}.`
    };
  }

  return {
    allowed: true,
    contractTotalValue,
    currentUtilized,
    remainingValueAfterOrder: remainingValue - newOrderValue,
    newOrderValue
  };
}

// ============================================================================
// 14. PBG INVOCATION & GFR 170 EMD ORACLE (PROJECT.md F3.7)
// ============================================================================

export function evaluatePbgInvocation(pbgRecord, actor, reason) {
  if (!pbgRecord) {
    return { allowed: false, status: 404, code: 'PBG_NOT_FOUND' };
  }

  const isAdmin = actor.role === 'admin' || actor.role === 'master_admin';
  const isBuyer = actor.id === pbgRecord.buyerId;

  if (!isAdmin && !isBuyer) {
    return { allowed: false, status: 403, code: 'PERMISSION_DENIED' };
  }

  const validStatuses = ['ACTIVE', 'VERIFIED_ACTIVE', 'SUBMITTED_FOR_VERIFICATION'];
  if (!validStatuses.includes(pbgRecord.status)) {
    return {
      allowed: false,
      status: 409,
      code: 'PBG_INVALID_STATUS_FOR_INVOCATION',
      currentStatus: pbgRecord.status,
      error: `Cannot invoke PBG in status '${pbgRecord.status}'.`
    };
  }

  if (!reason || reason.trim().length < 10) {
    return {
      allowed: false,
      status: 400,
      code: 'REASON_REQUIRED',
      error: 'Detailed forfeiture reason is statutory requirement.'
    };
  }

  return {
    allowed: true,
    newStatus: 'INVOKED',
    invokedBy: actor.id,
    invokedAt: new Date().toISOString(),
    forfeitedAmount: Number(pbgRecord.amount || 0),
    reason
  };
}
