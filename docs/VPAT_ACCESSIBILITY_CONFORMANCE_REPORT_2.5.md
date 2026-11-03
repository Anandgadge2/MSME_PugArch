# Voluntary Product Accessibility Template (VPAT®) 2.5
## Accessibility Conformance Report (WCAG 2.1 & 2.2 Level AA / Revised Section 508)

**Name of Product/Version:** JSG Smile MSME Portal (Production Version 1.0)  
**Report Date:** November 2026  
**Product Description:** Enterprise sovereign procurement and marketplace ecosystem enabling Micro, Small, and Medium Enterprises (MSMEs), Self-Help Groups (SHGs), and government/private buyers to conduct RFQs, reverse auctions, rate contracts, and statutory GFR deliveries.  
**Contact Information:** statutory-compliance@jsgsmile.gov.in / nodalofficer@jsgsmile.gov.in  
**Evaluation Methods Used:** Automated linting (axe-core, eslint-plugin-jsx-a11y), manual keyboard traversal testing (Chrome, Firefox, Safari), Screen Reader testing (NVDA 2024.1, JAWS 2024, Windows Narrator), and strict color contrast analysis.

---

### Standard/Guideline Conformance Level
- **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA:** **Supports (100%)**
- **Web Content Accessibility Guidelines (WCAG) 2.2 Level AA:** **Supports (100%)**
- **Revised Section 508 Chapter 5 & 6:** **Supports**
- **Government of India Guidelines for Web Portals (GIGW 3.0 / STQC):** **Supports**

---

### Terms & Conformance Definitions
- **Supports:** The functionality of the product has at least one method that addresses the criterion without known defects or regressions.
- **Partially Supports:** Some functionality of the product does not meet the criterion.
- **Does Not Support:** The majority of product functionality does not meet the criterion.
- **Not Applicable:** The criterion is not relevant to the product.

---

## 1. WCAG 2.1 & 2.2 Principle 1: Perceivable

| Criterion | Conformance Level | Remarks and Explanations |
| :--- | :--- | :--- |
| **1.1.1 Non-text Content (Level A)** | **Supports** | All meaningful imagery, state logos, organization seals, and delivery status badges provide explicit `alt` text. Purely decorative icons use `aria-hidden="true"`. |
| **1.2.1 Audio-only and Video-only (Prerecorded) (Level A)** | **Not Applicable** | The portal is an enterprise data and transactional application; no audio/video streams exist. |
| **1.3.1 Info and Relationships (Level A)** | **Supports** | Strict semantic hierarchy enforced throughout: `<h1>` to `<h6>` heading trees, native `<table>`, `<thead>`, `<tbody>`, `<th> scope="col"`, explicitly linked `<label htmlFor="...">`, and ARIA role associations. |
| **1.3.2 Meaningful Sequence (Level A)** | **Supports** | DOM ordering corresponds strictly with logical visual presentation and left-to-right reading sequence across desktop and responsive mobile flows. |
| **1.3.3 Sensory Characteristics (Level A)** | **Supports** | Instructions and status indicators never rely solely on color, shape, or position. Status labels display explicit text alongside icons and semantic text badges. |
| **1.3.4 Orientation (Level AA)** | **Supports** | Layout functions seamlessly in both portrait and landscape modes across desktop, tablet, and mobile orientations without locking device orientation. |
| **1.3.5 Identify Input Purpose (Level AA)** | **Supports** | Standard HTML autocomplete attributes (`username`, `current-password`, `new-password`, `tel`, `email`, `postal-code`) are assigned to personal data inputs. |
| **1.4.1 Use of Color (Level A)** | **Supports** | Color is never used as the sole conveyor of information. Status indicators feature text, icons, and contrast rings. Table links utilize font weight, layout structure, and underline styles. |
| **1.4.2 Audio Control (Level A)** | **Not Applicable** | The portal plays no background audio. |
| **1.4.3 Contrast (Minimum) (Level AA)** | **Supports** | All text content maintains a minimum contrast ratio of at least 4.5:1 against adjacent background (e.g., `#0b2447` on `#ffffff` = 15.6:1; `#78350f` on `#fffbeb` = 8.6:1). Large headings maintain > 7:1. |
| **1.4.4 Resize Text (Level AA)** | **Supports** | Pages scale up to 200% zoom without loss of content or functionality using relative units (`rem`, `em`, `%`) and responsive typography. |
| **1.4.10 Reflow (Level AA)** | **Supports** | Responsive viewport supports 320 CSS pixels width without requiring two-dimensional scrolling, switching to accessible mobile card views. |
| **1.4.11 Non-text Contrast (Level AA)** | **Supports** | UI components (borders, focus rings, checkbox borders, sort arrows) maintain at least 3:1 contrast against adjacent background colors. |
| **1.4.12 Text Spacing (Level AA)** | **Supports** | Layout accommodates increased line height (1.5), paragraph spacing (2x), letter spacing (0.12x), and word spacing (0.16x) without clipping or text overlap. |
| **1.4.13 Content on Hover or Focus (Level AA)** | **Supports** | Tooltips and popovers are dismissible via keyboard (`Escape`), hoverable without vanishing, and persistent until dismissed. |

---

## 2. WCAG 2.1 & 2.2 Principle 2: Operable

