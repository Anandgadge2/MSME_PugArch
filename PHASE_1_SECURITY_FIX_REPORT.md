# Phase 1 Security Fix Report

Date: 2026-05-15  
Scope: Critical/high security foundation fixes only. No catalogue, requirements, direct purchase, evaluations, contracts, ratings, AI, or extra UI modules were added.

## 1. Files Changed

| Area | Files |
|---|---|
| Prisma schema/migration | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260515160000_sensitive_data_and_otp_security/migration.sql` |
| Sensitive data utilities/write paths | `backend/src/utils/maskSensitive.ts`, `backend/index.ts`, `backend/src/modules/compliance/compliance.service.ts` |
| OTP security | `backend/src/services/otp.service.ts`, `backend/prisma/schema.prisma` |
| Redis key centralization | `backend/src/constants/redis-keys.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/modules/payments/payment.service.ts`, `backend/src/config/env.ts`, `backend/index.ts` |
| Public endpoint and auth hardening | `backend/index.ts`, `backend/src/middleware/authenticate.ts`, `backend/src/controllers/gstController.ts` |
| Safe errors | `backend/src/middleware/safeErrorResponse.ts`, `backend/src/modules/payments/payment.routes.ts`, `backend/index.ts`, `backend/src/controllers/gstController.ts` |
| Env example | `backend/.env.example` |
| Tests | `backend/tests/security.test.mjs` |
| Documentation | `docs/ROUTE_OWNERSHIP_MATRIX.md`, `docs/PHASE_1_SECURITY_FIX_REPORT.md` |

## 2. Prisma Migration Summary

Added migration:

`backend/prisma/migrations/20260515160000_sensitive_data_and_otp_security/migration.sql`

Changes:

- Added `BuyerProfile.aadhaarHash`.
- Added `SellerProfile.aadhaarHash`.
- Added `SellerBankAccount.accountNumberHash`.
- Made `SellerBankAccount.accountNumber` nullable for backward-compatible transition away from raw account storage.
- Added indexes/unique indexes for new hash fields.
- Added `OtpVerification` audit model with identifier, purpose, attempts, verified state, expiry, and verification time.
- Kept legacy raw columns temporarily and marked them deprecated in Prisma comments.

Raw sensitive columns were not dropped in this phase to avoid breaking existing data. Application write paths were changed to stop writing raw Aadhaar and bank account numbers.

## 3. Sensitive Data Changes

- Added `maskGSTIN()` alias.
- Existing masking helpers now cover PAN, GSTIN, Aadhaar, and bank account values.
- Seller onboarding now writes Aadhaar masked/hash fields and sets raw `aadhaarNumber` to `null`.
- Buyer onboarding now writes Aadhaar masked/hash fields and sets raw `aadhaarNumber` to `null`.
- Seller bank account creation now writes `accountNumberMasked`, `accountNumberHash`, and `bankFingerprint`, and sets raw `accountNumber` to `null`.
- Duplicate bank checks now compare hash/fingerprint values first, while retaining old raw comparison only for legacy records.
- Vendor/bank API responses continue to pass through `maskSensitive()`.
- Sensitive updates now emit `sensitive_data.updated` audit events.

## 4. OTP Changes

- OTP storage now requires Redis and fails closed with `OTP_REDIS_UNAVAILABLE` when Redis is not ready.
- Plain `prisma.otp.create()` fallback was removed from OTP service.
- OTP values are stored as SHA-256 hashes in Redis state.
- OTP TTL remains 5 minutes.
- Resend cooldown remains 60 seconds.
- Max attempts remains 5.
- Persistent `OtpVerification` audit records store identifier/purpose/attempts/verified/expiry metadata only, never plain OTP.
- OTP verification failures are audited with `auth.otp.failed`.

## 5. Redis Key Changes

Created:

`backend/src/constants/redis-keys.ts`

Centralized builders added for:

- `otp:{purpose}:{identifier}`
- `otp_attempts:{purpose}:{identifier}`
- `rate:login:{ip}`
- `rate:login_user:{email}`
- `rate:api:{userId}:{route}`
- `rate:api_ip:{ip}:{route}`
- `lock:auction:{auctionId}`
- `idem:payment:{idempotencyKey}`
- `webhook:{gateway}:{eventId}`
- `cache:categories:all`
- `cache:vendor_search:{hash}`
- `cache:product_search:{hash}`
- `notifications:user:{userId}`

Updated practical existing usage:

- OTP keys use centralized builders.
- Login/API rate limits use centralized key patterns.
- Auction locks use `redisKeys.lockAuction()`.
- Payment webhook locks use `redisKeys.webhook()`.

Added to `backend/.env.example`:

```env
CACHE_DRIVER=redis
```

## 6. Public Endpoint Security Changes

- `GET /api/utils/gst-verify/:gstin` now requires authentication and remains under strict verification rate limiting.
- GST provider/internal error details are no longer returned in the JSON response.
- `GET /api/notifications/stream` now validates access tokens through `verifyAccessToken()`, checks `sessionVersion`, checks locked account state, and audits authentication failure.
- `GET /api/files/:id/signed-url` already enforced file ownership through storage service; tests now assert this behavior.
- Upload routes remain authenticated and rate-limited.

## 7. Ownership Checks Improved

Documented high-risk routes in:

`docs/ROUTE_OWNERSHIP_MATRIX.md`

Confirmed/enforced baseline for:

- Tender detail/update/status ownership.
- Bid detail/status/withdraw ownership.
- Purchase order and invoice ownership through financial workflow service.
- File signed URL ownership.
- Payment list/status/initiation ownership.
- Notification SSE user/session ownership.

## 8. Audit Logging Added/Confirmed

Added or confirmed audit events for:

- `security.unauthorized_access`
- `auth.otp.failed`
- `sensitive_data.updated`
- `file.access_denied`
- `file.viewed`
- `compliance.override.approved_flagged_profile`
- `payment.webhook.failed_verification`
- `payment.webhook.duplicate_ignored`

## 9. Tests Added

Updated `backend/tests/security.test.mjs` with checks for:

1. OTP service does not write plain OTP rows.
2. OTP uses hash, five-minute expiry, and max attempts.
3. File signed URL route requires auth, ownership, and denial audit.
4. Notification SSE requires validated token/session authentication.
5. Raw Aadhaar and bank values are not written/returned by API paths.
6. Safe error middleware does not leak internal 500 error messages.
7. Auction locks use centralized Redis key builders.

## 10. Commands Run

```powershell
npx prisma generate
npm run prisma:validate --workspace=backend
npm run typecheck --workspace=backend
npm run typecheck --workspace=frontend
npm run test:security --workspace=backend
npm run build --workspace=backend
npm run build --workspace=frontend
```

## 11. Build/Test Results

| Command | Result | Notes |
|---|---|---|
| `npx prisma generate` | PASS | Required after schema changes. |
| `npm run prisma:validate --workspace=backend` | PASS | Prisma schema valid. |
| `npm run typecheck --workspace=backend` | PASS | Backend TypeScript passes. |
| `npm run typecheck --workspace=frontend` | PASS | Frontend TypeScript passes. |
| `npm run test:security --workspace=backend` | PASS | 14/14 tests pass. |
| `npm run build --workspace=backend` | PASS | Prisma generate + TS build pass. |
| `npm run build --workspace=frontend` | PASS | Next build passes; existing Next ESLint plugin warning remains. |

## 12. Remaining Risks

1. Legacy raw sensitive columns still exist for backward compatibility. A later migration should backfill hashes, verify no reads depend on raw values, and then drop raw columns.
2. Existing database rows may still contain raw Aadhaar/account values from earlier versions until a controlled data migration clears them.
3. PAN/GST raw storage is still allowed for verification workflows, but all API responses must continue to use masking.
4. Some route ownership logic remains inline in `backend/index.ts`; this should move into module middleware during route refactor.
5. GST verification is now authenticated. Pre-registration GST fetch flows may need a separate intentionally public, low-detail, heavily rate-limited endpoint if the product requires GST fetch before account creation.
6. Security tests are still static/source-level checks, not full database-backed integration tests.
7. Redis unavailability now disables OTP by design. Production must provide highly available Redis/Valkey.

## 13. Next Recommended Phase

Refactor high-risk legacy routes into modules without changing behavior:

1. Move auth routes into `src/modules/auth`.
2. Move tender and bid routes into `src/modules/tenders` and `src/modules/bids`.
3. Attach route-level Zod schemas for body, params, and query.
4. Convert inline ownership checks to reusable middleware.
5. Add database-backed integration tests for IDOR/BOLA, OTP, file access, and payment webhooks.
