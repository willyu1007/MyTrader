# 02 Architecture

## Boundaries
- Keep database schemas unchanged.
- Reuse existing domain/module probe functions in connectivity service.
- Add orchestration logic without breaking existing run queue semantics.

## Runtime flow (target)
1. Ingest request arrives (manual/schedule/startup/auto).
2. Preflight probes enabled scope domains/modules and persists test records.
3. Readiness is evaluated from latest token/config/test states.
4. If blocked before runner, create failed `ingest_runs` record with metadata.
5. If ready, continue with existing targets/universe runner logic.

## Interfaces
- Shared types: `RunIngestPreflightInput`, `IngestPreflightResult`.
- API: `market.runIngestPreflight(input?)`.
- IPC channel: `MARKET_INGEST_PREFLIGHT_RUN`.

## Observability model
- For blocked stages (`preflight`, `readiness`, `token`, `analysis_init`), write failed run records.
- Use `meta_json` keys: `blockedStage`, `errorCode`, `source`, `scope`.
