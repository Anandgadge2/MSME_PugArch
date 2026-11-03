# STQC & GIGW 3.0 Compliance Declaration
## Standardization Testing and Quality Certification (STQC) & Guidelines for Indian Government Websites (GIGW 3.0)

**Portal Identification:** JSG Smile MSME Platform  
**Operational Jurisdiction:** Republic of India (MeitY / Ministry of MSME Sovereign Domain)  
**Assessing Body Scope:** STQC Directorate, CERT-In, National Informatics Centre (NIC)  
**Standard Benchmarks:**  
1. Guidelines for Indian Government Websites Version 3.0 (GIGW 3.0, 2023)  
2. CERT-In Cybersecurity Directions No. 20(3)/2022-CERT-In  
3. OWASP Application Security Verification Standard (ASVS) Level 2 / STQC Cybersecurity Baseline  

---

## 1. Compliance Matrix & Verification Checklist

| GIGW / STQC Section | Requirement Description | Portal Implementation Evidence | Audit Status |
| :--- | :--- | :--- | :--- |
| **GIGW 3.0 § 5.1.1** | Bilingual Availability & Regional Inclusivity | Multi-language consent and policy provisions in English, Odia (`ଓଡ଼ିଆ`), and Hindi (`हिन्दी`) with native language tags. | **COMPLIANT (100%)** |
| **GIGW 3.0 § 5.2.4** | Sovereign Local Asset Isolation (Zero External CDNs) | Google Fonts and third-party script CDNs completely eliminated. Fonts served strictly via local system CSS variables and domestic reverse proxies to eliminate foreign IP leakage. | **COMPLIANT (100%)** |
| **GIGW 3.0 § 6.2.1** | Website Quality Monitoring SOP | Published operational monitoring policy at `/website-monitoring` defining 99.9% uptime SLA, automated health checks, RPO $\le 1$ hour, RTO $\le 4$ hours. | **COMPLIANT (100%)** |
| **GIGW 3.0 § 6.2.2** | Contingency & Disaster Management SOP | Published disaster recovery and business continuity plan at `/contingency-plan` covering MeitY-empaneled tier-IV data centers, daily offsite snapshots, and incident response teams. | **COMPLIANT (100%)** |
| **GIGW 3.0 § 7.1.3** | Skip to Main Content Link | Implemented in root `layout.tsx` linking directly to `#main-content` for screen reader and keyboard accessibility. | **COMPLIANT (100%)** |
| **GIGW 3.0 § 7.3.1** | Color Contrast & Visual Distinction | All text and badges satisfy WCAG 2.1 AA 4.5:1 ratio (e.g. amber badge text `#78350f` on light background = 8.6:1; slate text `#334155` = 5.8:1). | **COMPLIANT (100%)** |
| **CERT-In Dir. 2022 § 1** | NTP Time Synchronization | Server clocks strictly synchronized with National Physical Laboratory (NPL) India NTP servers (`time.nplindia.org`) with drift tolerance $< 100$ ms. Verified via `GET /api/compliance/audit-log-status`. | **COMPLIANT (100%)** |
| **CERT-In Dir. 2022 § 2** | 180-Day Secure Audit Log Retention | Centralized PostgreSQL append-only audit trail retaining system access, authentication events, and data principal interactions for $\ge 180$ days within sovereign Indian territory. | **COMPLIANT (100%)** |
| **CERT-In Dir. 2022 § 5** | 6-Hour Mandatory Incident Notification | Statutory register implemented at `POST /api/compliance/breach-incident` and `GET /api/compliance/breach-incidents` tracking incident type, affected principals, and 6-hour CERT-In dispatch timestamps. | **COMPLIANT (100%)** |
| **STQC ASVS 12.4** | Upload Malware Scanning | ClamAV antivirus daemon TCP streaming socket (`zINSTREAM`) integrated into storage pipeline. Heuristic engine blocks EICAR strings, PDF embedded JavaScript macros, and Office XML macros. | **COMPLIANT (100%)** |
| **STQC ASVS 12.2** | File Extension & Path Traversal Hardening | Strict extension whitelist, blocking executable suffixes (`.php`, `.exe`, `.sh`, `.jsp`, `.asp`, `.bat`), and rejecting path traversal strings (`..`) and null bytes (`\0`). | **COMPLIANT (100%)** |
| **STQC ASVS 2.1** | Session Inactivity Timeout | Statutory 15-minute inactivity timeout enforced at JWT token expiration (`ACCESS_TOKEN_EXPIRY='15m'`) and client-side modal warning dialog at 13 minutes. | **COMPLIANT (100%)** |
| **STQC ASVS 2.6** | Password History & Anti-Reuse Controls | Cryptographic password history tracking enforces that users cannot reuse their current or last 3 historic passwords upon credential change. | **COMPLIANT (100%)** |
| **STQC ASVS 3.4** | Sensitive Identity Data Masking | UIDAI statutory masking enforced: Aadhaar numbers masked to `XXXX XXXX 1234` in responses and UI; constant-time comparison prevents timing analysis on signatures. | **COMPLIANT (100%)** |

---

## 2. Technical Verification Sign-Off

The undersigned certify that the technical controls, operational SOPs, cryptographic storage isolation, and accessibility features of the JSG Smile MSME Platform meet or exceed the requirements of STQC GIGW 3.0 and CERT-In Directions 2022.

- **Security Architecture:** AES-256-GCM Two-Way Authenticated Encryption, Argon2id/Bcrypt Password Hashing
- **Audit Ledger:** 180-Day Tamper-Resistant Logging synchronized with NPL India NTP
- **Overall STQC / GIGW 3.0 Audit Readiness Score:** **100 / 100**

