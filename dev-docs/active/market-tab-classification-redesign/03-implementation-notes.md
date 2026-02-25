# 03 Implementation Notes

## Status
- Current status: planned
- Last updated: 2026-02-25

## What changed
- 2026-02-25: 创建任务包 `dev-docs/active/market-tab-classification-redesign/`。
- 2026-02-25: 方案方向已锁定为“单层顶部 Tab 穷举分类”，不引入一级分类入口。
- 2026-02-25: 记录并约束核心原则：`tab` 表示资产分类，`marketScope` 表示数据来源，二者保持正交。

## Files/modules touched (high level)
- `dev-docs/active/market-tab-classification-redesign/roadmap.md`
- `dev-docs/active/market-tab-classification-redesign/00-overview.md`
- `dev-docs/active/market-tab-classification-redesign/01-plan.md`
- `dev-docs/active/market-tab-classification-redesign/02-architecture.md`
- `dev-docs/active/market-tab-classification-redesign/03-implementation-notes.md`
- `dev-docs/active/market-tab-classification-redesign/04-verification.md`
- `dev-docs/active/market-tab-classification-redesign/05-pitfalls.md`

## Decisions & tradeoffs
- Decision: 取消一级分类，仅保留单层顶部分类 Tab。
  - Rationale: 用户操作路径更短，认知负担更低，且更接近现有“投资组合”交互习惯。
  - Alternatives considered: 一级+二级双层分类。
- Decision: 保留 `marketScope` 的来源语义，不被 tab 替代。
  - Rationale: 避免破坏现有持仓/标签/搜索流程，降低回归风险。
  - Alternatives considered: 用 tab 直接吞并 scope 语义。
- Decision: v1 以前端状态和过滤逻辑改造为主，不强依赖后端 schema/API 变更。
  - Rationale: 可快速落地并验证用户体验。
  - Alternatives considered: 同步做后端能力矩阵与 schema 扩展。

## Deviations from plan
- none yet

## Known issues / follow-ups
- 待确认 v1 tab 列表最终版本（是否包含 `期权`）。
- 待确认 tab 切换时是否保留手动筛选状态。
- 如非股票类数据覆盖不足，需制定 tab disable/beta 显示策略。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
