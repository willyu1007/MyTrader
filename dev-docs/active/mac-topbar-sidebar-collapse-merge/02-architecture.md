# 02 Architecture

## Context & current state
- Electron 主窗口当前未配置 macOS 融合标题栏。
- App 顶栏与 Dashboard 侧栏折叠状态分离，折叠入口在 SidebarNav 内。

## Proposed design

### Components / modules
- `apps/backend/src/main/createMainWindow.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/styles.css`
- `apps/frontend/src/components/dashboard/types.ts`
- `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
- `apps/frontend/src/components/dashboard/hooks/use-dashboard-ui.ts`
- `apps/frontend/src/components/dashboard/views/SidebarNav.tsx`
- `apps/frontend/src/components/dashboard/views/DashboardContainerLayout.tsx`

### Interfaces & contracts
- `DashboardProps` 扩展：
  - `navCollapsed?: boolean`
  - `onNavCollapsedChange?: (collapsed: boolean) => void`
  - `onActiveViewChange?: (view: WorkspaceView) => void`
- `useDashboardUi(options?)`：
  - 支持受控 `isNavCollapsed` + 变更回调
  - 外部 `setIsNavCollapsed` 在 market 视图下拦截展开

### Boundaries & dependency rules
- App 负责最上层视觉与全局折叠入口。
- Dashboard 负责视图逻辑与 market 自动收起规则。
- SidebarNav 只负责导航项展示，不再负责折叠控制入口。

## Data migration (if applicable)
- 无数据迁移。

## Non-functional considerations
- Security/auth/permissions: 无新增权限。
- Performance: 仅 UI 状态链路调整，影响可忽略。
- Observability: 通过 typecheck 与手工 smoke 验证行为。

## Open questions
- 无（用户偏好已锁定）。
