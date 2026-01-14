# 02 Architecture

## Boundaries（边界）
- **账号隔离（business.sqlite）**：组合配置、流水、持仓引擎输出（如快照/报表）、风险规则、目标配置等业务数据必须按账号隔离。
- **全局共享缓存（market-cache.sqlite）**：标的注册表与公共市场数据（行情、公司行为、汇率、交易日历等）允许共享缓存，但不得写入任何账号业务信息（例如持仓数量、现金余额、交易记录）。

## Data model（方向）
### Global（market-cache.sqlite）
- `instruments`：全局标的注册表（`symbol` 为主键），维护 `name/market/currency/asset_class/auto_ingest/...`
- `daily_prices`：日线行情（`symbol + trade_date` 主键），含 `source/ingested_at`
- （规划）`corporate_actions`：公司行为事件（数据源可得时）
- （规划）`fx_rates`：汇率（如纳入多币种折算）
- （规划）`trading_calendar`：交易日历（用于对齐估值/收益率的日期轴）

### Account-scoped（business.sqlite）
- 已有：`app_meta`、`portfolios`、`positions`（兼容层）、`risk_limits`
- （规划）`ledger_entries`：统一流水（买卖/费用税费/分红/现金流/调整/公司行为事件）
- （规划）`allocation_targets`：目标配置
- （规划）`portfolio_snapshots`：报表/快照（用于复盘与可复现）

## Key invariants（必须保持）
- Token/密钥只允许来自本地环境变量或本地配置；不得落库、不得写入仓库、日志不得输出明文。
- 自动拉取 symbol 列表 = `instruments(auto_ingest=1)` ∪ “账号持仓(非 cash)” 去重。
- 不在 DB transaction 内调用外部 HTTP（如 Tushare）；外部拉取与入库分开，保证可回滚与可重试。
- 可追溯：关键结果（估值/收益/归因/风险）必须能定位到输入数据的日期（as-of）与来源（source/ingested_at）。

## Decisions（已确认）
- 真相来源：ledger-first（以流水推导持仓/现金/收益等）
- 交易方向：使用 `side=buy/sell`（数量 `quantity` 为正）
- 成本法（MVP）：均价法
- 不需要多账户/子账户（不引入 account_id 维度）
