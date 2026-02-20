# Roadmap

## 任务名称
Tushare 多资产数据池部分覆盖规划（股票、ETF、指数、期货、现货、外汇、宏观经济）

## 目标
1. 明确 7 大资产类型的“首期必须覆盖（L1）”与“次期扩展（L2）”子类数据。
2. 将覆盖决策映射到可执行的模块清单、接口清单、存储清单和验收清单。
3. 采用分批落地，优先保证高频交易相关资产（股票/ETF/指数/期货/现货）可用，再扩展外汇和宏观。

## 范围边界
1. 数据源基于 Tushare。
2. 本期以日频为主，分钟级与实时仅做预留，不作为首期强依赖。
3. 允许“部分覆盖”，但每类必须定义清晰的可用边界与缺失说明。
4. 港股通相关数据默认用于标签和监控，不进入回测链路。
5. 积分门槛按需补充，不作为规划风险条目。
6. 数据消费遵循“面向使用的整合优先”，禁止业务层直接依赖 provider 原子接口表。

## 数据整合总原则（面向使用）
1. 架构导向：
- 从“接口驱动”转为“数据产品驱动”，按交易/分析/解释场景设计可复用数据产品。
2. 双池职责：
- Universe 负责采集、标准化、跨接口整合、版本化沉淀，产出 SSOT 与集成层。
- Target 仅消费 SSOT/集成层进行任务计算、覆盖率判定与缺口回补触发。
3. 判定口径：
- `complete/partial/missing/not_applicable` 按“数据产品可用性”判定，而非按单一接口是否成功返回。
4. 处理原则：
- 保留原子事实，不直接暴露给业务端；统一单位、日历、代码、时区后再提供上层消费。
- 所有成分与权重数据按生效区间管理（`in_date/out_date`），禁止覆盖历史。

## 统一数据分层（全资产）
1. L0 Raw（可选但建议）：
- 保留 provider 原始返回快照，服务审计、回放和排错。
2. L1 Standard Fact：
- 统一后的原子事实表（字段名、单位、主键、交易日历、source、ingested_at）。
3. L2 Data Product：
- 面向使用场景的整合数据产品（跨接口拼接、跨资产对齐、口径归一）。
4. L3 Task Feature（Target）：
- 任务所需特征与状态层，仅由 L2 派生，不反向污染 SSOT。

## 跨资产数据产品清单（v1）
1. `dp_instrument_profile`：
- 统一证券主档（股票/ETF/指数/期货/现货），含名称、状态、标签、行业归属与可交易性。
2. `dp_quote_daily`：
- 统一日线行情（原始价 + 复权价 + 成交量额），作为 `task.momentum` 与基础展示底座。
3. `dp_liquidity_daily`：
- 统一流动性指标（量、额、换手/份额规模、市场背景统计），服务 `task.liquidity`。
4. `dp_exposure_membership_daily`：
- 指数/行业成分与权重按日可查询快照，服务 `task.exposure` 与归因分析。
5. `dp_market_context_daily`：
- 市场级背景数据（沪深统计、深圳概况、国际指数、后续宏观扩展）统一整合。
6. `dp_factor_daily`：
- 技术面和风格因子统一出口（首期指数因子为主），避免策略层重复拼装。

## 指数数据整合映射（按已确认 11 类）
1. 基本信息 `index_basic`：
- 进入 `dp_instrument_profile`，用于标的主档与状态过滤。
2. 日线行情 `index_daily`：
- 进入 `dp_quote_daily`（指数子域），并提供给相对强弱计算。
3. 成分和权重 `index_member_all` + `index_weight`：
- 进入 `dp_exposure_membership_daily`，以生效区间展开日快照。
4. 大盘每日指标 `index_dailybasic`：
- 进入 `dp_market_context_daily`（估值与市场状态因子）。
5. 行业分类 `index_classify`：
- 进入 `dp_instrument_profile` 的行业维度与分类映射表。
6. 行业成分 `index_member_all`（行业指数口径）：
- 进入 `dp_exposure_membership_daily` 的行业子域。
7. 行业指数日线 `sw_daily`：
- 进入 `dp_quote_daily`（行业子域），用于行业轮动。
8. 国际指数 `index_global`：
- 进入 `dp_market_context_daily`，允许时区滞后规则。
9. 指数技术面因子 `idx_factor_pro`：
- 进入 `dp_factor_daily`（指数子域）。
10. 沪深市场每日交易统计 `daily_info`：
- 进入 `dp_market_context_daily`（沪深统一统计主来源）。
11. 深圳市场每日交易概况 `sz_daily_info`：
- 进入 `dp_market_context_daily`（深圳细分补充来源），不替代 `daily_info`。

## 数据治理与质量门禁（v1）
1. 单位治理：
- 对成交额、成交量、市值、份额统一单位字段与标准化数值字段。
2. 时间治理：
- 所有产品表以 `trade_date` 为主时间键；跨市场数据允许配置化滞后窗口。
3. 口径治理：
- 同类指标多来源时定义主源与补源，冲突保留 lineage（source + source_field）。
4. 质量门禁：
- 连续性校验、空值率校验、主键冲突校验、成分权重和校验（如权重和接近 100%）。
5. 回补策略：
- Target 检测 L2 缺口后仅触发 Universe 定向补齐，不直接降级为 provider 逐 symbol 拉取。

