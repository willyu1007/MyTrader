# 02 Architecture

## Context & current state
- 当前 `Dashboard.tsx` 同时承担编排、状态、副作用、视图渲染、UI 原语、工具函数，边界不清。
- 需在保持 UI/行为不变的前提下降低耦合。
- `App.tsx` 依赖 `./components/Dashboard`，该导入路径必须保持稳定。

## Proposed design

### Components / modules
- `components/Dashboard.tsx`: 兼容入口壳（仅导出）。
- `components/dashboard/DashboardContainer.tsx`: 页面编排容器。
- `components/dashboard/primitives/*`: 通用 UI 原语。
- `components/dashboard/components/*`: 业务展示组件（ledger/chart/card）。
- `components/dashboard/utils/*`: 纯函数与格式化工具。
- `components/dashboard/hooks/*`: 领域状态与副作用。
- `components/dashboard/views/*`: 视图层。

### Interfaces & contracts
- API endpoints:
  - 无新增后端接口。
- Data models / schemas:
  - 复用 `@mytrader/shared` 现有类型。
  - 新增前端内部类型聚合文件 `dashboard/types.ts`。
- Events / jobs (if any):
  - 无。

### Boundaries & dependency rules
- Allowed dependencies:
  - `views` -> `components/primitives/hooks/utils/types/constants`
  - `hooks` -> `utils/types/constants` + `window.mytrader`
  - `components` -> `primitives/utils/types`
- Forbidden dependencies:
  - `primitives` 不依赖具体业务 hook。
  - `utils` 不依赖 React 运行时（保持纯函数）。

## Data migration (if applicable)
- Migration steps:
  - 无数据库迁移。
- Backward compatibility strategy:
  - 维持 `components/Dashboard.tsx` 导入路径与导出名称不变。
- Rollout plan:
  - 分阶段落地，每阶段可独立回滚。

## Non-functional considerations
- Security/auth/permissions:
  - 不触达鉴权与权限逻辑。
- Performance:
  - 拆分不改变核心算法；避免引入额外重渲染。
- Observability (logs/metrics/traces):
  - 维持现有 console/error 行为，不新增埋点。

## Open questions
- 无（用户已确认关键取舍）。
