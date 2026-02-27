# Roadmap

## Objective
- 将“估值方法”从展示/轻量调参升级为主客观参数驱动的完整估值系统。
- 股票/ETF 首发全面方法包，其他资产沿用现有模板。
- 估值主入口放在标的详情，方法 Tab 聚焦方法与输入定义管理。

## Milestones
1. Phase 0 - 任务包与基线
   - 完成 dev-docs 任务包与现状基线快照。
2. Phase 1 - 契约与存储
   - shared IPC 扩展（主客观/刷新/调度/计算）。
   - business schema 扩展新表与字段，兼容老接口。
3. Phase 2 - 数据侧扩展
   - market cache `daily_basics` 扩列。
   - provider 与 ingest pipeline 补齐新增基础面字段。
4. Phase 3 - 估值引擎 V2
   - 主客观输入融合、缺失降级、置信度分级、结果明细输出。
5. Phase 4 - 方法库扩展
   - 股票方法包（PE/PB/PS/PEG/EV 系/DDM/FCFF）落地 builtin seeds。
6. Phase 5 - 刷新任务与调度
   - 独立估值参数刷新任务 + scheduler 配置/状态查询。
7. Phase 6 - 前端改造与验收
   - 方法 Tab 输入定义视图。
   - 标的详情主入口（方法选择+主观覆盖编辑+置信度）。
   - 全量 typecheck/build/验证脚本回归。

## Scope and impact
- Shared: `packages/shared/src/ipc.ts`
- Backend:
  - `apps/backend/src/main/storage/businessSchema.ts`
  - `apps/backend/src/main/market/*`（cache/provider/ingest/scheduler）
  - `apps/backend/src/main/services/insightService.ts`
  - `apps/backend/src/main/ipc/registerIpcHandlers.ts`
  - `apps/backend/src/preload/index.ts`
- Frontend:
  - `apps/frontend/src/components/dashboard/views/other/OtherValuationMethodsTab.tsx`
  - `apps/frontend/src/components/dashboard/views/market/MarketDetailWorkspace.tsx`
  - `apps/frontend/src/components/dashboard/views/InsightsView.tsx`

## Rollback strategy
1. 保留 schema 增量，不做 destructive 回滚。
2. 通过前端入口回退到旧 `previewValuationBySymbol` 展示路径。
3. 估值刷新 scheduler 可关闭（配置开关），不影响主行情 ingest。
