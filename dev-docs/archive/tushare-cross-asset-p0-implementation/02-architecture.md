# 02 Architecture

## Boundaries
1. Universe Pool
- 负责 P0 资产目录同步、采集、标准化、落库与版本追溯。
- 输出 SSOT 与数据产品，不直接输出业务任务状态。

2. Target Pool
- 仅消费 SSOT/数据产品，输出模块状态与缺口解释。
- 只触发 Universe 定向补齐，不以 provider 直拉作为默认主路径。

## Key Decisions
1. SSOT-first（MUST）
- 任何 Target 状态必须可追溯到 SSOT 数据。
- 禁止在 Target 路径混入“临时 provider 拉取替代”。

2. P0 统一表一次建齐（MUST）
- `instrument_master`
- `basket_membership_daily`
- `corporate_events`

3. 指数作为上下文资产（SHOULD）
- 当前阶段不强制扩展独立交易资产类，优先服务股票/ETF 的暴露与背景分析。

4. `stk_premarket` 排除（MUST）
- 本任务不纳入该接口，避免权限耦合阻断主线。

## Interfaces (high level)
- Ingestion orchestrator:
  - 输入：`mode`、`scope`、`assets`、`trade_date_range`
  - 输出：run 记录（`status/inserted/updated/errors/duration`）
- Target status resolver:
  - 输入：`as_of_trade_date`、`asset/module`
  - 输出：`complete/partial/missing/not_applicable` + explain payload

## Quality Gates
- Coverage: P0 核心模块 `complete + partial >= 95%`
- Null-rate: 关键字段空值率 <= 0.5%
- PK: 主键冲突 = 0
- Control-flow: 手动/定时/启动补跑/暂停恢复取消全部可用
