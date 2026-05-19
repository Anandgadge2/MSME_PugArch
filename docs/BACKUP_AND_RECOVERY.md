# Backup And Recovery

## PostgreSQL Backup

- Run automated daily full backups and frequent point-in-time recovery where the provider supports WAL/PITR.
- Encrypt backups at rest.
- Restrict backup restore permissions to database administrators.
- Retain production backups according to legal and procurement compliance requirements.
- Test restore at least monthly in an isolated environment.

Example managed-database checklist:

- [ ] PITR enabled.
- [ ] Daily snapshots enabled.
- [ ] Backup retention configured.
- [ ] Restore runbook tested.
- [ ] Backup alerts configured.

## File Storage Backup

- Cloudinary/GCP document objects are procurement evidence and must be retained according to policy.
- Use provider-level versioning or backup/export where available.
- Keep metadata in PostgreSQL `FileAsset`; object storage should be recoverable by key.
- Signed URLs are temporary and are not a backup mechanism.

## Redis Recovery

Redis is not a permanent source of truth. It is used for:

- rate limits,
- OTP/session state,
- distributed locks,
- queues/events,
- short-lived cache.

If Redis is lost, users may need to request new OTPs and in-flight locks may expire. Persistent records must come from PostgreSQL.

## Restore Process

1. Declare incident and freeze risky operations if payment/escrow integrity may be affected.
2. Restore PostgreSQL to a new isolated instance.
3. Validate migrations and row counts.
4. Restore or verify file storage objects.
5. Rotate credentials if compromise is suspected.
6. Point staging app to restored database for validation.
7. Promote restored service after sign-off.
8. Record audit evidence and incident timeline.

## Disaster Recovery Checklist

- [ ] RTO/RPO approved by stakeholders.
- [ ] Database restore tested.
- [ ] File restore tested.
- [ ] Secrets rotation tested.
- [ ] DNS/CDN failover documented.
- [ ] Admin communication channel documented.
- [ ] Payment gateway replay/reconciliation process documented.