## 全资产整体梳理（权限/关联/整合/双池）
1. 数据源权限基线（基于当前账号 8000 分 + 本地实测）：
- 当前规划覆盖的股票、ETF、指数、期货、现货、外汇、宏观主链路，8000 分可覆盖绝大多数接口。
- `stk_premarket` 不受积分阈值控制，需单独开通接口权限；在当前 token 下实测返回 `40203`（无权限）。
- 关键高门槛接口已可用：`etf_share_size`、`etf_basic`、`index_global`、`dc_index/dc_member/dc_daily`。
- 结论：`stk_premarket` 不进入当前规划范围（本轮排除），未开通不阻断股票主链路。
2. 跨接口与跨资产关联关系（面向使用）：
- 统一主键：`symbol/ts_code + asset_class + exchange`；统一时间轴：交易数据按 `trade_date`，宏观按 `available_date`。
- 股票链路：`daily/adj_factor/daily_basic/moneyflow/suspend_d` 围绕 `ts_code + trade_date` 融合，事件类数据通过 `event_date` 与行情关联。
- ETF/指数链路：ETF 基准、指数成分、行业成分统一进入“篮子关系层”，用于暴露与归因，不在业务层重复拼接口。
- 期货/现货链路：通过品种映射与交易日对齐，形成 `spot-futures` 联动背景（价差、交收、持仓）。
- 外汇/宏观链路：作为全局上下文模块注入，不进入交易执行链路，严格遵循可用时点约束。
3. 数据整合与数据库表设计（统一建模）：
- 统一事实底座：`daily_prices` 继续作为跨资产日线主事实表，资产特有字段进入扩展表（ETF/指数/期货/现货各自 ext）。
- 统一维表：新增并维护 `instrument_master`（跨资产主档）、`trade_calendar`（多市场）、`fx_pair_meta`、`macro_series_meta`。
- 统一关系表：指数/行业/概念成分统一抽象到 `basket_membership_daily`（保留来源与生效区间），避免多套口径并存。
- 统一事件表：IPO、停复牌、回购、大宗、管理层等统一抽象为 `corporate_events`（事件类型 + 生效日期 + 发布日期）。
- 宏观统一长表：`macro_observations(series_key, period_end, release_date, available_date, value, revision_no, ...)`，避免按接口碎片化孤表。
- 建设策略：统一表 `instrument_master/basket_membership_daily/corporate_events` 在 P0 一次建齐，后续批次只增量扩展字段与映射，不拆分二次重构。
4. Universe Pool 与 Target Pool 分工确认（固化）：
- Universe：负责目录同步、原子采集、标准化落库、历史回补、版本追溯，输出 SSOT 与可复用数据产品。
- Target：严格 `SSOT-first` 消费，按资产类型执行任务矩阵，输出 `complete/partial/missing/not_applicable`。
- 缺口处理：Target 只触发 Universe 定向补齐，不直接将 provider 拉取作为默认主路径。
- 职责边界：外汇和宏观在 Target 层以“全局上下文模块”消费，不纳入交易执行任务。
- 港股通：保留为标签与监控数据，不进入回测主链路。
5. `stk_premarket` 处置结论（本轮关闭）：
- 不进入当前规划与实施批次（P0/P1/P2 均不纳入）。
- 当前方案使用 `daily_basic + stk_limit` 覆盖主要使用场景。
- 仅在后续独立需求提出时再单独评估是否重开。

## 分类型覆盖候选（讨论基线）
1. 股票（stock）[已对齐 v1：2026-02-19]
- L1（Universe / SSOT）：
  - 基础：`stock_basic`、`trade_cal`（CN_EQ 全局日历）、`stock_hsgt`（港股通标签）、`stock_company`、`stk_managers`、`stk_rewards`、`new_share`。
  - 行情：`daily`、`weekly`、`adj_factor`、`daily_basic`、`suspend_d`、`ggt_daily`。
  - 财务原子：`income`、`balancesheet`、`cashflow`、`fina_indicator`。
  - 参考与行为：`repurchase`、`block_trade`。
  - 资金流向：`moneyflow`、`moneyflow_ind_ths`、`moneyflow_ind_dc`、`moneyflow_mkt_dc`、`moneyflow_hsgt`。
  - 打板专题（东方财富）：`dc_index`、`dc_member`、`dc_daily`。
- L1（Target / 任务消费）：
  - 核心模块：`core.daily_prices`、`core.instrument_meta`、`core.daily_basics`、`core.daily_moneyflows`。
  - 策略模块：`task.exposure`、`task.momentum`、`task.liquidity`。
  - 业务规则：港股通数据只用于标签和监控，不参与回测；接口起始边界按 `stock_hsgt` 可得日期执行。
- L2（轻量增补，本轮纳入）：
  - `namechange`、`stock_st`/`st`、`disclosure_date`、`fina_audit`、`forecast`、`express`、`share_float`、`stk_holdertrade`、`top_list`、`stk_limit`、`limit_list_d`。
- 接口策略：
  - `pro_bar` 作为聚合读取能力，不作为 Universe 主采集链路；Universe 统一用原子接口入 SSOT，Target 从 SSOT 派生复权口径和任务特征。

2. ETF（etf）[已对齐 v1：2026-02-19]
- L1（Universe / SSOT）：
  - 目录同步（低频）：`etf_basic`，仅用于符号有效性、名称展示、上市状态过滤，不作为高频分析主数据。
  - 日线主行情：`fund_daily`，写入 `daily_prices`（open/high/low/close/volume）与 `etf_daily_ext`（pre_close/change/pct_chg/amount）。
  - 复权因子：`fund_adj`，写入 `etf_adj_factor`（symbol/trade_date/adj_factor/source/ingested_at）。
  - 份额规模：`etf_share_size`，写入 `etf_share_size`（symbol/trade_date/total_share/total_size/nav/close/exchange/source/ingested_at）。
- L1（Target / 任务消费）：
  - `core.daily_prices`：读取 `daily_prices`，作为 ETF 所有任务的底座行情。
  - `task.momentum`：读取 `daily_prices + etf_adj_factor`，以复权口径构建动量序列。
  - `task.liquidity`：读取 `daily_prices + etf_daily_ext.amount + etf_share_size`，构建流动性与容量信号。
  - `task.exposure`：首期默认 `not_applicable`（不依赖 ETF 基准指数映射）。
