# Security & Compliance Guardrails

This document is engineering guidance, not legal advice. Actual Iranian/German import, tax, ecommerce, consumer, cosmetics, perfume, supplements, and customs requirements must be reviewed for the real operation.

## 1. Regulated categories

The database may support broad categories, but do not enable:
- supplements,
- medicines/medical products,
- other regulated goods

until an explicit compliance review confirms the required process.

Use feature flags.

## 2. Authenticity claims

Do not let code or AI claim that scraping a reputable page proves a physical unit is authentic.

RAVA can strongly communicate its operational guarantee through:
- approved source,
- saved receipt,
- purchase record,
- refund/guarantee policy.

Final guarantee wording must match the business's enforceable policy.

## 3. Retailer terms

Automation must be source-specific and respectful.

No bypass behavior.

Where an API/feed/affiliate source exists and is suitable, prefer it.

## 4. Secrets

- `.env` ignored,
- `.env.example` contains placeholders only,
- never commit tokens,
- never show secrets in admin/client,
- scrub logs.

## 5. RBAC

All admin actions server-authorized.

Roles:
OWNER, ADMIN, MERCHANDISER, BUYER_GERMANY, SUPPORT, FINANCE, CONTENT_EDITOR.

Use least privilege.

## 6. High-risk actions

Require:
- re-auth or confirmation where appropriate,
- explicit reason,
- audit record.

Examples:
- price/order total override,
- marking payment approved,
- refund,
- customer PII export,
- deleting purchase evidence,
- source trust change,
- enabling auto-publish.

## 7. Uploads

Customer receipts/request images:
- type/size limits,
- generated object names,
- no executable serving,
- private by default,
- malware scanning hook if available,
- strip dangerous metadata where appropriate.

## 8. Web security

- HTTPS production,
- secure/httpOnly/sameSite cookies,
- CSRF protections appropriate to framework,
- CSP,
- input validation,
- output escaping,
- SQL through parameterized ORM/query,
- SSRF protections on server fetch features,
- safe image proxying,
- open-redirect protection.

## 9. URL fetching / request-a-product

If server fetches a customer URL:
- only http/https,
- resolve DNS safely,
- block private/internal IP ranges,
- response size/time limit,
- redirects limited,
- no arbitrary file protocols.

## 10. Payments

- never store bank card credentials,
- verify gateway server-to-server,
- compare expected amount,
- idempotency,
- reconciliation.

## 11. PII

Collect only necessary:
- name/contact/address/order info.

Customer data export/delete workflow should be architected.

Internal notes must never leak to customer.

## 12. Backups

Production:
- automated PostgreSQL backup,
- object storage backup/versioning strategy,
- periodic restore test.

## 13. Audit

Append-only audit trail for:
- money,
- order state,
- source trust,
- pricing overrides,
- auth/security changes,
- publication policies.

## 14. Dependency security

- lockfile,
- vulnerability scanning in CI,
- avoid abandoned dependencies,
- review major upgrades.

## 15. Admin exposure

Admin paths are not “secure because hidden”.
Require auth, RBAC, and rate limits.

## 16. AI

AI has no direct authority to:
- approve payment,
- issue refund,
- change locked price,
- mark purchase complete,
- activate authenticity guarantee,
- publish high-risk items.
