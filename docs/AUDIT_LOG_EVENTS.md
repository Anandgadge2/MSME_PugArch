# Audit Log Events

Audit logs must avoid secrets and raw sensitive identifiers. Use masked values and hashes.

## Authentication

- `auth.register`
- `auth.login.success`
- `auth.login.failed`
- `auth.account.locked`
- `auth.logout`
- `auth.password_reset.requested`
- `auth.password_reset.completed`
- `auth.otp.verified`
- `auth.otp.failed`
- `auth.2fa.challenge_sent`

## Onboarding And Compliance

- `compliance.flag.created`
- `admin.section_status_updated`
- `admin.override.approved_flagged_profile`
- `api.write.completed`

## Files

- `file.uploaded`
- `file.viewed`
- `file.deleted`
- `file.upload_denied`
- `file.unauthorized_access`

## Procurement

- `tender.created`
- `tender.published`
- `tender.modified`
- `tender.status_updated`
- `tender.admin_override`
- `bid.submitted_or_modified`
- `bid.withdrawn`
- `bid.status_updated`
- `financial.bid_accepted_po_generated`

## Auction

- `auction.created`
- `auction.bid_placed`
- `auction.finalized`
- `auction.finalized_job`
- `auction.winner_selected`
- `auction.admin_override`

## Payments And Escrow

- `payment.initiated`
- `payment.failed`
- `payment.successful`
- `payment.webhook.failed_verification`
- `payment.webhook.duplicate_ignored`
- `escrow.funded`
- `escrow.released`
- `escrow.frozen`
- `escrow.refunded`
- `milestone.approved`

## Messaging, Disputes, Grievances

- `conversation.created`
- `message.sent`
- `dispute.created`
- `dispute.message_sent`
- `dispute.resolved`
- `grievance.created`
- `grievance.comment_added`
- `grievance.assigned`
- `grievance.resolved`
- `security.spam_attempt`