- L2（后续扩展）：
  - `etf_index`（ETF 基准指数映射）。
  - `rt_etf_k`、`rt_min`、`stk_mins`（实时/分钟口径）。
  - `fund_factor_pro`（ETF 技术面因子）。
- 接口策略：
  - `pro_bar` 仅作为聚合读取能力，不作为 Universe 主采集链路；Universe 固定以原子接口写入 SSOT。
  - ETF 不强制 `daily_basics`/`daily_moneyflows` 股票口径，避免语义误配。

3. 指数（index）[已对齐 v1：2026-02-19]
- L1（Universe / SSOT）：
  - 指数主档：`index_basic`。
  - 指数行情：`index_daily`。
  - 成分与权重：`index_member_all` + `index_weight`（权重月度快照 + 日度展开）。
  - 大盘指标：`index_dailybasic`。
  - 行业体系：`index_classify` + 行业成分（`index_member_all` 行业口径）。
  - 行业行情：`sw_daily`。
  - 国际指数：`index_global`。
  - 市场统计：`daily_info` + `sz_daily_info`。
  - 技术因子：`idx_factor_pro`（首期纳入核心因子子集）。
- L1（Target / 任务消费）：
  - 阶段 A（保持当前代码约束，`AssetClass` 不含 `index`）：指数作为上下文资产，服务股票/ETF 的 `task.exposure`、`task.momentum`、`task.liquidity`。
  - 阶段 B（扩展 `AssetClass` 到 `index` 后）：指数可成为独立目标池标的，启用指数专属核心模块与状态判定。
- L2（后续扩展）：
  - `index_weekly`、`index_monthly`。
  - 中信行业：`ci_index_member`、`ci_daily`。
  - 实时与分钟：`rt_idx_k`、`rt_idx_min`、`index_min`。
  - 更完整指数因子全集（非核心字段）。

4. 期货（futures）[已对齐 v1：2026-02-19]
- 目标定位：
  - 以“走势辅助分析”为核心，不以交易执行为目标。
- L1（Universe / SSOT）：
  - 合约主档：`fut_basic`（低频目录同步，用于品种归并和换月边界）。
  - 交易日历：`trade_cal`（按 SHFE/DCE/CZCE/CFFEX/INE/GFEX 交易所口径）。
  - 日线行情：`fut_daily`。
  - 市场基准：南华期货指数 `index_daily`（`.NH` 指数代码集合）。
  - 周度结构：`fut_weekly_detail`（主要品种交易周报）。
- L1（Target / 任务消费）：
  - `task.momentum`：读取 `dp_fut_trend_daily`（南华指数 + 重点品种连续序列）。
  - `task.exposure`：读取 `dp_fut_weekly_context`（周报结构变化与品种热度）。
  - `task.liquidity`：读取 `fut_daily` 的量额持仓 + 周度结构背景，作为解释性指标而非交易触发。
  - 首期不引入分钟级与席位级微观数据，降低复杂度。
- L2（后续扩展）：
  - 主力连续增强（多切换规则并行评估）。
  - 分钟行情、仓单日报、席位持仓细分、事件化专题。

5. 现货（spot）[已对齐 v1：2026-02-19]
- 目标定位：
  - 以“贵金属现货走势与交收背景辅助分析”为核心，不以交易执行为目标。
- L1（Universe / SSOT）：
  - 合约主档：`sge_basic`（低频目录同步，仅保留最小必需字段集）。
  - 交易日历：`trade_cal`（SGE 口径，按可得性启用）。
  - 日线行情：`sge_daily`（含均价、成交、持仓、交收字段）。
- L1（Target / 任务消费）：
  - `task.momentum`：读取 `daily_prices + spot_sge_daily_ext.price_avg`，构建现货趋势信号。
  - `task.liquidity`：读取 `spot_sge_daily_ext.amount/oi/settle_vol`，提供现货活跃度背景。
  - `task.exposure`：首期固定 `not_applicable`（现货不做权重暴露任务）。
  - 首期仅覆盖 SGE 可得合约，缺失统一标记 `not_applicable`，不阻断其他资产任务。
- L2（后续扩展）：
  - 在 Tushare 可得范围内扩展更多现货口径。
  - 增加“现货-期货联动”衍生特征（价差、交收压力、持仓联动）。

6. 外汇（fx）[已对齐 v1：2026-02-19]
- 目标定位：
  - 外汇仅用于跨市场趋势与风险背景，不参与外汇交易执行。
- L1（Universe / SSOT）：
  - 日线行情：`fx_daily`（币对白名单采集，首期仅日级）。
  - 主档策略：不建设高频外汇主档，使用轻量币对字典维护 `base_ccy/quote_ccy/quote_convention`。
- L1（Target / 任务消费）：
  - `task.momentum`：读取 `daily_prices(asset_class='fx')`，构建汇率趋势背景信号。
  - `task.exposure`：固定 `not_applicable`（外汇不承担持仓暴露任务）。
  - `task.liquidity`：固定 `not_applicable`（不基于外汇成交活跃度做任务）。
- L2（后续扩展）：
  - 扩展币对白名单与区域篮子（仍保持日级）。
  - 增加轻量衍生特征（如滚动波动率、偏离度），但不引入交易执行链路。

7. 宏观经济（macro）[已对齐 v1：2026-02-19]
- 目标定位：
  - 宏观仅用于跨资产背景与解释，不直接作为交易执行输入。
- L1（Universe / SSOT）：
  - 国内关键利率：`shibor`、`shibor_lpr`。
  - 国内增长与价格：`cn_gdp`、`cn_cpi`、`cn_ppi`、`cn_pmi`。
  - 国内流动性与信用：`cn_m`、`sf_month`。
  - 行业经济轻量补充：`tmt_twincome`（作为电子链外需景气代理）。
  - 国外维度：美国利率全口径 `us_tycr/us_trycr/us_tbr/us_tltr/us_trltr`。
