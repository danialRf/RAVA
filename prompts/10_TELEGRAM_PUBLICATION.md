# Phase 10 — Telegram Publication

Implement Telegram publisher behind provider interface.

Launch behavior:
- admin reviews product,
- preview card/caption,
- choose website and/or Telegram,
- publish,
- store external message ID/status.

Support:
- send image + caption,
- edit caption where supported,
- retry with idempotency,
- failed job visibility,
- safe test channel configuration.

Never publish if token/channel missing.
Never auto-publish by default.

Add policy framework for future high-confidence auto-publish but leave disabled.

Update PROJECT_STATE.
