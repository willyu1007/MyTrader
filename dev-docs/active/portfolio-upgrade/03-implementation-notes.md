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
- 2026-01-15：修复快照的现金估值口径（现金按 1:1 计入市值/成本/PnL=0），并在无持仓流水但存在现金流水时合并输出现金持仓；trade 校验补齐 `cashAmount` 正负号；新增 `verify:position-engine` 回放一致性脚本（100 次随机乱序回放一致）。
- 2026-01-15：新增收益口径 v0：TWR（按外部现金流分期，缺行情时降级为 MWR/IRR），并在收益 Tab 展示口径、区间与年化/总收益；快照输出 `performance` 结构。
- 2026-01-15：新增收益区间选择与收益曲线：`portfolio.getPerformance` IPC 输出区间 TWR/MWR 与曲线（按行情日期+现金流日期拼接）；收益 Tab 支持 1M/3M/6M/1Y/YTD/全部范围切换。
- 2026-01-15：Phase 0 盘点（ledger/position/performance）完成。
  - 覆盖范围：`ledger_entries` 支持 trade/cash/fee/tax/dividend/adjustment/corporate_action，IPC CRUD 已落地；positions 可从流水回放（trade/adjustment）推导并合并现金；收益口径包含 TWR/MWR 与区间收益曲线；行情支持 CSV/Tushare 导入与按日价格查询。
  - 缺口清单：数据质量 DoD 尚未落地（缺失/过期/覆盖率提示、可追溯性指标、复算标记）；`sequence` 尚未在导入/IPC 强制必填；公司行为仅记录 meta，未形成标准 schema，拆股/合股等对持仓/成本/收益的影响尚未实现；独立 fee/tax 事件未与交易成本/收益归因联动；`instrument_id`/别名映射未接入 `portfolio_instruments`；估值/收益目前对行情缺失为“全或无”，未按覆盖率分级提示。
- 2026-01-15：落地数据质量 DoD v1（覆盖率/新鲜度/缺失标的提示）并在收益页展示；导入来源强制要求 `sequence`。
- 2026-01-15：公司行为 meta schema v1 落地（split/reverse_split/info）；拆股/合股对持仓数量与成本单价生效，并在估值/收益回放中应用。
- 2026-01-15：补齐交易 Tab 流水/现金流 UI（列表、筛选、手工新增/编辑/删除、公司行为 meta 输入、系统流水只读提示），并在新增/编辑后刷新快照。
- 2026-01-15：调整交易流水 UX（删除确认弹窗、通知 1 秒自动消失、首行新增按钮与折叠表单、字段中文化与问号提示）。
- 2026-01-15：进一步调整交易流水布局（首行移除 MVP/刷新、录入按钮右侧、表单上移、刷新图标挪入摘要行、时间段筛选、弹窗中文化与自动消失）。
- 2026-01-15：交易流水顶部压缩为两行布局（标题+日期区间/筛选+净流+刷新+录入）。
- 2026-01-15：交易流水顶部布局对齐截图（两行卡片式头部、移除只读提示、日期占位灰色）。
- 2026-01-15：交易流水顶部微调（日期区无外框/无图标、白底、去圆角、间距更紧、按钮更小）。
- 2026-01-15：交易流水头部细节调整（日期区背景与底色一致、交易类型筛选去框/缩小字体、净流去框）。
- 2026-01-15：开发模式自动解锁账号（无登录），解锁流程支持 dev bypass 并在无账号时创建开发账号。