- L1（Target / 任务消费）：
  - `macro.cn_growth_inflation`：消费 GDP/CPI/PPI/PMI 的统一特征。
  - `macro.cn_liquidity`：消费 SHIBOR/LPR/M2/社融 的统一特征。
  - `macro.us_rates`：消费美国利率全口径，构建名义与实际利率背景。
  - `macro.cross_market`：消费中美利率相关衍生特征（如利差、斜率变化）。
- L2（后续扩展）：
  - 扩展行业经济明细（如 `tmt_twincomedetail`）与更多海外宏观口径。
  - 增加事件化与修订跟踪特征，但保持“非交易执行”定位。

## ETF 规则文案（定稿）
1. 数据采集规则：
- ETF 首期必须采集 `fund_daily`、`fund_adj`、`etf_share_size`；`etf_basic` 仅做低频目录同步。
2. SSOT 写入规则：
- `fund_daily` 拆分写入 `daily_prices` 与 `etf_daily_ext`。
- `fund_adj` 写入 `etf_adj_factor`。
- `etf_share_size` 写入 `etf_share_size`。
3. Target 消费规则（as_of_trade_date 粒度）：
- `core.daily_prices`：当日存在 `daily_prices(symbol, trade_date)` 记 `complete`，否则 `missing`。
- `core.instrument_meta`：存在 ETF 元数据记 `complete`，否则 `missing`。
- `task.momentum`：当日价格 + 当日复权因子齐全记 `complete`；仅有价格记 `partial`；两者都缺记 `missing`。
- `task.liquidity`：当日价格 +（`amount` 或 `volume`）+ 当日份额规模齐全记 `complete`；缺份额规模但价格与成交存在记 `partial`；价格缺失记 `missing`。
- `task.exposure`：首期固定 `not_applicable`。
- `core.daily_basics` 与 `core.daily_moneyflows`：ETF 固定 `not_applicable`。
4. 统计与追溯规则：
- `inserted` 仅统计首次出现的主键行；`updated` 统计主键已存在但字段被覆盖的行。
- `source` 固定记录 provider（首期为 `tushare`），`ingested_at` 记录落库时间戳，保证审计可追溯。

## ETF 数据结构与建表规范（v1）
1. `analysis.duckdb` 新增：
- `etf_daily_ext(symbol,trade_date,pre_close,change,pct_chg,amount,source,ingested_at)`，主键 `(symbol, trade_date)`。
- `etf_adj_factor(symbol,trade_date,adj_factor,source,ingested_at)`，主键 `(symbol, trade_date)`。
- `etf_share_size(symbol,trade_date,etf_name,total_share,total_size,nav,close,exchange,source,ingested_at)`，主键 `(symbol, trade_date)`。
2. `market-cache.sqlite` 镜像新增同名三张表，字段同构、主键同构，便于 Target 读取与状态判定。
3. 单位约定沿用 Tushare 原口径并写入字段注释：
- `amount` 单位为千元；`total_share` 单位为万份；`total_size` 单位为万元。

## 指数规则文案（定稿）
1. 数据采集规则：
- 指数首期必须采集 `index_basic/index_daily/index_member_all/index_weight/index_dailybasic/index_classify/sw_daily/index_global/daily_info/sz_daily_info/idx_factor_pro`。
- `idx_factor_pro` 首期按“核心因子白名单”入库，避免无差别拉全字段导致存储膨胀。
2. SSOT 写入规则：
- `index_daily` 与 `sw_daily` 统一写入 `daily_prices`（保留 asset_subclass 标识：broad/industry/global）。
- 指数扩展字段（如 `amount/change/pct_chg`）写入 `index_daily_ext`。
- 成分和权重统一整合到 `index_membership_daily`（按 `in_date/out_date` 展开为 `trade_date` 快照）。
- 市场统计写入 `market_daily_stats`（主源 `daily_info`）与 `sz_market_daily_stats`（补充源 `sz_daily_info`）。
3. Target 消费规则（as_of_trade_date 粒度）：
- 阶段 A（当前）：指数不作为独立 target symbol；状态统计在“上下文模块”维度计算，不写入指数 symbol 级状态。
- 阶段 B（扩展后）：指数 symbol 级状态按以下规则执行：
  - `core.daily_prices`：当日存在行情记 `complete`，否则 `missing`。
  - `core.instrument_meta`：存在主档记 `complete`，否则 `missing`。
  - `core.index_membership`：最近 40 个自然日内有有效权重快照记 `complete`，超过 40 天记 `partial`，无数据记 `missing`。
  - `core.index_daily_basics`：当日存在大盘指标记 `complete`，无对应口径记 `not_applicable`。
  - `core.market_context`：当日 `daily_info` 可用记 `complete`；仅 `sz_daily_info` 可用记 `partial`；两者均缺记 `missing`。
  - `task.exposure`：依赖 `core.index_membership`；`complete/partial/missing` 跟随其状态。
  - `task.momentum`：依赖 `core.daily_prices` +（可选）`idx_factor_pro`；仅价格可用记 `partial`，价格和核心因子齐全记 `complete`。
  - `task.liquidity`：依赖 `daily_prices.amount/vol` + 市场统计背景；缺市场统计可记 `partial`。
4. 统计与追溯规则：
- `inserted`/`updated` 口径与股票、ETF 一致。
- 所有整合表保留 `source` 与 `ingested_at`，成分整合额外保留 `source_window`（来源日期窗口）用于追溯。

