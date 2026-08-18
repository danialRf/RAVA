# Independent Phase Review

You are the senior reviewer for the most recently implemented RAVA phase.

First read:
- AGENTS.md
- relevant specs
- PROJECT_STATE.md
- git diff/history for the phase.

Do not add new product features during the first review pass.

Review:
1. requirement coverage,
2. domain correctness,
3. Persian/RTL/mobile,
4. visual quality if UI,
5. security,
6. money correctness,
7. migrations/data integrity,
8. test quality,
9. error/loading/empty states,
10. maintainability,
11. unnecessary dependencies,
12. fake/invented integration behavior.

Run all relevant commands/tests yourself.

For UI:
open pages with Playwright at required mobile widths and inspect screenshots.

Output a severity-ranked report:
- BLOCKER
- HIGH
- MEDIUM
- LOW

For each issue:
- evidence,
- file/path,
- why it matters,
- exact acceptance criterion for fix.

If no blockers/high issues remain, state:
`PHASE GATE: PASS`

Otherwise:
`PHASE GATE: FAIL`

Do not claim pass if tests fail.