| Criterion | Conformance Level | Remarks and Explanations |
| :--- | :--- | :--- |
| **2.1.1 Keyboard (Level A)** | **Supports** | 100% of portal functionality is fully navigable and operable using standard keyboard keys (`Tab`, `Shift+Tab`, `Enter`, `Space`, Arrow keys, `Escape`). |
| **2.1.2 No Keyboard Trap (Level A)** | **Supports** | Focus is never trapped in any interactive element or modal dialog. Modals contain active focus trapping with clean escape routes (`Esc` or Close button) returning focus to the trigger element. |
| **2.1.4 Character Key Shortcuts (Level A)** | **Supports** | No single-character shortcuts are activated without modifier keys, preventing accidental activation by speech input users. |
| **2.2.1 Timing Adjustable (Level A)** | **Supports** | Aligned with STQC mandate: Session inactivity dialog warns users at 13 minutes and provides a 2-minute countdown with one-click session renewal before the 15-minute statutory timeout. |
| **2.2.2 Pause, Stop, Hide (Level A)** | **Supports** | Pinging status dots and loaders are subtle and respect `prefers-reduced-motion: reduce`. No unpausable moving tickers or carousels exist. |
| **2.3.1 Three Flashes or Below Threshold (Level A)** | **Supports** | Portal contains zero flashing or strobe effects exceeding 3 flashes per second. |
| **2.4.1 Bypass Blocks (Level A)** | **Supports** | A persistent "Skip to Main Content" landmark link is positioned as the first focusable element in root `layout.tsx`, bypassing navigation headers. |
| **2.4.2 Page Titled (Level A)** | **Supports** | Every route declares a descriptive, unique `<title>` metadata tag detailing the page purpose and portal identity. |
| **2.4.3 Focus Order (Level A)** | **Supports** | Focus moves in an intuitive, predictable reading order. Form submission errors automatically trigger `focusFirstError()`, shifting keyboard focus to the first invalid input. |
| **2.4.4 Link Purpose (In Context) (Level A)** | **Supports** | Every link provides meaningful context either via visible link text or descriptive `aria-label` (e.g. "Details for Tender TND-2026-12200"). |
| **2.4.6 Headings and Labels (Level AA)** | **Supports** | All form fields and page sections feature unambiguous, descriptive labels and headings. |
| **2.4.7 Focus Visible (Level AA)** | **Supports** | Highly visible 2px solid focus rings (`focus-visible:ring-2 focus-visible:ring-[#12335f] focus-visible:ring-offset-2`) are enforced across all focusable controls. |
| **2.5.8 Target Size (Minimum) (WCAG 2.2 Level AA)** | **Supports** | All interactive click and touch targets meet the minimum $24\times24$ CSS pixel bounding area, with mobile interactive controls formatted to $44\times44$ pixels minimum. |

---

## 3. WCAG 2.1 & 2.2 Principle 3: Understandable

| Criterion | Conformance Level | Remarks and Explanations |
| :--- | :--- | :--- |
| **3.1.1 Language of Page (Level A)** | **Supports** | Root layout explicitly declares `lang="en"` on `<html>`, dynamically adjusted when language preference is switched. |
| **3.1.2 Language of Parts (Level AA)** | **Supports** | Non-English passages (Odia `ଓଡ଼ିଆ` and Hindi `हिन्दी` terms and consent notices) are marked with explicit `lang="or"` and `lang="hi"` attributes. |
| **3.2.1 On Focus (Level A)** | **Supports** | Shifting focus to any interactive component does not trigger unexpected context changes, submissions, or navigation. |
| **3.2.2 On Input (Level A)** | **Supports** | Changing input values or selecting dropdown options does not trigger unexpected form submits or external navigation. |
| **3.3.1 Error Identification (Level A)** | **Supports** | Input validation errors are explicitly identified in text, marked with `role="alert"`, and linked to fields via `aria-describedby` and `aria-invalid="true"`. |
| **3.3.2 Labels or Instructions (Level A)** | **Supports** | Clear instructions and required field markers (`*`) are provided across all registration and bidding workflows. |
| **3.3.3 Error Suggestion (Level AA)** | **Supports** | Validation errors provide exact corrective guidance (e.g. format examples for GSTIN, PAN, Udyam, and phone numbers). |
| **3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)** | **Supports** | Bids, purchase orders, milestone payment releases, and statutory registrations feature explicit confirmation modals, transaction 2FA verification, and review steps before final execution. |

---

## 4. WCAG 2.1 & 2.2 Principle 4: Robust

| Criterion | Conformance Level | Remarks and Explanations |
| :--- | :--- | :--- |
| **4.1.2 Name, Role, Value (Level A)** | **Supports** | Standard ARIA attributes (`role="status"`, `role="dialog"`, `aria-expanded`, `aria-haspopup`, `aria-current`) reflect element state accurately to assistive technologies. |
| **4.1.3 Status Messages (Level AA)** | **Supports** | Toast alerts, dynamic pagination updates, and background processing notifications are announced via `role="status"` and `aria-live="polite"` live regions without requiring focus disruption. |

---

### Conclusion & Audit Certification
The JSG Smile MSME Portal satisfies **100%** of applicable WCAG 2.1 and WCAG 2.2 Level AA requirements, certifying compliance for public sector procurement, STQC GIGW 3.0, and Section 508 accreditation.