## 指数数据结构与建表规范（v1）
1. `analysis.duckdb` 新增：
- `index_daily_ext(symbol,trade_date,pre_close,change,pct_chg,amount,source,ingested_at)`，主键 `(symbol, trade_date)`。
- `index_membership_daily(index_code,symbol,trade_date,weight,industry_code,source,ingested_at)`，主键 `(index_code, symbol, trade_date)`。
- `index_daily_basics(index_code,trade_date,total_mv,float_mv,total_share,float_share,free_share,turnover_rate,turnover_rate_f,pe,pe_ttm,pb,source,ingested_at)`，主键 `(index_code, trade_date)`。
- `market_daily_stats(exchange,segment_code,trade_date,security_count,amount,volume,turnover,pe,total_mv,float_mv,source,ingested_at)`，主键 `(exchange, segment_code, trade_date)`。
- `sz_market_daily_stats(segment_code,trade_date,security_count,amount,volume,total_share,float_share,total_mv,float_mv,source,ingested_at)`，主键 `(segment_code, trade_date)`。
- `index_factor_daily(index_code,trade_date,factor_key,factor_value,source,ingested_at)`，主键 `(index_code, trade_date, factor_key)`。
2. `market-cache.sqlite` 镜像新增同名轻量表（字段同构）：
- 供 Target 模块与覆盖率判定直接读取，避免实时访问 DuckDB。
3. 单位与口径治理：
- `daily_info` 与 `sz_daily_info` 的单位差异必须在入库时标准化，并保留 `raw_unit` 字段用于审计。
- `index_member_all` 与 `index_weight` 冲突时，`index_weight` 优先，`index_member_all` 作为补源并记录 lineage。

## 期货规则文案（定稿）
1. 数据采集规则：
- 期货首期必须采集 `fut_basic/trade_cal/fut_daily/index_daily(.NH)/fut_weekly_detail`。
- 采集目标以“趋势与市场结构分析”优先，不采分钟级和逐席位明细。
2. SSOT 写入规则：
- `fut_daily` 写入 `daily_prices`（统一 OHLCV）与 `futures_daily_ext`（settle/amount/oi/oi_chg 等扩展）。
- 南华指数 `index_daily` 写入 `daily_prices` 与 `futures_index_daily_ext`，并标记 `asset_subclass='futures_benchmark'`。
- `fut_weekly_detail` 写入 `futures_weekly_context`，按 `week_start/week_end` 保留周区间事实。
- `fut_basic` 写入 `futures_contract_meta`，用于连续映射与品种聚合。
3. Target 消费规则（as_of_trade_date 粒度）：
- `core.daily_prices`：当日 `fut_daily` 可用记 `complete`，否则 `missing`。
- `core.instrument_meta`：存在合约主档记 `complete`，否则 `missing`。
- `core.futures_settle`：当日 `settle` 可用记 `complete`，缺失记 `missing`。
- `core.futures_oi`：当日 `oi` 可用记 `complete`，缺失记 `missing`。
- `task.momentum`：当日价格可用 +（南华指数或连续序列其一可用）记 `complete`；仅价格可用记 `partial`；价格缺失记 `missing`。
- `task.exposure`：最近一个自然周有 `fut_weekly_detail` 记 `complete`；超过 14 天无更新记 `partial`；连续缺失记 `missing`。
- `task.liquidity`：价格 +（`volume` 或 `amount`）齐全记 `complete`；缺周度背景记 `partial`；价格缺失记 `missing`。
4. 统计与追溯规则：
- `inserted/updated` 口径与股票、ETF、指数一致。
- 周报整合记录 `source_week` 与 `source_publish_date`，保证周度事实可追溯。

## 期货数据结构与建表规范（v1）
1. `analysis.duckdb` 新增：
- `futures_index_daily_ext(symbol,trade_date,pre_close,change,pct_chg,amount,source,ingested_at)`，主键 `(symbol, trade_date)`。
- `futures_weekly_context(contract_code,week_start,week_end,trade_amount,trade_volume,oi,oi_change,yoy,source,ingested_at)`，主键 `(contract_code, week_start, week_end)`。
- `futures_continuous_daily(continuous_code,trade_date,active_symbol,open,high,low,close,volume,amount,oi,roll_flag,source,ingested_at)`，主键 `(continuous_code, trade_date)`。
2. `market-cache.sqlite` 镜像新增同名轻量表：
- 供 Target 读取趋势与周度背景，避免实时访问 DuckDB。
3. 单位与口径治理：
- `fut_daily` 与南华指数 `index_daily` 的 `amount/vol` 单位必须在写入时标准化，保留 `raw_unit` 字段。
- 连续合约切换规则首期固定为“持仓量优先，成交量兜底”，并记录 `roll_flag`。

## 现货规则文案（定稿）
1. 数据采集规则：
- 现货首期必须采集 `sge_basic/sge_daily`，并同步 `trade_cal(SGE)`（可得则启用）。
- 采集范围限定为 SGE 可提供合约，范围外统一视为 `not_applicable`。
2. SSOT 写入规则：
- `sge_daily` 拆分写入 `daily_prices`（统一 OHLCV）与 `spot_sge_daily_ext`（price_avg/change/pct_change/amount/oi/settle_vol/settle_dire）。
- `sge_basic` 写入 `spot_sge_contract_meta`。
- SGE 日历写入 `trade_calendar(market='SGE')`。
3. Target 消费规则（as_of_trade_date 粒度）：
- `core.daily_prices`：当日存在 `daily_prices` 记 `complete`，否则 `missing`。
- `core.instrument_meta`：存在现货主档记 `complete`，否则 `missing`。
- `core.spot_price_avg`：当日 `price_avg` 存在记 `complete`，否则 `missing`。
- `core.spot_settle`：当日 `settle_vol` 存在记 `complete`，否则 `missing`。
- `task.momentum`：价格与 `price_avg` 同时可用记 `complete`；仅价格可用记 `partial`；价格缺失记 `missing`。
- `task.liquidity`：`amount` 或 `oi` 可用记 `complete`；仅 `settle_vol` 可用记 `partial`；全部缺失记 `missing`。
- `task.exposure`：固定 `not_applicable`。
4. 统计与追溯规则：
- `inserted/updated` 口径与股票、ETF、指数、期货一致。
- 现货扩展表必须保留 `source` 与 `ingested_at`，并记录缺失原因（若为 `not_applicable`）。

