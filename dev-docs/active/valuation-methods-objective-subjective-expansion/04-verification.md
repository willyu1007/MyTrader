# 04-verification

## Automated checks
- `pnpm -C packages/shared build` -> pass
- `pnpm -C apps/frontend typecheck` -> pass
- `pnpm -C apps/backend typecheck` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm -C apps/backend verify:insights-e2e` -> pass
  - 覆盖新增断言：
    - `VALUATION_COMPUTE_BY_SYMBOL` 可用
    - 主观默认与 symbol override 优先级正确
    - objective refresh 可触发并可按 runId 查询状态
    - objective snapshots 包含新增基础面指标
    - 默认方法路由正确（`stock -> builtin.stock.pe.relative.v1`，`etf -> builtin.etf.pe.relative.v1`）
    - 旧 `previewValuationBySymbol` 与新计算接口结果兼容
    - 期货/现货/外汇/债券新增方法可被调用并产出估值结果

## Manual checks
- 待联调（桌面端）：
  - `OtherValuationMethodsTab` 输入定义分组展示与默认值编辑
  - `MarketDetailWorkspace` 主观覆盖保存/清除 + 置信度/降级原因展示
  - `MarketDetailWorkspace` 方法下拉按 `stock/etf` 自动过滤是否符合预期
  - `OtherValuationMethodsTab` 中新增域方法（期货/现货/外汇/债券）展示是否完整
  - 客观参数质量统计（fresh/stale/fallback/missing）展示准确性
