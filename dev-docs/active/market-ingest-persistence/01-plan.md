# 01 Plan

## Phase breakdown
1. M0 docs baseline.
2. M1 DuckDB worker fix.
3. M2 preflight service and shared contracts.
4. M3 orchestration integration.
5. M4 blocked-run observability.
6. M5 IPC/preload/frontend trigger integration.
7. M7 verification + runbook updates.

## Acceptance checklist
- [x] Universe ingest no longer fails for missing worker listener API (code path fixed; manual smoke pending).
- [x] Preflight API exists and returns readiness + probe results.
- [x] Trigger path performs preflight and supports stale auto-retest.
- [x] Blocked pre-run states are persisted in `ingest_runs` with stage/code.
- [x] Existing scheduler defaults still match required policy.
- [x] Typecheck/build commands pass within known baseline constraints.