## 现货数据结构与建表规范（v1）
1. `analysis.duckdb`：
- 复用既有 `spot_sge_contract_meta` 与 `spot_sge_daily_ext` 作为现货主表。
- 保持 `daily_prices` 与 `spot_sge_daily_ext` 双表并存，前者统一消费，后者保留现货特有字段。
2. `market-cache.sqlite` 镜像新增：
- `spot_sge_contract_meta(ts_code,ts_name,trade_type,t_unit,p_unit,min_change,price_limit,min_vol,max_vol,trade_mode,updated_at)`。
- `spot_sge_daily_ext(symbol,trade_date,price_avg,change,pct_change,amount,oi,settle_vol,settle_dire,source,ingested_at)`。
3. 单位与口径治理：
- `sge_daily` 的 `amount/vol/oi/settle_vol` 单位按原始文档保留 `raw_unit` 并写标准化字段。
- 若字段在特定合约天然不存在（非数据缺失），统一写 `not_applicable` 语义而非 `missing`。

## 现货域使用与治理补充（方向确认）
1. 基础信息使用策略：
- 现货基础信息采用“最小必需集”策略，只用于主键统一、单位解释、品种分组、质量校验和追溯，不作为分析主特征。
- `sge_basic` 维持低频同步（目录级），避免占用高频链路预算。
2. 交易所覆盖策略：
- V1 明确为“仅 SGE 覆盖”，在架构上预留多交易所扩展能力（统一 `exchange` 维度与 `coverage_status` 字段）。
- 对当前数据源不可得交易所，不做伪数据补齐，统一通过 `not_applicable/missing` 语义暴露缺口。
3. 跨资产统一治理策略：
- 现货不做孤立域处理，统一纳入跨资产数据产品治理，与期货、ETF共享口径规范与质量门禁。
- 首期交集重点：`spot-futures`（价差、交收压力、持仓联动）与 `spot-ETF`（趋势一致性、偏离解释）。
- Target 层统一消费跨资产整合结果，避免现货、期货、ETF 各自构建独立逻辑。

## 外汇规则文案（定稿）
1. 数据采集规则：
- 外汇首期仅采集 `fx_daily`（日线），不采分钟级、不采成交明细、不接交易执行相关字段。
- 币对白名单配置化管理（默认覆盖项目关注币对），不做全市场无差别拉取。
2. SSOT 写入规则：
- `fx_daily` 统一写入 `daily_prices`，并标记 `asset_class='fx'`、`source='tushare'`。
- `symbol` 标准化为统一币对编码（如 `USDCNY`、`EURUSD`），禁止同一币对多命名并存。
- `trade_date` 对齐日级时间轴，非交易日不做前填充值落库。
3. Target 消费规则（as_of_trade_date 粒度）：
- `core.daily_prices`：当日存在汇率日线记 `complete`，否则 `missing`。
- `core.instrument_meta`：币对在白名单字典中记 `complete`，否则 `missing`。
- `task.momentum`：当日价格可用记 `complete`，连续缺失记 `missing`。
- `task.exposure`：固定 `not_applicable`。
- `task.liquidity`：固定 `not_applicable`。
4. 统计与追溯规则：
- `inserted/updated` 口径与股票、ETF、指数、期货、现货一致。
- 缺失语义严格区分：`missing` 表示应有未到，`not_applicable` 表示任务本身不适用。

## 外汇数据结构与建表规范（v1）
1. `analysis.duckdb`：
- 复用 `daily_prices` 作为外汇主事实表，首期不新增外汇扩展事实表。
- 新增 `fx_pair_meta(symbol,base_ccy,quote_ccy,quote_convention,is_active,updated_at)` 用于白名单与元数据管理。
2. `market-cache.sqlite` 镜像新增：
- `fx_pair_meta`（字段同构），供 Target 状态判定与白名单校验。
3. 单位与口径治理：
- `daily_prices` 中外汇记录以 `close` 为主消费字段；`open/high/low` 按源可得性写入。
- 不可得的量额字段保留空值，不以伪数据补齐。

## 宏观规则文案（定稿）
1. 数据采集规则：
- 国内首期必须采集 `shibor/shibor_lpr/cn_gdp/cn_cpi/cn_ppi/cn_pmi/cn_m/sf_month`。
- 行业经济首期轻量纳入 `tmt_twincome`，作为景气补充，不做重度专题展开。
- 国外首期必须全量采集美国利率 `us_tycr/us_trycr/us_tbr/us_tltr/us_trltr`。
2. SSOT 写入规则：
- 宏观数据统一写入长表 `macro_observations`，禁止按接口各自落孤表导致后续消费割裂。
- 每条记录必须包含 `period_end/release_date/available_date` 三个时间字段，回测与分析统一按 `available_date` 生效，禁止穿越未来。
- 美国利率日频数据与国内月频/季频数据统一通过 `series_key + frequency` 管理，不做强行同频对齐落库。
3. Target 消费规则（as_of_trade_date 粒度，模块级判定）：
- `macro.cn_growth_inflation`：GDP/CPI/PPI 至少 2 项当期可用记 `complete`；仅 1 项记 `partial`；均缺记 `missing`。
- `macro.cn_liquidity`：SHIBOR 或 LPR 可用且 M2/社融存在最近一期可用值记 `complete`；仅利率或仅信用可用记 `partial`；均缺记 `missing`。
- `macro.us_rates`：美国利率 5 组口径当日可用比例 >= 80% 记 `complete`，>0 且 <80% 记 `partial`，全缺记 `missing`。
- `macro.cross_market`：中美两侧基础模块均 `complete` 记 `complete`；仅单侧可用记 `partial`；双侧不可用记 `missing`。
- 宏观模块默认不做 symbol 级状态，写入 `GLOBAL` 维度；禁用模块时记 `not_applicable`。
4. 统计与追溯规则：
- `inserted/updated` 口径与其他资产一致，修订值写入 `updated` 并保留修订版本。
- 对同一 `series_key + period_end` 的多次发布，必须按 `release_date` 追溯历史版本。

