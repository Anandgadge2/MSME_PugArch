# Deployment Security Checklist

## Environment

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` is strong and rotated through secret manager.
- [ ] `DATABASE_URL` uses least-privilege DB user.
- [ ] Redis requires password and private-network access.
- [ ] `REDIS_TLS=true` only when the Redis endpoint supports TLS.
- [ ] Cloudinary/payment/GCP/SMTP secrets stored outside git.
- [ ] CORS allowlist includes only production frontend origins.

## Infrastructure

- [ ] Database is not publicly exposed unless firewall allowlist is strictly controlled.
- [ ] Backups are encrypted and restore-tested.
- [ ] Logs are shipped to restricted retention storage.
- [ ] TLS termination is enforced.
- [ ] Security headers are verified.
- [ ] Upload size limits are enforced at proxy and app layers.

## Release Gates

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run prisma:validate`
- [ ] `npm run lint:security`
- [ ] `npm run test:security`
- [ ] `npm run build`
- [ ] `npm run audit:deps`
- [ ] `npx prisma migrate deploy`

## Manual Penetration Test Checklist

- [ ] Authentication testing
- [ ] Role bypass testing
- [ ] IDOR/BOLA testing
- [ ] File upload testing
- [ ] Payment webhook testing
- [ ] Auction abuse/race testing
- [ ] API rate-limit testing
- [ ] XSS testing
- [ ] SQL injection testing
- [ ] SSRF testing
- [ ] CORS testing
- [ ] Security header testing

