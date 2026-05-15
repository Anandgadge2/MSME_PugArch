# Phase 2B Core Foundation Report

Date: 2026-05-15  
Branch: `phase-2-database-enums-foundation`  
Scope: additive database foundation only.

## 1. Executive Summary

Phase 2B added the non-conflicting enum and enterprise foundation layer required before procurement/catalogue itemization and backend modular refactoring. The change is intentionally additive: existing lower-case `OnboardingStatus`, existing lower-case `TenderStatus`, and existing string workflow status fields were not replaced or converted.

No frontend pages, catalogue workflows, requirement workflows, tender itemization, evaluations, contracts, PO items, invoice items, delivery models, ratings, analytics, or AI modules were implemented in this phase.

## 2. Enums Added

Added new non-conflicting Prisma enums:

- `UserStatus`
- `OrganizationType`
- `VerificationStatus`
- `MSMECategory`
- `ProcurementMethod`
- `ApprovalStatus`
- `ProductStatus`
- `CategoryType`
- `PricingModel`
- `StorageProvider`
- `FileStatus`
- `Severity`
- `PaymentGateway`
- `PaymentMethod`
- `NotificationChannel`
- `NotificationDeliveryStatus`
- `VerificationType`
- `FraudAlertStatus`
- `FraudAlertType`
- `ComplianceRuleCode`

Confirmed unchanged:

- Existing `OnboardingStatus` was not replaced.
- Existing `TenderStatus` was not replaced.
- Existing `Role` enum was not replaced.

## 3. Models Added

Added additive foundation models:

- `Organization`
- `UserSession`
- `RbacRole`
- `Permission`
- `RolePermission`
- `SellerDocument`
- `ApiVerificationLog`
- `NotificationLog`
- `ApiLog`
- `ComplianceRule`
- `FraudAlert`

`RbacRole` was used instead of `Role` because the existing Prisma schema already has an enum named `Role`.

## 4. Existing Models Extended

Extended existing models with optional/backward-compatible fields:

- `User`
  - `organizationId Int?`
  - `accountStatus UserStatus @default(PENDING)`
  - relations for organization, sessions, verification logs, API logs, seller document verification, and fraud alerts.
- `BuyerProfile`
  - `organizationId Int?`
  - `organizationTypeEnum OrganizationType?`
  - `verificationStatusEnum VerificationStatus?`
- `SellerProfile`
  - `organizationId Int?`
  - `organizationTypeEnum OrganizationType?`
  - `msmeCategoryEnum MSMECategory?`
  - `verificationStatusEnum VerificationStatus?`
  - `sellerDocuments` relation.
- `FileAsset`
  - `storageProviderEnum StorageProvider?`
  - `fileStatus FileStatus?`
  - organization logo and seller document relations.
- `PaymentTransaction`
  - `gatewayEnum PaymentGateway?`
  - `methodEnum PaymentMethod?`
- `ComplianceViolation`
  - `ruleId Int?`
  - optional `ComplianceRule` relation.
- `Notification`
  - `logs NotificationLog[]`.

## 5. Relations Added

Added optional organization relations to `User`, `BuyerProfile`, and `SellerProfile`.

Added foundation relations for:

- Hashed refresh-token sessions through `UserSession`.
- DB RBAC through `RbacRole`, `Permission`, and `RolePermission`.
- Normalized seller documents through `SellerDocument`.
- Safe provider verification summaries through `ApiVerificationLog`.
- Notification delivery audit through `NotificationLog`.
- API request audit through `ApiLog`.
- Compliance rule linkage through `ComplianceRule`.
- Fraud/collusion review through `FraudAlert`.

All new relations from existing production tables are optional where they point to new foundation tables.

## 6. Indexes Added

Indexes were added for high-use lookup and audit fields, including:

- Organization GST/PAN/Udyam/status/blacklist lookup.
- User organization and account status.
- Buyer/Seller profile organization and enum helper fields.
- User sessions by user, refresh-token hash, expiry, and revocation.
- RBAC code/role/permission lookup.
- Seller document seller/file/status/verifier lookup.
- Verification/API/notification logs by actor, status, route, request id, and time.
- Compliance rules by severity/activity.
- Fraud alerts by type, severity, status, entity, organization, user, and time.
- File and payment parallel enum helper fields.

## 7. Seed/Reference Data Added

Added `backend/prisma/seed.ts` and Prisma seed configuration in `backend/package.json`.

Seed data covers:

- System RBAC roles:
  - `SUPER_ADMIN`
  - `ADMIN`
  - `VERIFICATION_OFFICER`
  - `BUYER`
  - `SELLER`
  - `FINANCE_OFFICER`
  - `AUDITOR`
  - `SUPPORT_AGENT`
