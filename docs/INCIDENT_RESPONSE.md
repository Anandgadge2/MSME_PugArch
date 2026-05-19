# Incident Response

## Severity Levels

- Critical: active compromise, payment/escrow integrity risk, secret leakage, auth bypass, bulk PII exposure.
- High: exploitable IDOR, privilege escalation, webhook forgery, unsafe file execution path.
- Medium: isolated data exposure, rate-limit bypass, audit gap.
- Low: hardening defect with limited exploitability.

## Response Steps

1. Triage and assign severity.
2. Preserve logs, request IDs, audit events, and affected account/entity IDs.
3. Contain: disable compromised credentials, rotate secrets, block IPs, freeze affected payments/escrow if needed.
4. Eradicate root cause with reviewed patch.
5. Recover service and verify controls.
6. Notify affected stakeholders according to legal/compliance requirements.
7. Write post-incident report with timeline, impact, remediation, and prevention tasks.

## Evidence To Capture

- request IDs,
- actor user IDs and roles,
- IP/user-agent,
- audit log events,
- affected entity IDs,
- webhook event IDs,
- payment/escrow references,
- file asset IDs,
- deployed commit SHA.

## Secret Rotation

Rotate relevant JWT, database, Redis, Cloudinary, GCP, SMTP, and payment gateway secrets after suspected leakage. Invalidate sessions by incrementing session versions where user accounts are affected.

