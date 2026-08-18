# AGENTS.md — RAVA Engineering Constitution

You are working on **RAVA**, a Persian-first, mobile-first commerce and Germany-sourcing platform for Iranian customers.

This file contains permanent project rules. Follow it before all other project documentation unless a more specific nested `AGENTS.md` overrides it.

## 1. Mission

Build a production-quality product that is:

- trustworthy,
- visually human-designed,
- mobile-first,
- RTL-native,
- maintainable by future engineers,
- cheap to operate at launch,
- modular enough for later automation,
- safe around money, authentication, and customer data.

Do not optimize for producing the most code. Optimize for correct product behavior.

## 2. Never invent product/business facts

If the database does not contain a fact, do not fabricate it.

This is especially strict for:
- authenticity,
- retailer authorization,
- product ingredients,
- size/volume,
- stock,
- price,
- discount percentage,
- delivery date,
- source,
- warranty,
- receipt availability.

Unknown must render as unknown or require review.

## 3. Visual quality: reject generic AI UI

The storefront must not resemble a generic AI-generated landing page.

Forbidden visual defaults:
- random gradients,
- glowing blobs,
- excessive glassmorphism,
- giant generic hero text,
- floating 3D shapes,
- every section inside a rounded card,
- excessive pill buttons,
- default shadcn demo styling,
- fake dashboards with meaningless charts,
- purple/blue SaaS palettes,
- inconsistent border radii,
- unnecessary animated counters,
- decorative motion that harms shopping.

Use the design tokens and composition rules in `docs/BRAND_SYSTEM.md`.

## 4. Persian/RTL is first-class

- Default locale is Persian (`fa-IR`).
- Default document direction is RTL.
- Product/brand/model strings may be isolated LTR where needed.
- Test mixed Persian + Latin + numbers.
- Prices are displayed in Toman to customers.
- Never rely on CSS hacks that break RTL.
- Use accessible semantic HTML.

## 5. Money rules

- Never use JavaScript floating point for persisted money.
- EUR amounts: integer cents.
- Toman amounts: integer/bigint Toman.
- Exchange rates: integer Toman per EUR where practical.
- Persist the FX snapshot used for every quote/order.
- Do not silently change an already locked customer order total.
- Payment callbacks must be idempotent.

Read `docs/PRICING_ENGINE.md`.

## 6. Architecture rules

Preferred structure:
- TypeScript end-to-end.
- Next.js App Router storefront/admin.
- PostgreSQL as system of record.
- Drizzle ORM + SQL migrations.
- Redis/BullMQ for jobs when workers are introduced.
- Crawlee with HTTP-first extraction and Playwright fallback.
- S3-compatible object storage abstraction.
- Search begins with PostgreSQL and can add self-hosted Typesense later.
- external integrations behind provider interfaces.

Do not introduce microservices prematurely. Start as a modular monorepo with a separate worker process where background jobs require it.

## 7. External providers must be swappable

Implement interfaces for:
- FX rate provider,
- payment gateway,
- SMS,
- email,
- object storage,
- Telegram,
- AI/text generation,
- retailer adapters.

Provide deterministic fake/dev implementations.

No feature should be blocked in local development because a production credential is missing.

## 8. Scraping/retailer rules

- Prefer official APIs, feeds or affiliate data when available.
- Otherwise use normal public-page extraction where permitted.
- No CAPTCHA bypass.
- No anti-bot evasion/fingerprint spoofing.
- No private-account scraping.
- No bypassing authentication.
- No proxy rotation for circumvention.
- Respect rate limits and retailer-specific policies.
- Fail closed when selectors are ambiguous.
- Store raw source metadata for debugging and audit.
- Marketplace offers require seller-level provenance.

Read `docs/SCRAPER_SPEC.md`.

## 9. Authenticity language

Before physical procurement:
- use “منبع بررسی‌شده” / “Source verified” only when source policy is satisfied.
- never claim AI proved physical authenticity.

After procurement from an approved source and receipt capture:
- the order may receive `RAVA_AUTHENTICITY_GUARANTEE` status according to configured business policy.

Marketplace offers with uncertain seller provenance require manual review.

## 10. AI is optional, never foundational

Launch must work with AI spending = zero.

Use:
- structured templates,
- rules,
- deterministic marketing-card rendering,
- human approval.

Later LLM/image providers can enrich content behind interfaces.

AI must never:
- invent facts,
- change prices,
- publish without policy permission,
- approve authenticity,
- perform irreversible financial actions.

## 11. UX requirements

Mobile is primary.

Critical flows:
- discover,
- search/filter,
- understand source/authenticity,
- understand estimated price,
- obtain checkout quote,
- pay deposit,
- track procurement/trip,
- pay remaining balance,
- receive product.

Optimize these before secondary features.

## 12. Admin philosophy

The admin may be sophisticated but must remain understandable.

Use:
- clear nouns,
- status chips,
- queues,
- bulk actions,
- saved filters,
- contextual help,
- audit history.

Do not create dense enterprise UI where simple workflows suffice.

## 13. Testing is not optional

For meaningful work:
- typecheck,
- lint,
- unit tests,
- integration tests where relevant,
- Playwright E2E for critical flows.

For UI phases, add screenshots/visual checks at mobile widths.

Do not report “done” if tests fail.

## 14. Accessibility and performance

Target:
- WCAG-friendly focus states and contrast,
- keyboard support,
- reduced-motion support,
- responsive images,
- lazy loading below fold,
- no huge JS bundles for simple interactions.

## 15. Security

- secrets only through environment variables/secret manager,
- secure cookies,
- RBAC for admin,
- rate-limit auth/quotes/uploads,
- validate all input server-side,
- private receipt uploads,
- audit sensitive admin changes,
- never log passwords, OTPs, payment secrets, raw auth tokens.

Read `docs/SECURITY_COMPLIANCE.md`.

## 16. Work behavior

Before editing:
1. inspect the repository,
2. read relevant docs,
3. understand existing patterns,
4. reuse existing abstractions.

During work:
- make coherent changes,
- avoid parallel duplicate implementations,
- keep migrations reviewable,
- keep components reasonably small,
- explain non-obvious domain logic in code comments.

After work:
1. run required verification,
2. fix failures,
3. update `docs/PROJECT_STATE.md`,
4. report exactly what changed and what remains.

Do not stop merely to present a plan when the task is well-specified. Execute it.

## 17. Dependencies

- Prefer mature open-source dependencies.
- Do not add a production dependency just to avoid writing a tiny helper.
- Check licenses for critical dependencies.
- Pin with lockfile.
- Avoid abandoned packages.
- Do not add paid SaaS as a hard requirement at launch.

## 18. Definition of done

A task is done only when:
- requirements are implemented,
- empty/loading/error states exist,
- mobile/RTL behavior works,
- tests pass,
- no obvious console errors,
- no fake data leaks into production paths,
- docs/state are updated.
