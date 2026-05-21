# Production Hardening

This checklist is the final deployment gate for the MSME procurement portal.

## Environment

- `NODE_ENV=production`.
- `JWT_SECRET` is mandatory, at least 32 characters, stored in a secret manager.
- `DATABASE_URL` is mandatory and points to a least-privilege PostgreSQL user.
- `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` must contain only production origins.
- `LOG_LEVEL` must be `info`, `warn`, or `error`; never `debug` or `trace`.
- `APISETU_ALLOW_INSECURE_TLS=false`.
- Real Cloudinary/GCP, Redis, SMTP, and payment gateway secrets must come from environment variables only.
- Keep separate environment groups for development, staging, and production. Do not copy production secrets to local machines.

## Infrastructure

- HTTPS is required at the CDN/load balancer and between internal services where supported.
- PostgreSQL should be on a private network or strict IP allowlist.
- Redis should be on a private network, require authentication, and use TLS when the provider supports it.
- Database encryption at rest must be enabled.
- File storage encryption at rest must be enabled.
- Admin access should require MFA and be restricted by role, IP policy, or SSO where available.
- WAF/CDN is recommended for public endpoints.
- Centralized logging and alerting are required.
- Backups must be automated, encrypted, and restore-tested.

## Application Controls

- Security headers are applied through Helmet.
- CORS is allowlist-based.
- Request body limits are enforced.
- Rate limits are Redis-backed.
- OTP/session state is Redis-backed.
- File uploads validate extension, MIME, magic bytes, size, and executable signatures.
- Financial workflows use transactions and idempotency.
- Payment success is backend/provider confirmed.
- Auction operations use Redis locks.
- Audit logs cover security-sensitive writes and admin overrides.

## Production Data

- No mock/sample data is seeded in production.
- No test credentials are committed.
- No raw PAN/Aadhaar/bank values are returned in general API responses.
- No payment card, CVV, UPI PIN, or net-banking credentials are stored.

