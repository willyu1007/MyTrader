# 03 Implementation Notes

## 2026-03-02
- 创建任务包 `opportunities-module-v1`。
- 锁定实现路径：先 contract/schema，再 backend service/scheduler，最后 frontend 5-tab。
- Shared contract:
  - 在 `packages/shared/src/ipc.ts` 新增 opportunities 全量类型（signals/rules/runs/ranking/multi-compare/free-compare）与 IPC channel。
  - 在 `apps/backend/src/preload/index.ts` 接通 `window.mytrader.opportunities` 全部方法。
- Backend:
  - 新增 `apps/backend/src/main/storage/businessSchema.ts` v14 migration，落地 8 张机会模块表与关键索引/约束。
  - 新增 `apps/backend/src/main/services/opportunityService.ts`（规则引擎、信号生命周期、排序、多标的比对、自由比对草稿/快照、触发策略）。
  - 新增 `apps/backend/src/main/market/opportunityScheduler.ts`，实现日频兜底触发（20:30 Asia/Shanghai）。
  - 在 `apps/backend/src/main/ipc/registerIpcHandlers.ts` 注册全部 opportunities IPC handler，并在价格更新入口（CSV/Tushare/测试注入/demo seed）触发 data_update 识别。
  - 在账号 unlock/lock 生命周期接入机会调度器 start/stop。
- Frontend:
  - Dashboard 增加 opportunities 子 tab 状态：`signals/rules/ranking/multi-compare/free-compare`。
  - 新增 `apps/frontend/src/components/dashboard/views/OpportunitiesView.tsx` 并替换 placeholder，落地 5 tab 首版交互：
    - 机会列表：筛选 + 置顶/忽略/恢复。
    - 自动识别：规则 CRUD、启停、手动试跑、运行日志。
    - 标的排序：profile 维护、运行、读取最新结果、总分+因子拆解。
    - 多标的比对：5+1 限制、空基线自动临时基线。
    - 自由比对：6+1 布局、窗口独立配置、详情窗口联动、草稿自动保存（800ms）+命名快照（上限 50）。
- Verify tooling:
  - 使用链路测试完成机会模块回归验证（typecheck/build + 机会模块核心流程跑通）。
  - 按要求删除测试产物：移除 `verifyOpportunitiesE2E.ts`、`tsup` entry、`package` 脚本接线。
- 触发器 A（ingest orchestrator 直连）补齐：
  - 在 `apps/backend/src/main/market/ingestOrchestrator.ts` 引入机会触发服务。
  - managed ingest job 完成后读取 `ingest_runs` 结果（`status/as_of_trade_date/inserted/updated`）。
  - 仅当 run 成功或部分成功，且 `inserted + updated > 0` 时触发 `triggerOpportunityRulesOnDataUpdate`。
  - 触发失败仅记录日志，不影响 ingest 主流程。
