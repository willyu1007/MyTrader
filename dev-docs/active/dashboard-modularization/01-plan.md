# 01 Plan

## Milestones
1. 建立 docs + 基线验证记录。
2. 落地兼容入口与 `DashboardContainer`。
3. 抽离 `primitives/components/utils`。
4. 抽离 `hooks/views` 并完成容器编排。
5. 完整回归验证与 handoff 文档更新。

## Detailed steps
- 创建 `dev-docs/active/dashboard-modularization/` 全套文档并记录 baseline。
- 新增 `apps/frontend/src/components/dashboard/` 目录。
- 将现有 Dashboard 主实现迁移到 `dashboard/DashboardContainer.tsx`。
- 将 `apps/frontend/src/components/Dashboard.tsx` 改为兼容导出壳（保持 `App.tsx` 导入不变）。
- 迁移底部 UI 原语到 `dashboard/primitives/`，并在容器文件替换本地定义为 import。
- 迁移展示组件到 `dashboard/components/`（图表、卡片、ledger 相关）。
- 迁移纯工具函数到 `dashboard/utils/`，并接线。
- 提取领域 hooks：`use-dashboard-ui/portfolio/market/analysis`。
- 提取视图层：`views/` 与 `views/portfolio/`。
- 执行 `typecheck/build/verify:theme`，并补齐 `03/04/05` 文档。

## Risks & mitigations
- Risk: 抽离 hooks 时依赖数组变化导致行为回归。
  - Mitigation: 逐域迁移，保持 effect 依赖表达式不变并做逐阶段 smoke。
- Risk: 市场模块体量过大导致拆分冲突。
  - Mitigation: 先抽纯组件与工具，再做视图拆分，避免一次性改动过大。
- Risk: 原语拆分引入主题契约回流。
  - Mitigation: 每阶段跑 `verify:theme`，及时回退违规改动。