- Foundation permissions:
  - `user.create`
  - `user.block`
  - `onboarding.review`
  - `seller.catalogue.create`
  - `requirement.create`
  - `tender.create`
  - `tender.publish`
  - `bid.submit`
  - `bid.evaluate`
  - `po.generate`
  - `delivery.update`
  - `inspection.create`
  - `invoice.submit`
  - `invoice.verify`
  - `payment.initiate`
  - `escrow.release`
  - `dispute.manage`
  - `audit.view`
  - `admin.reports.view`
  - `compliance.review`
  - `fraud.review`
- Basic compliance rules:
  - `MISSING_REQUIRED_DOCUMENT`
  - `EXPIRED_CERTIFICATE`
  - `DUPLICATE_IDENTIFIER`
  - `INVALID_GST`
  - `INVALID_PAN`
  - `INVALID_BANK`
  - `SUSPICIOUS_REGISTRATION`
  - `POLICY_VIOLATION`

No fake users were seeded. No sample passwords were seeded.

## 8. Migration Name

Created migration:

`20260515170000_phase_2b_core_foundation`

`npx prisma migrate dev --name phase_2b_core_foundation` could not complete because an older migration fails while replaying into Prisma's shadow database:

`P3006: Migration 20260514223000_add_financial_security_models failed to apply cleanly to the shadow database. The underlying table for model SellerOffice does not exist.`

Because the failure is in a previous migration replay and not in the Phase 2B schema, the Phase 2B migration SQL was created manually and then validated through Prisma schema validation, Prisma client generation, typechecks, tests, and builds.

## 9. Backward Compatibility Notes

- Existing `OnboardingStatus` enum was not replaced.
- Existing `TenderStatus` enum was not replaced.
- Existing string status fields were not converted.
- Existing role enum logic was not replaced by DB RBAC.
- New DB RBAC models are foundation-only until later route refactoring.
- Deprecated sensitive fields were not removed and were not newly used.
- Existing onboarding, auth, tender, bid, admin review, file, payment, and dashboard code paths were left intact.
- `FileAsset.storageProvider` and `FileAsset.status` remain the current working string fields; `storageProviderEnum` and `fileStatus` are parallel helpers.
- `PaymentTransaction.gateway` and `PaymentTransaction.method` remain the current working string fields; `gatewayEnum` and `methodEnum` are parallel helpers.

## 10. Commands Run

```powershell
npx prisma format
npx prisma validate
npx prisma migrate dev --name phase_2b_core_foundation
npx prisma generate
npx tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop --skipLibCheck prisma\seed.ts
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
| `npx prisma format` | PASS | Schema formatted. |
| `npx prisma validate` | PASS | Schema valid. |
| `npx prisma migrate dev --name phase_2b_core_foundation` | FAIL | Existing older migration fails in shadow DB replay; Phase 2B migration was created manually. |
| `npx prisma generate` | PASS | Required stopping local Node dev processes because Windows had locked Prisma's query engine DLL. |
| `npx tsc ... prisma\seed.ts` | PASS | Seed script typechecked. |
| `npm run prisma:validate --workspace=backend` | PASS | Schema valid. |
| `npm run typecheck --workspace=backend` | PASS | Backend TypeScript clean. |
| `npm run typecheck --workspace=frontend` | PASS | Frontend TypeScript clean. |
| `npm run test:security --workspace=backend` | PASS | 14/14 security tests pass. |
| `npm run build --workspace=backend` | PASS | Prisma generate and TypeScript build pass. |
| `npm run build --workspace=frontend` | PASS | Next build passes; existing Next ESLint plugin warning remains. |

## 12. What Was Intentionally Not Changed

- No catalogue/product/service models were added.
- No requirement/direct-purchase models were added.
- No tender item, tender document, tender participant, or bid item models were added.
- No evaluation, comparative statement, or contract models were added.
- No purchase order item, invoice item, delivery tracking, inspection report, milestone payment, or rating models were added.
- No frontend pages or UI flows were added.
- No backend routes were moved or rewritten.
- No current workflow status fields were converted.
- No deprecated raw sensitive columns were dropped.

## 13. Remaining Risks

1. Older migrations need cleanup because Prisma shadow database replay currently fails before it reaches Phase 2B.
2. DB RBAC is present as a foundation but not yet used by route authorization.
3. Organization linkage is optional and not backfilled yet.
4. Existing string/lower-case status fields still need a dedicated future migration and code transition.
5. `ComplianceRuleCode` exists as an enum for future strictness, while `ComplianceRule.code` remains `String` for seed/backward compatibility.
6. Raw/deprecated sensitive columns still exist for compatibility and must be removed in a later cleanup phase after verified backfill.

## 14. Next Recommended Phase

Proceed to Phase 2C: Procurement/Catalogue Foundation.

Phase 2C should add catalogue, requirement, tender itemization, tender document, tender participant, quote response, direct purchase, bid item, and related procurement enum foundations additively, while keeping existing APIs working.
