# Market Ingest Persistence - Roadmap

## Goal
- Make `targets` and `universe` ingestion reliably persist data and run on a daily schedule (`19:30`, `Asia/Shanghai`) with pool-level isolation.

## Non-goals
- Introducing new data vendors or expanding domain coverage beyond currently implemented modules.
- Changing business/account schema unrelated to ingestion orchestration.
- Reworking UI architecture outside ingestion admin workflows.

## Open questions and assumptions
### Open questions (answer before execution)
- None. Runtime policy decisions are confirmed.

### Assumptions (if unanswered)
- Daily schedule remains `scope=both` and execution order is `targets -> universe`.
- Preflight probes are lightweight enough for run-before-trigger checks.

## Scope and impact
- Affected areas/modules:
  - `apps/backend/src/main/storage`
  - `apps/backend/src/main/market`
  - `apps/backend/src/main/ipc`
  - `apps/backend/src/preload`
  - `apps/frontend/src/components/dashboard/hooks`
  - `packages/shared/src`
  - `dev-docs/active/market-ingest-persistence`
- External interfaces/APIs:
  - New IPC/API method: `market.runIngestPreflight()`
- Data/storage impact:
  - More complete failure records in `market-cache.sqlite.ingest_runs` for pre-run blocked states
- Backward compatibility:
  - Existing trigger/control APIs remain unchanged

## Milestones
1. **M0**: Documentation baseline
   - Deliverable: complete dev-docs bundle under `dev-docs/active/market-ingest-persistence/`
   - Acceptance criteria: roadmap + 00-05 files exist and reflect current implementation state
2. **M1**: DuckDB worker compatibility fix
   - Deliverable: worker wrapper supports listener contract expected by duckdb-wasm
   - Acceptance criteria: universe ingest no longer fails with `addEventListener` runtime error
3. **M2-M3**: Preflight + orchestration integration
   - Deliverable: automatic preflight before readiness gate and runner execution
   - Acceptance criteria: stale/untested enabled modules are auto-probed on run path
4. **M4**: Observability for blocked runs
   - Deliverable: blocked-before-run failures persisted into `ingest_runs`
   - Acceptance criteria: readiness/token/preflight failures appear in run history with stage/code metadata
5. **M5-M6**: API exposure and frontend wiring
   - Deliverable: shared type, IPC channel, preload method, frontend trigger flow updated to preflight path
   - Acceptance criteria: UI manual trigger uses preflight and surfaces consistent block reasons
6. **M7**: Regression verification and runbook
   - Deliverable: SQL checks + ops notes + verification log
   - Acceptance criteria: target success and universe failure/success scenarios are diagnosable from history

## Step-by-step plan (phased)
### Phase 0 - Baseline docs
- Create and initialize roadmap + execution docs.

### Phase 1 - Runtime hard fix
- Patch duckdb worker wrapper event interface.

### Phase 2 - Preflight service
- Add preflight service to run domain/module probes per scope.
- Add new shared IPC contracts and handler.

### Phase 3 - Orchestration hardening
- Integrate preflight into orchestration flow.
- Persist blocked failures into `ingest_runs` with stage/code metadata.

### Phase 4 - Frontend/path integration
- Add preload API mapping.
- Switch manual trigger action from plain readiness check to preflight result.

### Phase 5 - Verification + operations
- Run typecheck/build checks.
- Validate SQL-level run history and error metadata.
- Update verification and pitfalls docs.

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm -C packages/shared build`
  - `pnpm -C apps/backend typecheck`
  - `pnpm -C apps/frontend typecheck`
  - `pnpm build`
- Manual checks:
  - Run preflight API and confirm readiness payload is returned.
  - Trigger ingest and verify blocked runs are persisted when blocked before runner.
  - Confirm `targets` and `universe` can be diagnosed independently in `ingest_runs`.

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Probe calls increase trigger latency | med | med | Sequential probes, scope filtering, reuse existing module probes | trigger latency and timeout complaints | disable preflight in trigger path and keep orchestration-only preflight |
| Provider transient failures create false blocking | med | med | Persist detailed stage/code/message, allow retry | spike in blocked runs with same code | temporary policy fallback to readiness-only path |
| Additional run history records affect dashboards | low | low | keep schema unchanged; only fill existing fields + meta_json | list page anomalies | revert blocked-run recording path |

## Optional detailed documentation layout (convention)
```
dev-docs/active/market-ingest-persistence/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

## To-dos
- [x] Confirm schedule policy and scope defaults
- [x] Confirm stale handling policy
- [x] Confirm failure isolation policy
- [x] Complete implementation and verification evidence (manual smoke pending)
