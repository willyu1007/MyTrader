# 03 Implementation Notes

- 2026-02-11: Task initialized from approved implementation plan.
- 2026-02-11: M0 docs baseline created (`roadmap.md` + `00-05`).
- 2026-02-11: Added shared IPC contracts in `packages/shared/src/ipc.ts`:
  - `RunIngestPreflightInput`
  - `IngestPreflightResult`
  - `IPC_CHANNELS.MARKET_INGEST_PREFLIGHT_RUN`
  - `MyTraderApi.market.runIngestPreflight`
- 2026-02-11: Added backend preflight service `apps/backend/src/main/market/ingestPreflightService.ts`.
  - Probes selected enabled domain/module set by scope (`targets/universe/both`).
  - Writes probe results through existing connectivity-test persistence.
  - Returns current readiness snapshot for same scope.
- 2026-02-11: Hardened orchestrator `apps/backend/src/main/market/ingestOrchestrator.ts`.
  - Execution order now enforces `preflight -> readiness -> token -> runner`.
  - For pre-run blocked stages (`preflight`, `readiness`, `token`, `analysis_init`), creates failed `ingest_runs` record.
  - Added blocked metadata in `meta_json`: `blockedStage`, `errorCode`, `source`, `scope`.
  - Preserved pool isolation behavior: failures in one scope do not block queue processing for other scope.
- 2026-02-11: Fixed DuckDB node worker wrapper compatibility in `apps/backend/src/main/storage/analysisDuckdb.ts`.
  - Implemented `addEventListener/removeEventListener`.
  - Preserved `onmessage/onerror` callback behavior.
- 2026-02-11: IPC integration in `apps/backend/src/main/ipc/registerIpcHandlers.ts`.
  - Registered `MARKET_INGEST_PREFLIGHT_RUN`.
  - Manual trigger no longer pre-blocks in handler; orchestration path is source of truth for final execution result.
- 2026-02-11: Preload/frontend integration.
  - Added preload bridge method in `apps/backend/src/preload/index.ts`.
  - Updated manual trigger workflow in `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-admin-actions.ts` to use preflight API.
- 2026-02-11: Runtime smoke (`pnpm -C apps/backend dev`) confirmed:
  - orchestrator executes preflight/readiness path at startup;
  - blocked `universe` runs are now persisted with `blockedStage/errorCode`;
  - `targets` can still succeed while `universe` is blocked (pool isolation preserved).

## Ops Runbook (SQL checks)

Database path (macOS default):
- `~/Library/Application Support/@mytrader/backend/market-cache.sqlite`

Check latest runs:
```sql
select scope, status, started_at, finished_at, error_message
from ingest_runs
order by started_at desc
limit 20;
```

Check blocked-stage failures:
```sql
select
  scope,
  status,
  json_extract(meta_json, '$.blockedStage') as blocked_stage,
  json_extract(meta_json, '$.errorCode') as error_code,
  error_message,
  started_at
from ingest_runs
where status = 'failed'
order by started_at desc
limit 50;
```

Quick health summary:
```sql
select scope, status, count(*) as cnt
from ingest_runs
group by scope, status
order by scope, status;
```
