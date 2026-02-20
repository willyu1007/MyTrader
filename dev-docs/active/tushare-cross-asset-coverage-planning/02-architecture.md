# 02 Architecture

## Boundary
1. Universe Pool：
- 目录同步、分域采集、标准化入库、历史回补、版本追溯。
- 输出统一 SSOT 与跨资产数据产品，不直接承载业务任务语义。
2. Target Pool：
- 仅消费 SSOT/数据产品，执行任务矩阵与状态判定。
- 负责缺口识别和定向回补触发，不直接以 provider 拉取作为主路径。

## Key Design
1. 跨资产统一主键与时间轴：
- `symbol/ts_code + asset_class + exchange` 作为实体锚点。
- 交易型数据使用 `trade_date`，宏观使用 `available_date` 生效。
2. 分层模型：
- L1 标准事实层：`daily_prices` + 各资产扩展表。
- L2 数据产品层：跨接口/跨资产整合，面向使用场景。
- L3 任务层：Target 消费与状态输出，避免反向污染 SSOT。
3. 统一整合对象：
- 主档：`instrument_master`（跨资产）。
- 关系：`basket_membership_daily`（指数/行业/概念成分统一）。
- 事件：`corporate_events`（IPO/停复牌/回购/大宗/管理层等统一）。
- 宏观：`macro_series_meta + macro_observations`（长表 + 修订治理）。
- 建设节奏：统一表在 P0 一次建齐并完成回填，后续批次仅增量扩展。
4. 状态与统计：
- 状态统一：`complete/partial/missing/not_applicable`。
- run 统计统一：`inserted/updated/errors`，并保留 `source/ingested_at`。
5. 权限型接口策略：
- 本轮确认：`stk_premarket` 不进入当前规划范围。
- 主链路必须有无权限兜底方案，保证系统可运行。

## Risks
1. 权限差异风险：
- 积分够但专项权限未开通，导致局部模块不可用。
- 控制：将权限型接口排除当前规划并在配置层显式标注，后续如需纳入需单独立项。
2. 时间语义风险：
- 月频/季频宏观若按观测期前填，可能造成回测穿越未来。
- 控制：强制 `available_date` 生效规则，验收项必须覆盖。
3. 多源口径冲突风险：
- 同类数据多来源可能字段冲突与单位不一致。
- 控制：主源/补源与 lineage 强制记录，标准化字段与原始字段并存。
4. 调度负载风险：
- 模块数量增长增加运行时长与失败面。
- 控制：按批次放开、并行窗口限制、缺口定向补齐、run 级可观测。
