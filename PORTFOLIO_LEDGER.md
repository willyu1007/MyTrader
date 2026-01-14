# 投资组合（Portfolio）—— Ledger-first 设计与落地说明

本文档描述 MyTrader “投资组合”模块的核心设计决策、数据结构（business.sqlite）、以及当前已落地的后端/IPC 能力，作为后续 UI/UX 与计算引擎迭代的共同基线。

## 顶层信息架构（7 个 Tab）

投资组合模块顶层 Tab（从左到右）：

1. 总览
2. 持仓
3. 交易
4. 收益
5. 风险
6. 目标配置
7. 公司行为

说明：
- “数据”不作为顶层 Tab：以右上角“数据状态/数据入口”呈现（面向自动化管线的可解释、可修复入口）。

## 关键设计决策（已确认）

- 真相源：以流水推导为主（ledger-first）
  - 所有计算（持仓/估值/收益/风险/归因等）最终都应可追溯到流水输入与口径版本。
- 交易方向：使用 `side=buy/sell`
  - `quantity` 永远为正，不再用正负号表达方向。
- 成本法（MVP）：均价法（Average Cost）
- 不需要多账户/子账户维度：不引入 `account_id`（以组合维度组织流水与现金）

## 数据存储位置

MyTrader 目前使用两个主要本地库：

- `business.sqlite`（账号隔离）：组合、持仓（兼容层）、风险规则、流水等业务数据  
  - 路径：`<accountDir>/business.sqlite`
  - 由 `apps/backend/src/main/storage/paths.ts` 的 `ensureAccountDataLayout()` 创建/维护
- `market-cache.sqlite`（全局共享缓存）：标的注册表、行情等公共数据  
  - 路径：`<userData>/market-cache.sqlite`

> 备注：`<accountDir>` 与 `<userData>` 为 Electron 的数据目录，实际路径由运行环境决定（Windows/macOS/Linux 不同）。

## business.sqlite：核心表

### `portfolios`
- 组合主表：`id / name / base_currency / created_at / updated_at`

### `positions`（兼容层，后续逐步降级为派生缓存）
- 目前仍用于“持仓”界面与快照计算的输入/缓存。
- 目标状态：由持仓引擎从 `ledger_entries` 推导得到（positions 不再作为真相源）。

### `ledger_entries`（schema v3 新增，统一流水表）

目的：用一个可演进、可追溯的统一流水表覆盖交易/现金流/费用税费/分红/调仓修正/公司行为等事件，为持仓引擎与收益/风险/归因提供可回放输入。

字段（简述）：
- 标识与归属：`id`、`portfolio_id`
- 事件：`event_type`、`trade_date`（`YYYY-MM-DD`）
- 标的：`symbol`（可空）
- 方向与数量：`side`（buy/sell，可空）、`quantity`（可空）
- 价格：`price`（可空）
- 现金：`cash_amount`（可空）、`cash_currency`（可空）
- 费用税费：`fee`、`tax`（可空）
- 追溯：`source`、`external_id`（可空）、`meta_json`（可空）
- 其他：`note`、`created_at / updated_at / deleted_at`

索引与约束（已落地）：
- 按组合 + 日期/标的/事件类型查询索引
- 幂等去重：`unique (portfolio_id, source, external_id)`
- `side` 枚举约束；`quantity/price/fee/tax` 非负约束；软删除 `deleted_at`

## `event_type` 事件类型与输入口径

当前约定（以 IPC 输入校验为准，见 `apps/backend/src/main/ipc/registerIpcHandlers.ts`）：

- `trade`：买卖成交
  - 必填：`symbol`、`side`、`quantity>0`、`price`
  - 可选：`fee`、`tax`、`cash_currency`（默认组合 baseCurrency）
- `adjustment`：持仓修正/期初基线（baseline）
  - 必填：`symbol`、`side`、`quantity>0`
  - 可选：`price`、`cash_currency`（默认组合 baseCurrency）
- `cash`：入金/出金/现金变动
  - 必填：`cash_amount != 0`、`cash_currency`
  - `symbol/side/quantity/price` 均为空
- `fee` / `tax`：单独记账的费用/税费（MVP 先做“独立事件”）
  - 必填：`cash_amount < 0`、`cash_currency`
  - 可选：`symbol`（用于归属到标的）
- `dividend`：分红
  - 必填：`symbol`、`cash_amount > 0`、`cash_currency`
  - 可选：`tax`（允许记录分红税）
- `corporate_action`：公司行为（事件壳）
  - 必填：`symbol`、`meta`（对象，存放拆并股/送转配等细节）

现金正负号建议：
- `cash_amount > 0`：资金流入（入金/分红到账等）
- `cash_amount < 0`：资金流出（出金/费用/税费等）

## positions → ledger 基线（baseline）同步策略（已落地）

为兼容当前仍以 `positions` 驱动的 UI，同时逐步切换到 ledger-first，本项目引入“基线流水”：

- 当系统发现 `positions` 中已有持仓，会为其生成/更新对应的基线流水（`event_type='adjustment'` 或 `event_type='cash'`）。
- 基线流水用于：
  - 让 `ledger_entries` 不为空，可尽早承载 UI 与计算引擎的演进；
  - 为后续“只编辑流水、不直接改 positions”铺路。

### 基线写入规则

来源标识：
- `source = 'system'`
- `note = 'baseline:positions'`
- `meta = { baseline: true, from: 'positions' }`

幂等键（externalId）：
- 非现金持仓：`baseline:${symbol}`
- 现金持仓：`baseline:cash:${currency}`

写入时机：
- business schema 升级到 v3 时：自动 backfill（把既有 `positions` 写成基线流水）
- `持仓 新增/更新/删除` 时：同步 upsert/软删除基线流水
- `CSV 持仓导入` 后：对导入的每一行持仓同步 upsert 基线流水

相关实现：
- `apps/backend/src/main/storage/ledgerBaseline.ts`
- `apps/backend/src/main/storage/businessSchema.ts`
- `apps/backend/src/main/ipc/registerIpcHandlers.ts`
- `apps/backend/src/main/services/marketService.ts`

## IPC / Preload API（前端调用方式）

预加载注入：`window.mytrader.ledger.*`

- `ledger.list(portfolioId)`
- `ledger.create(input)`
- `ledger.update(input)`
- `ledger.remove(ledgerEntryId)`

类型定义与 IPC channel：
- `packages/shared/src/ipc.ts`

## 后续迭代（建议顺序）

1. 持仓引擎（Position Engine）：从 `ledger_entries` 推导持仓、现金余额、成本与已实现/未实现 PnL
2. 估值与收益：对接行情/汇率，定义 TWR/MWR 口径与 as-of/version
3. 风险与回撤：波动率、最大回撤、集中度等指标，结果可追溯
4. 公司行为：逐步完善 `corporate_action` 的 meta 结构与对持仓/成本/收益的影响
5. positions 降级：逐步停止直接编辑 positions，改为生成 adjustment/cash 流水并由引擎派生缓存

