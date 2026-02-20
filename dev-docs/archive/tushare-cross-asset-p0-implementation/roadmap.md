# Roadmap

## Task Name
Tushare 多资产覆盖 P0 实施与回归

## Objective
将规划任务的 P0 定稿（资产范围、统一模型、门禁阈值）变为可执行实现，并完成首轮稳定性回归。

## In Scope
1. P0 资产：股票、ETF、指数（上下文）、期货、现货（SGE）。
2. 统一表一次建齐并接入 P0 链路。
3. Universe 入库 + Target 状态 + 调度可观测闭环。
4. P0 门禁达标与回滚策略验证。

## Out of Scope
1. P1（外汇、宏观）
2. P2（权限/专题增强、分钟/实时）
3. `stk_premarket` 专项权限接口

## Phased rollout
1. Phase A: Schema first
- 迁移统一表与 P0 扩展表，建立开关与回滚点。

2. Phase B: Core assets first
- 先落股票 + ETF，确保主链路稳定可观测。

3. Phase C: Context assets
- 接入指数上下文，再接入期货 + 现货。

4. Phase D: Regression and hardening
- 完成调度控制回归、门禁评估与异常场景演练。

## Exit criteria
1. 覆盖率达标：`complete + partial >= 95%`
2. 数据质量达标：关键字段空值率 <= 0.5%，主键冲突 = 0
3. 运行稳定达标：连续 3 个交易日无阻断错误
4. 文档完备：实现记录、验证记录、风险/回滚说明齐备
