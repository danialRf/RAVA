# Phase 0 — Bootstrap Repository

Read `AGENTS.md`, `MASTER_PROMPT.md`, all docs, and `docs/PROJECT_STATE.md`.

Build the project foundation only.

Requirements:
- initialize a pnpm workspace monorepo,
- create `apps/web`, `apps/worker`, and shared packages per architecture,
- current stable Next.js App Router + TypeScript,
- strict TypeScript,
- lint/format,
- environment validation,
- Docker Compose for PostgreSQL, Redis, and local S3-compatible storage,
- Drizzle package skeleton and migration workflow,
- Vitest,
- Playwright Test,
- basic CI workflow if repository supports it,
- copy `.env.example` from template to root example,
- safe `.gitignore`,
- root scripts: dev, build, lint, typecheck, test, test:e2e,
- a minimal `/health` path/endpoints that verify application process and optionally dependencies,
- no production integration credentials required.

Create a minimal RAVA page proving:
- Persian,
- RTL,
- RAVA tokens wired,
- responsive shell.

Do not build ecommerce features yet.

Verification:
- install succeeds,
- Docker dependencies start,
- migrations can run,
- web starts,
- worker starts,
- lint/typecheck/unit tests pass,
- Playwright smoke passes.

Update `docs/PROJECT_STATE.md`.
