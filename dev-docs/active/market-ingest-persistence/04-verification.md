# 04 Verification

- 2026-02-11: `pnpm -C packages/shared build` (pass)
- 2026-02-11: `pnpm -C apps/backend typecheck` (pass)
- 2026-02-11: `pnpm -C apps/frontend typecheck` (pass)
- 2026-02-11: `pnpm build` (pass; frontend chunk-size warning only)
- 2026-02-11: `pnpm typecheck` (fail; existing theme contract violations in `OtherDataManagementSourceSection.tsx` color literals, unrelated to this task)

## Runtime checks (pending manual smoke)
- [x] Validate preflight path executes in runtime (via startup auto-ingest log + persisted run metadata).
- [ ] Trigger `scope=universe` and verify no `addEventListener` runtime error in successful universe runner path (blocked currently by provider permission/readiness).
- [x] Validate blocked-run records include `blockedStage/errorCode` in `meta_json`.

## Runtime evidence (2026-02-11)
- Started app runtime via `pnpm -C apps/backend dev` and observed:
  - log: `[mytrader] startup ingest skipped: 数据来源未就绪：1. ETF 探针未返回可用数据。请检查 token 权限。`
- Queried `market-cache.sqlite` and confirmed latest records:
  - `targets | success`
  - `universe | failed | blockedStage=readiness | errorCode=READINESS_BLOCKED`
- SQL used:
  - `select id,scope,status,error_message,started_at,substr(meta_json,1,260) from ingest_runs order by started_at desc limit 8;`
  - `select scope,status,json_extract(meta_json,'$.blockedStage'),json_extract(meta_json,'$.errorCode'),error_message,started_at from ingest_runs ...`
