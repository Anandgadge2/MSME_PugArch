# Threat Model

## Critical Assets

- User accounts, sessions, OTP state, and password hashes.
- PAN, GST, Aadhaar-derived hashes, bank fingerprints, KYB/KYC documents.
- Tender, bid, quotation, auction, purchase-order, invoice, payment, and escrow records.
- File assets and signed document access.
- Audit logs and compliance flags.

## Primary Actors

- Buyer organization user
- Seller organization user
- Platform admin/compliance officer
- Payment gateway/webhook sender
- Unauthenticated attacker
- Malicious authenticated buyer/seller
- Compromised account

## High-Risk Threats

- Broken object-level authorization across tenders, bids, files, disputes, payments.
- Fake seller/buyer registration with duplicate PAN/GST/bank/mobile/device.
- Credential stuffing and OTP abuse.
- Unsafe file uploads or document exposure.
- Payment webhook replay or forged payment success.
- Auction race conditions and collusion.
- Notification or messaging spam.
- Admin override without reason or audit evidence.

## Required Mitigations

- Every object route must authenticate, authorize, and verify ownership.
- Frontend role/userId values are never trusted.
- Sensitive identifiers must be masked or fingerprinted.
- Payment success must come from backend/provider confirmation.
- Redis locks protect critical financial and auction operations.
- Admin overrides require remarks and audit events.
- Security logs must avoid secrets and raw high-risk PII.