## 宏观 `available_date` 发布滞后规则（建议定稿）
1. 基本原则：
- 宏观模块统一以 `available_date` 生效，不以 `period_end` 直接生效。
- 计算优先级：`release_date` 明确时优先使用；缺失时使用 `fallback_lag_days` 推导。
2. 统一计算流程：
- 步骤 A：确定 `release_date`（源数据字段；若为空则置空）。
- 步骤 B：计算 `available_ts`：
  - 有 `release_date`：`available_ts = release_date + safety_lag_hours`。
  - 无 `release_date`：`available_ts = period_end + fallback_lag_days`。
- 步骤 C：`available_date = next_trade_date(CN_EQ, date(available_ts))`。
3. 默认滞后参数（首期）：
- 国内日频利率（`shibor`）：`safety_lag_hours = 12`，`fallback_lag_days = 1`。
- 美国日频利率（`us_tycr/us_trycr/us_tbr/us_tltr/us_trltr`）：`safety_lag_hours = 18`，`fallback_lag_days = 1`（统一按次一中国交易日生效）。
- 月频快指标（`shibor_lpr/cn_pmi`）：`safety_lag_hours = 12`，`fallback_lag_days = 2`。
- 月频中观指标（`cn_cpi/cn_ppi/cn_m/sf_month/tmt_twincome`）：`safety_lag_hours = 12`，`fallback_lag_days = 15`。
- 季频指标（`cn_gdp`）：`safety_lag_hours = 12`，`fallback_lag_days = 30`。
4. 修订与版本规则：
- 同一 `series_key + period_end` 出现新发布时，新增一行并提升 `revision_no`，不覆盖历史版本。
- `macro_observations_latest` 始终取 `available_date <= as_of_trade_date` 的最新可用版本。
5. 质量校验规则：
- 禁止出现 `available_date < release_date`（若存在则标记错误并阻断物化）。
- 禁止 `available_date` 空值进入 `macro_module_snapshot`。
- 每次批处理输出 `backfill_latency_days`（`available_date - period_end`）用于监控异常漂移。

## 宏观数据结构与建表规范（v1）
1. `analysis.duckdb` 新增：
- `macro_series_meta(series_key,region,topic,source_api,frequency,unit,is_active,updated_at)`，主键 `(series_key)`。
- `macro_observations(series_key,period_end,release_date,available_date,value,unit,frequency,revision_no,source,ingested_at)`，主键 `(series_key, period_end, release_date)`。
- `macro_module_snapshot(as_of_trade_date,module_id,status,coverage_ratio,payload_json,source_run_id,updated_at)`，主键 `(as_of_trade_date, module_id)`。
2. `market-cache.sqlite` 镜像新增：
- `macro_series_meta`（字段同构）。
- `macro_observations_latest(series_key,available_date,value,period_end,release_date,frequency,source,updated_at)`，主键 `(series_key, available_date)`。
- `macro_module_snapshot`（字段同构），供 Target 与前端直接读取。
3. 单位与口径治理：
- 对 `cn_m/sf_month/cn_gdp/cn_cpi/cn_ppi/cn_pmi/tmt_twincome` 统一保留原始单位与标准化单位字段（`raw_unit/std_unit`）。
- 美国利率口径统一按百分比值存储（`value_pct`），并保留原字段映射到 `series_key` 的字典关系。

## 实施批次与验收门禁定稿（P0/P1/P2）
1. 通用准入门禁（所有批次）：
- Token 与权限：批次所需接口至少完成一次探测并返回 `code=0`；权限型接口可标记为“可选增强”且不阻断主链路。
- 日历与配置：对应市场 `trade_calendar` 已初始化；批次开关、回滚开关与告警阈值已配置。
- 主路径约束：Target 必须 `SSOT-first`，禁止默认直拉 provider 作为主路径。
2. 通用退出门禁（所有批次）：
- 运行稳定：连续 3 个交易日批处理无阻断错误（`errors=0` 的 run 至少 3 次）。
- 统计可对账：`inserted/updated/errors` 与目标表行变化可对账。
- 质量门禁：主键冲突为 0；关键字段空值率在阈值内；时间字段符合口径（宏观遵循 `available_date`）。
- 调度回归：手动、定时、启动补跑、暂停/恢复/取消均通过。
3. P0（高优资产）：
- 范围：股票、ETF、指数（上下文模式）、期货、现货（SGE）。
- 前置建设：统一表 `instrument_master/basket_membership_daily/corporate_events` 在 P0 一次建齐并完成首轮回填。
- Universe 可执行清单：
  - 股票：`stock_basic/trade_cal/daily/weekly/adj_factor/daily_basic/suspend_d/moneyflow/repurchase/block_trade`。
  - ETF：`etf_basic/fund_daily/fund_adj/etf_share_size`。
  - 指数：`index_basic/index_daily/index_weight/index_dailybasic/index_classify/sw_daily/index_global/daily_info/sz_daily_info`。
  - 期货：`fut_basic/trade_cal/fut_daily/fut_settle/index_daily(.NH)/fut_weekly_detail`。
  - 现货：`sge_basic/sge_daily/trade_cal(SGE)`。
