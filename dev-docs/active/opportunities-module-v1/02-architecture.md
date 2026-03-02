# 02 Architecture

## Boundaries
- Shared: `packages/shared/src/ipc.ts` 增加 opportunities 类型与 API。
- Backend:
  - schema: `apps/backend/src/main/storage/businessSchema.ts`
  - service: `apps/backend/src/main/services/opportunityService.ts`
  - scheduler: `apps/backend/src/main/market/opportunityScheduler.ts`
  - IPC: `apps/backend/src/main/ipc/registerIpcHandlers.ts`
  - preload: `apps/backend/src/preload/index.ts`
- Frontend:
  - dashboard state/constants/types/layout
  - `apps/frontend/src/components/dashboard/views/OpportunitiesView.tsx`

## Data flow
1. 自动识别读取 scope（Targets 全开或降级范围）并计算模板因子。
2. 评分公式计算总分，按主键 upsert 到 `opportunity_signals`。
3. 机会列表消费 `opportunity_signals` 并处理 pin/dismiss/restore。
4. 排序和比对基于最新市场数据 + signals 结果实时计算并缓存 run 记录。
5. 自由比对草稿写入 `market_settings`，命名快照写入独立表。
