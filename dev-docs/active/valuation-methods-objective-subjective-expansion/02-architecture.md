# 02-architecture

## Data model
- New tables:
  - `valuation_objective_metric_snapshots`
  - `valuation_subjective_defaults`
  - `valuation_subjective_symbol_overrides`
  - `valuation_refresh_runs`
- Extended tables:
  - `valuation_method_versions.input_schema_json`
  - `valuation_adjustment_snapshots.confidence`
  - `valuation_adjustment_snapshots.degradation_reasons_json`
  - `valuation_adjustment_snapshots.input_breakdown_json`

## Contracts
- New types:
  - `ValuationInputKind`
  - `ValuationMetricQuality`
  - `ValuationConfidence`
  - `ValuationMethodInputField`
- New APIs:
  - subjective default/override CRUD
  - objective refresh trigger/status
  - scheduler get/set
  - `computeValuationBySymbol`

## Runtime flow
1. 解析 symbol 与 method。
2. 读取 objective snapshots（按 freshness 判定 quality）。
3. 读取 subjective defaults（industry -> market -> global）。
4. 叠加 symbol overrides。
5. 执行 formula 计算 base。
6. 应用 insights effects 得 adjusted。
7. 产出 confidence/reasons/input breakdown。

## Key rules
- 观点只作用于算子链路，不直接改写输入定义。
- 缺失策略：objective 缺失优先回退 subjective；仍缺失则 not_applicable。
- 兼容：老接口保留，返回新结果子集。