- Target 可执行清单：
  - stock：`core.daily_prices/core.instrument_meta/core.daily_basics/core.daily_moneyflows/task.exposure/task.momentum/task.liquidity`。
  - etf：`core.daily_prices/core.instrument_meta/task.momentum/task.liquidity`（`task.exposure` 固定 `not_applicable`）。
  - futures：`core.daily_prices/core.instrument_meta/core.futures_settle/core.futures_oi/task.exposure/task.momentum/task.liquidity`。
  - spot：`core.daily_prices/core.instrument_meta/core.spot_price_avg/core.spot_settle/task.momentum`（`task.exposure` 固定 `not_applicable`）。
- P0 退出阈值：
  - 覆盖率：stock/etf/futures/spot 的“必选核心模块”`complete + partial` 比例 >= 95%。
  - 数据质量：`daily_prices` 关键字段（symbol/trade_date/close）空值率 <= 0.5%。
  - 上下文一致性：指数上下文模块当日可用率 >= 95%。
4. P1（扩展资产）：
- 范围：外汇、宏观（国内+美国）。
- Universe 可执行清单：
  - 外汇：`fx_daily`（币对白名单）。
  - 宏观国内：`shibor/shibor_lpr/cn_gdp/cn_cpi/cn_ppi/cn_pmi/cn_m/sf_month/tmt_twincome`。
  - 宏观国外：`us_tycr/us_trycr/us_tbr/us_tltr/us_trltr`。
- Target 可执行清单：
  - fx：`core.daily_prices/core.instrument_meta/task.momentum`（`task.exposure/task.liquidity` 固定 `not_applicable`）。
  - macro：`macro.cn_growth_inflation/macro.cn_liquidity/macro.us_rates/macro.cross_market`（GLOBAL 维度）。
- P1 退出阈值：
  - 外汇覆盖：白名单币对 `task.momentum` 的 `complete + partial` 比例 >= 95%。
  - 宏观覆盖：4 个宏观模块在最近 20 个交易日内 `missing` 天数占比 <= 5%。
  - 回测安全：`macro_module_snapshot` 无 `available_date > as_of_trade_date` 的穿越记录。
5. P2（增强模块）：
- 范围：权限型与专题型增强接口（分钟/实时、扩展专题等）。
- 准入条件：
  - 专项权限接口必须先通过权限实测并形成单独立项后才允许进入批次。
- P2 退出阈值：
  - 增强模块上线后不得降低 P0/P1 已达成覆盖与质量阈值。
  - 增强模块可独立开关与回滚，不影响核心链路。
6. 回滚策略（批次级）：
- 触发条件：任一批次出现阻断错误、覆盖率连续 2 日低于阈值、或时间语义校验失败。
- 回滚动作：关闭对应批次模块开关，保留已入库 SSOT 历史数据，仅停止新增物化写入。
- 恢复条件：修复后完成 1 次全量重跑 + 1 次增量重跑并通过门禁。

## 里程碑
1. M0 对齐阶段
- 产出：7 大类 L1/L2 决策清单（版本 v1）。
- 验收：每类都明确“纳入数据项、排除项、原因”。

2. M1 目录与模型阶段
- 产出：统一模块命名、接口映射、存储映射（SSOT 与缓存层）。
- 验收：每个模块可追溯到 Tushare 接口与目标表。

3. M2 高优资产落地
- 范围：股票、ETF、指数、期货、现货。
- 验收：支持全量池入库与目标池任务状态输出。

4. M3 扩展资产落地
- 范围：外汇、宏观经济。
- 验收：纳入同一调度与观测体系，完成首轮回归。

5. M4 稳定化与验收
- 产出：覆盖率报表、缺口说明、运行手册。
- 验收：按资产类型抽样验收，统计口径可对账。

## 执行策略
1. 每类按“L1 先通、L2 再补”推进，避免一次性过大改造。
2. 全量池优先做可复用 SSOT，目标池仅做任务化消费与状态治理。
3. 每次只放开少量模块，配套回归与回滚开关。

## 讨论节奏（建议）
1. 第 1 轮：股票 + ETF（确定交易与组合最小闭环）。
2. 第 2 轮：指数 + 期货 + 现货（完成多资产交易视角）。
3. 第 3 轮：外汇 + 宏观（补齐跨市场与宏观维度）。

## 当前进度（2026-02-19）
1. 股票域已完成 v1 口径对齐并写入双池映射。
2. ETF 域已完成 v1 口径对齐，并补充规则文案与建表规范。
3. 已补充“面向使用的数据产品驱动整合方案（全资产）”及指数 11 类映射。
4. 指数域已完成 v1 细化：L1/L2、双池使用规则、状态判定与建表规范。
5. 期货域已完成 v1 细化（走势辅助导向，4+1 采集口径，规则文案与建表规范）。
6. 现货域已完成 v1 细化（SGE 限定，规则文案与建表规范）；并确认“最小主档、V1 单交易所、跨资产统一治理”方向。
7. 外汇域已完成 v1 细化（日线-only、非交易导向，规则文案与建表规范）。
8. 宏观经济域已完成 v1 细化（国内+美国双维度，规则文案与建表规范）。
9. 已完成“全资产整体梳理”四项对齐：权限基线、数据关联、整合建模、双池分工。
10. 已完成本地 token 实测：`stk_premarket` 返回 `40203`，确认为专项权限接口，并已从当前规划中排除。
11. 已完成 P0/P1/P2 实施批次与门禁阈值定稿（含回滚策略）。
12. 已确认统一表在 P0 一次建齐，`available_date` 滞后规则采用建议定稿。
13. 下一步进入实施阶段：先执行 P0。

## DoD（规划阶段）
1. 形成资产类型覆盖清单 v1（含 L1/L2 与优先级）。
2. 形成模块到 Tushare 接口映射 v1。
3. 形成落地顺序与验收标准 v1。
