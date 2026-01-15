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
- 2026-01-15：升级 business schema v4，补齐 `ledger_entries` 字段（`account_key/event_ts/sequence/instrument_id/price_currency`）与索引，新增 `portfolio_instruments` 映射表，并更新 ledger IPC 类型与校验规则。
- 2026-01-15：新增持仓引擎 v0（从流水推导持仓/成本/现金），`portfolio snapshot` 优先消费 ledger，按 `event_ts/sequence` 排序回放，并生成现金持仓快照。
- 2026-01-15：开始搭建投资组合 UI/UX 框架，新增顶部 7 个 Tab（总览/持仓/交易/收益/风险/目标配置/公司行为）并拆分总览/持仓视图。
- 2026-01-15：组合管理面板移动到「总览」Tab，Tab 样式改为顶部条形导航，增强选中态。
