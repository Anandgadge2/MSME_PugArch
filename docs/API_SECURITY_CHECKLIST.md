# API Security Checklist

Use this checklist for every new or changed API.

- [ ] Route requires authentication unless intentionally public.
- [ ] Route uses backend role checks.
- [ ] Route performs object ownership or relationship checks.
- [ ] Request body, params, and query are validated with Zod or equivalent.
- [ ] Route is rate limited when exposed to user input or expensive operations.
- [ ] Write operation emits audit log with actor, entity, IP, user agent, and safe metadata.
- [ ] Errors are safe and do not leak stack traces, SQL, Prisma internals, secrets, or PII.
- [ ] Response excludes password hashes, tokens, raw Aadhaar, full bank account, and payment secrets.
- [ ] File access uses `FileAsset` ownership and signed URLs.
- [ ] Financial writes use transactions and idempotency.
- [ ] Webhooks verify signatures and reject replays.
- [ ] Admin override requires reason.
- [ ] CORS, security headers, request size limits, and HPP protection remain enabled.

## Manual Validation Coverage Notes

Zod validation is required for all newly hardened S7/S8 procurement, auction, messaging, dispute, and grievance routes. Legacy routes still in `backend/index.ts` should be migrated module by module and tracked during external audit remediation.

