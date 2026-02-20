# 04 Verification

## Automated checks
- `pnpm typecheck` -> expect exit 0
- `pnpm build` -> expect exit 0
- `pnpm -C apps/backend typecheck` -> expect exit 0
- `pnpm -C apps/frontend typecheck` -> expect exit 0

## Command checklist (actionable)
1. Resolve active account DB paths
```bash
ACCOUNT_INDEX="$HOME/Library/Application Support/@mytrader/backend/account-index.sqlite"
ACCOUNT_DIR="$(sqlite3 "$ACCOUNT_INDEX" "select data_dir from accounts order by coalesce(last_login_at,0) desc, created_at desc limit 1;")"
BUSINESS_DB="$ACCOUNT_DIR/business.sqlite"
MARKET_DB="$ACCOUNT_DIR/market-cache.sqlite"
echo "ACCOUNT_DIR=$ACCOUNT_DIR"
```

2. Scheduler/control and rollout flags snapshot
```bash
sqlite3 "$BUSINESS_DB" "
select key, value_json
from market_settings
where key in (
  'ingest_scheduler_config_v1',
  'ingest_control_state_v1',
  'rollout_flags_v1'
)
order by key;
"
```

3. Recent run stability (last 7 days)
```bash
sqlite3 "$MARKET_DB" "
select
  date(started_at/1000,'unixepoch','localtime') as day,
  count(*) as runs,
  sum(case when status='failed' or coalesce(errors,0) > 0 then 1 else 0 end) as blocking_like_runs
from ingest_runs
group by day
order by day desc
limit 7;
"
```

4. Quality quick checks (null-rate / PK conflict)
```bash
sqlite3 "$MARKET_DB" "
select
  count(*) as total_rows,
  sum(case when symbol is null or trade_date is null or close is null then 1 else 0 end) as null_rows,
  round(100.0 * sum(case when symbol is null or trade_date is null or close is null then 1 else 0 end) / nullif(count(*),0), 4) as null_pct
from daily_prices;
"

sqlite3 "$MARKET_DB" "
select count(*) as pk_conflicts
from (
  select symbol, trade_date, count(*) c
  from daily_prices
  group by symbol, trade_date
  having c > 1
);
"
```

5. Macro future-leak check (run after P1 macro tables are available)
```bash
sqlite3 "$MARKET_DB" "
select count(*) as future_leak_rows
from macro_module_snapshot
where available_date > as_of_trade_date;
"
```

## Common gate checks (required)
- [ ] 连续 3 个交易日无阻断错误 run
- [ ] `inserted/updated/errors` 与目标表行变化可对账
- [ ] 关键字段空值率 <= 0.5%
- [ ] 主键冲突 = 0
- [ ] 手动/定时/启动补跑/暂停/恢复/取消全通过

## P0 gate checks
- [ ] P0 资产（stock/etf/index-context/futures/spot）全量 + 增量 run 各至少 1 次成功
- [ ] P0 核心模块 `complete + partial >= 95%`
- [ ] 指数上下文模块当日可用率 >= 95%

## P1 gate checks
- [ ] 外汇白名单 `task.momentum` 的 `complete + partial >= 95%`
- [ ] 宏观 4 模块最近 20 个交易日 `missing` 占比 <= 5%
- [ ] 无 `available_date > as_of_trade_date` 穿越记录

## P2 gate checks
- [ ] 每个增强模块上线前有权限探测与灰度记录
- [ ] P2 上线后 P0/P1 门禁指标无回退
- [ ] P2 模块可独立回滚且不影响核心链路

## P2 gray release checklist (wave-1)
1. Pre-check
- [ ] 已确认 `p2Enabled=false` 且所有 P2 子开关默认为 `false`
- [ ] 已完成目标接口权限探测并在 `03-implementation-notes.md` 记录结论

2. Single-module rollout
- [ ] 一次仅开启一个 P2 子模块开关
- [ ] 触发手动 ingest 并记录 run 结果（成功/失败、耗时、errors）
- [ ] 执行门禁回归，确认 P0/P1 指标未回退

3. Rollback drill
- [ ] 关闭当前子模块开关，确认执行路径可立即回退
- [ ] 回退后再次触发 ingest，确认核心链路恢复稳定

4. Promotion
- [ ] 单模块稳定后再进入下一个子模块灰度
- [ ] wave-1 全部完成后再评估是否扩大 P2 范围

## Manual checks
- [ ] Target 状态可追溯到 SSOT 缺口（含 explain payload）
- [ ] 批次开关/回滚开关行为符合预期
- [ ] 错误摘要可读且不泄露 token/敏感信息

## Runs (recorded)
- 2026-02-20：初始化全范围承接任务文档（尚未执行代码级验证）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/frontend typecheck` -> ✅
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ❌（已知阻塞：`@duckdb/duckdb-wasm` 类型声明缺失，非本次改动引入）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ❌（同上，backend DuckDB 类型阻塞）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅（新增 rollout flags 类型/IPC 后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/frontend typecheck` -> ✅（新增 preload API 后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ❌（仍为同一 DuckDB 类型阻塞；未出现新增类型错误）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅（新增 rollout flags 前端面板后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/frontend typecheck` -> ✅（新增 rollout flags UI 与按钮门禁后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ❌（阻塞不变：`@duckdb/duckdb-wasm` 类型声明缺失）
