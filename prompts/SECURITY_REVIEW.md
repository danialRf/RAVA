# RAVA Security Review

Review only; do not add unrelated features.

Threat-model:
- auth/account takeover,
- admin RBAC bypass,
- payment callback forgery/replay,
- quote manipulation,
- price tampering,
- upload abuse,
- SSRF through product-request URLs,
- secret leakage,
- scraper injection/poisoned source data,
- Telegram token leakage,
- XSS from retailer/customer text,
- IDOR on orders/documents,
- audit log gaps.

Verify with tests where possible.

Output blockers/high issues with remediation criteria.
