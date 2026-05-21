# Observability

## Structured Logs

The backend uses Pino for structured request and application logs. Logs include request ID, method, URL, actor ID/role when available, response status, and latency. Sensitive fields are redacted.

## Request ID

Every request receives an `x-request-id` header. Include this ID in support tickets, incident reports, and audit investigations.

## Security Events

Security-sensitive actions are written through audit logging:

- login success/failure,
- account lock,
- OTP success/failure,
- file access,
- tender/bid/auction writes,
- payment/webhook/escrow events,
- messaging/dispute/grievance writes,
- admin overrides,
- spam/rate-limit events.

## Error Tracking Placeholder

Production should connect the backend logger to a central platform such as Cloud Logging, Datadog, Sentry, OpenTelemetry collector, or SIEM. The app currently exposes a structured logging hook; add provider transport in `backend/src/config/logger.ts` when selected.

## Admin Alert Hooks

Admin alert hooks should be wired for:

- repeated failed login or account lock,
- webhook verification failure,
- duplicate webhook replay,
- escrow freeze,
- auction finalization failure,
- suspicious duplicate PAN/GST/bank/device/IP flags,
- high or critical compliance violations.

## Monitoring Requirements

- API latency and 5xx rate.
- Database connection errors.
- Redis availability.
- Payment webhook verification failures.
- Queue/lock failures.
- Upload rejection spikes.
- Authentication failure spikes.
- Audit log persistence failures.

