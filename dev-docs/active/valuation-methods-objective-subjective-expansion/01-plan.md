# 01-plan

## Phase 1: Contract + schema
- 增加主客观输入、质量标记、置信度、刷新/调度 DTO。
- 增加 business schema 新表与 `valuation_method_versions.input_schema_json`。
- 兼容老 `previewValuationBySymbol`。

## Phase 2: Market data extension
- `daily_basics` 扩展 `pe_ttm/pb/ps_ttm/dv_ttm/turnover_rate`。
- provider 与 ingest 同步新字段写入。

## Phase 3: Valuation engine V2
- 新增 `computeValuationBySymbol`。
- 输入合成顺序：objective -> subjective default -> subjective override -> formula -> insight effects。
- 输出 `confidence/degradationReasons/inputBreakdown`。

## Phase 4: Method pack + seeds
- 股票 builtin 8 方法落地。
- 每个方法落 `input_schema_json`。

## Phase 5: Refresh and scheduler
- 增加 objective/default 刷新任务。
- 增加调度配置与状态查询。

## Phase 6: Frontend
- 方法 Tab 增加输入定义管理视图。
- 标的详情作为估值主入口。
- Insights 预览区接入新计算接口。

## Acceptance criteria
- 可按 symbol 保存主观覆盖并参与估值。
- 客观缺失时按策略降级并输出原因/置信度。
- 股票 8 方法可被列出并可计算。
- typecheck/build 通过，e2e 增加 V2 用例。
