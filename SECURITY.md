# Security Policy

This portal is designed for government-grade MSME procurement workflows. Security work follows OWASP ASVS 5.0.0 principles, OWASP API Security Top 10 2023, least privilege, and backend-enforced ownership checks.

## Supported Security Baseline

- Authentication: JWT access tokens with session-version invalidation.
- Authorization: backend RBAC and object ownership checks.
- Validation: Zod validation for security-critical routes.
- Rate limiting: Redis-backed limits for auth, OTP, uploads, payments, messaging, disputes, and grievances.
- Logging: structured logs without secrets or raw sensitive identifiers.
- Audit: centralized audit events for auth, onboarding, procurement, payment, file, dispute, grievance, and admin actions.
- Files: MIME, extension, size, magic-byte, executable-signature checks, secure names, and signed access.

## Reporting Vulnerabilities

Report suspected vulnerabilities privately to the project maintainers. Include:

- affected endpoint or module,
- reproduction steps,
- impact,
- screenshots or logs with secrets redacted,
- suggested severity.

Do not post exploit details in public issues.

## Secret Handling

Never commit `.env`, private keys, production service-account JSON, API keys, SMTP passwords, Redis credentials, database URLs, JWT secrets, payment gateway secrets, or webhook secrets. Use `.env.example` for names only.

Recommended local checks before commits:

```bash
npm run security:check
git diff --check
git status --short
```

Recommended external secret scanners:

- GitHub secret scanning
- Gitleaks
- TruffleHog

## Dependency Security

CI runs `npm audit --workspaces --audit-level=high`. Moderate issues are reviewed before release; high and critical issues block release unless a documented compensating control is approved.

