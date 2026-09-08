# RAVA — Codex Project Kit

This repository kit is the operating manual for building **RAVA**, a Persian-first, mobile-first commerce and sourcing platform for customers in Iran purchasing authentic, lightweight products sourced in Germany.

Do not treat RAVA as a generic ecommerce template. It is a combination of:

- ecommerce storefront,
- Germany sourcing/pre-order system,
- live FX quote engine,
- deposit + balance payment workflow,
- retailer/deal ingestion platform,
- product provenance/source system,
- admin operating system,
- Telegram publishing system,
- deterministic content/visual generation pipeline,
- later: optional AI merchandising automation.

## The core business model

Customers browse products sourced from Germany. Public product prices are estimates because EUR/Toman rates change rapidly. When checkout begins, RAVA creates a short-lived quote using the freshest available exchange-rate snapshot. The customer pays a configurable deposit, normally around 35% and up to 50% for higher-risk products. The product is then procured in Germany. Once procurement is confirmed, the total Toman price is locked and the remaining balance is due close to/after arrival in Iran according to order policy.

Typical delivery lead time is **2–6 months**.

Products are acquired by the owner and trusted family/friends in Germany and transported in periodic Germany → Iran trips/drops.

## The brand

Name: **RAVA**
Persian display: **روا**

Core promise:
**اصل، آن‌طور که باید باشد.**

Positioning:
Approachable premium / trusted sourcing. Not cheap-looking, not ultra-luxury, not a black-and-gold “luxury shop”, and not an AI-startup aesthetic.

Primary market:
Iranian consumers who care about authentic products and trustworthy provenance but want a more rational price than many local channels.

## Read these files before coding

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/BRAND_SYSTEM.md`
4. `docs/ARCHITECTURE.md`
5. `docs/DATABASE_SPEC.md`
6. `docs/PRICING_ENGINE.md`
7. `docs/STOREFRONT_SPEC.md`
8. `docs/ADMIN_SPEC.md`
9. `docs/SCRAPER_SPEC.md`
10. `docs/CONTENT_PIPELINE.md`
11. `docs/AUTH_PAYMENTS.md`
12. `docs/SECURITY_COMPLIANCE.md`
13. `docs/TESTING_QA.md`
14. `docs/PROJECT_STATE.md`
15. the relevant phase prompt in `/prompts`

## How the owner should use this kit with Codex

Do **not** paste every prompt into one conversation and ask Codex to build everything at once.

### Step 1 — Prepare Windows

Install:

- ChatGPT/Codex desktop app for Windows
- Git
- Node.js current Active LTS
- Docker Desktop using the WSL2 backend
- optional but useful: VS Code
- optional later: GitHub CLI

Keep the project on the Windows filesystem, for example:

`C:\Projects\rava`

### Step 2 — Create an empty Git repository

Open PowerShell:

```powershell
mkdir C:\Projects\rava
cd C:\Projects\rava
git init
```

Extract **the contents of this kit** into that folder.

The root of `C:\Projects\rava` should contain `AGENTS.md`, `README_FIRST.md`, `/docs`, `/prompts`, etc.

### Step 3 — Open the folder in Codex

Open `C:\Projects\rava` as a project in the Codex Windows app.

Use the sandbox / approval mode. Do not give unrestricted filesystem access unless truly required.

### Step 4 — Bootstrap

Open `prompts/00_BOOTSTRAP.md`.

Send its contents to Codex.

Let Codex finish. Do not interrupt it to ask for constant status updates.

When it finishes, ask it to run all checks again and summarize:
- files changed,
- commands run,
- test results,
- unresolved issues.

### Step 5 — Review every phase

After an implementation phase, start a **separate review chat** in the same repository and paste `prompts/REVIEW_PHASE.md`, replacing the phase placeholder.

The reviewer should first review and test. It should not redesign the product or add unrelated features.

If it reports blocking issues, return to the implementation chat and paste the report with:

> Fix every blocking/high-severity issue in this review. Do not add unrelated features. Re-run all tests and update PROJECT_STATE.md.

Then run the reviewer again.

### Step 6 — Only then continue

Run:

`01_DESIGN_SYSTEM.md`
then
`02_DOMAIN_DATABASE.md`
then
`03_STOREFRONT_CATALOG.md`
and so on.

The order matters. Later phases depend on contracts created earlier.

### Step 7 — Git safety

After a phase passes:
```powershell
git status
git add .
git commit -m "phase XX: short description"
```

Codex may create the local commit if Git identity is configured, but it must **never push to a remote without explicit permission**.

## Things Codex cannot magically obtain

The code can be fully prepared with local/fake providers first, but the owner eventually needs to create/provide:

- domain name and DNS access,
- production server/VPS credentials,
- Google OAuth client credentials,
- Iranian SMS provider credentials,
- Iranian payment gateway merchant credentials,
- Telegram bot token + destination channel,
- FX-rate provider API key if the selected provider requires one,
- SMTP/email provider credentials if transactional email is enabled,
- any commercially licensed font files/license,
- legal/privacy/returns text approved for the actual business,
- retailer/API/affiliate credentials where applicable.

Until then Codex must use fake/dev adapters behind stable interfaces.

## Critical rule

**Never let Codex replace a missing external credential by hardcoding a secret, scraping a private account, bypassing a protection mechanism, or inventing a successful integration.**

## Run the completed local MVP

Open Docker Desktop, wait until its engine is running, then open PowerShell in
the repository root and run:

```powershell
pnpm.cmd launch
```

This single command starts the local infrastructure, applies migrations, builds
the production application and starts both the website and background worker.
The storefront and admin then use one fixed address:

`http://localhost:3000`

Keep that PowerShell window open. Press `Ctrl+C` once to stop the website and
worker; the database containers intentionally remain available for the next run.
Production launch requirements are listed in `docs/PRODUCTION_CHECKLIST.md`.
