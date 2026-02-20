# 02 Architecture

## Boundaries
1. Universe Pool
- 负责目录同步、分域采集、标准化入库、历史回补、版本追溯。
- 输出 SSOT 与可复用数据产品，不直接输出业务状态。

2. Target Pool
- 仅消费 SSOT/数据产品，输出 `complete/partial/missing/not_applicable`。
- 只触发 Universe 定向补齐，不把 provider 直拉作为默认主路径。

## Layering (MUST)
1. L1 Standard Fact
- `daily_prices` + 各资产扩展表。
2. L2 Data Product
- 跨接口整合与跨资产对齐的数据产品。
3. L3 Target Feature
- 任务状态与解释层，不反向污染 SSOT。

## Batch-specific design focus
1. P0
- 一次建齐统一表：`instrument_master`、`basket_membership_daily`、`corporate_events`。
- 指数作为上下文资产服务 stock/etf。

2. P1
- 外汇维持日线白名单策略。
- 宏观严格使用 `available_date`，并保留 revision 追溯。

3. P2
- 增强模块全部挂在 feature flag 下。
- 权限型接口必须先探测通过才允许进入生产链路。

## Operational controls
- 模块级开关：按批次/按资产/按模块粒度控制。
- 回滚策略：停止新增物化写入，保留历史 SSOT 数据。
- 可观测：统一 run 统计（`inserted/updated/errors/duration/status`）与错误摘要。

## Data model cutover strategy (recommended)
1. Step 1: Shadow write (MUST)
- 新旧模型并行写入，旧读路径保持不变。
- 每日比较新旧核心聚合结果（行数、主键集合、关键统计量）并记录差异。

2. Step 2: Dual-read compare (SHOULD)
- 在非关键入口开启双读比对（旧读为主，新读仅校验）。
- 连续 3 个交易日差异在可接受阈值内才允许切读。

3. Step 3: Progressive read cutover (MUST)
- 按批次切读：先 P0，再 P1，最后 P2。
- 每次切读都必须绑定开关，支持分钟级回退到旧读路径。

4. Step 4: Fallback window (MUST)
- 切读后保留至少 1 个发布周期的旧写入能力（只保底，不扩展新字段）。
- 发生门禁回归失败时，先回退读路径，再评估是否回退写路径。

5. Step 5: Legacy retirement (MAY)
- 当新路径稳定且回滚窗口结束后，再执行旧模型退役与数据清理。

## Quality gates
- Coverage:
  - P0: 核心模块 `complete + partial >= 95%`
  - P1: 外汇覆盖 >= 95%，宏观 missing <= 5%（20 日窗口）
- Integrity:
  - 关键字段空值率 <= 0.5%
  - 主键冲突 = 0
- Temporal correctness:
  - 宏观无未来数据穿越（`available_date <= as_of_trade_date`）
