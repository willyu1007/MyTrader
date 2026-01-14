# 03 Implementation Notes

## Status
- Current status: in_progress
- Last updated: 2026-01-14

## Notes (append-only)
- 2026-01-14：确认顶层 Tabs 为「总览/持仓/交易/收益/风险/目标配置/公司行为」，数据入口改为右上角全局“数据状态”。
- 2026-01-14：确认 ledger-first（以流水推导为真相源）；交易方向用 `buy/sell`；成本法（MVP）用均价；不做多账户/子账户。
- 2026-01-14：新增 `ledger_entries`（business schema v3）+ IPC（`window.mytrader.ledger.*`），用于后续交易流水/现金流等能力落地。
- 2026-01-14：实现 `positions -> ledger` 基线同步（含 schema v3 升级时 backfill、持仓增删改与 CSV 导入同步；`source=system` + `externalId=baseline:*`）。
- 2026-01-14：新增根目录说明文档 `PORTFOLIO_LEDGER.md`；`pnpm typecheck` 通过。
