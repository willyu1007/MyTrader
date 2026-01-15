# 01 Plan

> 以“依赖顺序”为主线：数据层 -> 流水层 -> 持仓引擎 -> 估值/收益 -> 分析 -> 再平衡 -> 报表。

## Phases（建议分期）
### Phase 0 - 定义语义与信息架构
- 目标：锁定顶层 Tabs、关键口径与“真相来源”策略（手工持仓 vs 流水推导）
- 产出：字段字典（成本/收益/公司行为/汇率）、Tab 结构与首屏信息架构
- 关键任务：
  - 事件排序规则：`event_ts`/`sequence` 的选择、时区与同日稳定排序
  - trade 现金腿与币种：`cash_amount`/`cash_currency`、`price_currency`、费用/税费币种
  - 标的稳定 ID：`instrument_id` 与 `symbol`/别名映射（可选 `portfolio_instruments`）
  - 数值精度策略：金额 minor units 或定点策略（`value_int + scale`）、四舍五入规则
  - 账户扩展钩子：`account_key` 或轻量 `accounts` 表（先不暴露 UI）
  - adjustment/corporate_action 语义：`adjustment_mode` 与公司行为 meta 标准化
  - DB 约束策略：字段非空/互斥/取值范围与幂等去重约束

### Phase 1 - 数据层（Data）
- 标的注册表：稳定 `instrument_id` + `symbol`/别名（market/currency/auto_ingest）
- 行情管道：导入/拉取/自动拉取状态可见 + 数据新鲜度（as-of）
- 数据质量：缺失/过期/异常提示与修复路径

### Phase 2 - 流水层（Ledger）
- 交易流水：买卖、费用税费、分红、公司行为事件（最小可用集合）
- 事件排序字段：`event_ts` 或 `sequence`（引擎按此排序）
- trade 现金腿：显式 `cash_amount` + 币种字段（必要时补充 `price_currency`）
- 标的引用：`instrument_id` 为计算主键，`symbol` 作为展示/导入冗余
- 数值精度：金额/费用/税费改为定点/整数（minor units）
- 账户扩展：`account_key` 预留（不影响现有 UI）
- 现金流：入金/出金/余额变动与对账
- DB 约束：`CHECK` 与 `unique(portfolio_id, source, external_id)`

### Phase 3 - 持仓引擎（Position Engine）
- 从流水推导“当前持仓/历史持仓”，支持手工调整作为补丁
- 成本法与已实现/未实现收益口径落地
- 回放顺序：按 `event_ts/sequence` 稳定复算
- adjustment 语义：`absolute/delta` 的处理规则
- 公司行为处理：运行时展开或写入派生流水（定一条主线）

### Phase 4 - 估值与收益率（Performance）
- 估值：按价格/汇率/公司行为口径统一
- 收益率：TWR/MWR（先定最小集合），支持区间/时间序列
- 现金流序列：使用显式现金腿驱动 MWR/现金对账

### Phase 5 - 分析（Analytics）
- 归因：先做“贡献”，再扩展方法
- 风险与回撤：集中度、波动、最大回撤、风险规则命中

### Phase 6 - 目标配置与再平衡（Allocation）
- 目标配置、漂移、再平衡建议清单（含约束检查）

### Phase 7 - 报表（Reporting）
- 快照、导出、复盘归档（可复现参数与口径）

## Verification checklist
- [x] `pnpm typecheck` 通过
- [ ] 回放一致性：同一批流水回放 100 次，持仓/成本/现金/已实现/未实现逐字段一致
- [ ] 导入幂等：同 `(portfolio_id, source, external_id)` 重复导入不新增；软删除后再导入恢复一致
- [ ] baseline 不重叠：`adjustment_mode=absolute` 下多次 backfill 不翻倍
- [ ] 日内顺序：同日多笔交易，`event_ts/sequence` 改变会影响成本/已实现；引擎按此稳定复算
- [ ] 跨币种现金腿：trade/fee/tax 币种不一致时现金余额与估值可复算；无 FX 时提示清晰
- [ ] 精度回放：导入 -> 保存 -> 导出 -> 再导入无数值漂移（minor units 一致）
- [ ] 约束校验：缺失 `cash_currency`、负数 `fee/tax`、无 `symbol/instrument_id` 的事件被拒绝
- [ ] 手工用例覆盖：无行情/部分行情/全行情、流水驱动持仓、公司行为、收益率与回撤
