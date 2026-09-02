<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.

---

## Mandatory Standards: VPAT & Security Audit Compliance

This project must strictly adhere to **VPAT (WCAG 2.1 / 2.2 Level AA)** accessibility standards and comprehensive **Defensive Security Guidelines**. All future UI components, backend APIs, and refactorings must comply with these requirements:

### 1. Accessibility (VPAT / WCAG 2.1 AA) Standards
* **Keyboard Operability (WCAG 2.1.1 & 2.1.2)**: Every interactive element (buttons, tabs, links, dropdowns, table actions) must be navigable and operable using only a keyboard. Focus must be trapped inside modals/drawers and returned to the trigger element upon closing.
* **Form Semantics & Labels (WCAG 1.3.1 & 4.1.2)**: Every form input must have an explicitly linked `<label>` (via `htmlFor` / `id`), clear error indicators, and `aria-invalid` / `aria-describedby` when errors occur.
* **Color Contrast (WCAG 1.4.3)**: Text and critical icons must maintain a minimum contrast ratio of **4.5:1** against backgrounds (and **3:1** for large text / graphical objects).
* **Screen Reader & Live Regions (WCAG 4.1.3)**: Asynchronous status changes, toast alerts, step transitions, and error messages must use `aria-live="polite"` or `role="status"` / `role="alert"`.
* **Alternative Text (WCAG 1.1.1)**: All meaningful images, avatars, banners, and logos must include descriptive `alt` text. Purely decorative icons must use `aria-hidden="true"`.
* **Bypass Blocks (WCAG 2.4.1)**: Maintain a "Skip to Main Content" link at the root layout for keyboard and screen reader navigation.

### 2. Security & Defensive Coding Standards
* **Authorization & Scoping (BOLA / IDOR Prevention)**: Every mutating and sensitive reading endpoint must enforce RBAC, organization tenancy checks, and district scoping.
* **Input Validation & Sanitization**: Enforce strict Zod schemas on all endpoints and strip null bytes and injection characters.
* **CSRF & Rate Limiting**: Keep CSRF token checks and IP/User rate limiting intact across all mutating routes.
* **PII & Data Masking**: Ensure sensitive financial and identity data (Aadhaar, PAN, Bank Accounts, GSTIN) are masked in responses and logs.
* **Cryptographic & Financial Integrity**: Use constant-time comparison for webhooks/signatures and idempotency locks for escrow/payment state transitions.

### 3. Absolute Rule: Real Production Data Only (Zero Mock, Seeded, or Dummy Fallbacks)
* **Zero Dummy / Mock Data**: All statistics, metrics, charts, tables, lists, and cards across the frontend and backend must strictly reflect authentic database records.
* **No Synthetic Percentages or Fictitious Records**: Never use artificial multipliers, simulated trends, fabricated clusters, or mock fallback datasets.
* **Empty / Zero States**: If there are no records for a given metric, period, or filter, render legitimate zeroes (`0`, `₹0.00`, `0%`) or clean empty state UI rather than inventing dummy data.
