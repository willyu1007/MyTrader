# 01 Plan

## Milestones
1. 完成导航折叠状态外提到 App 的类型与数据流改造。
2. 完成 App 顶栏重构（左侧折叠入口 + 中间标题 + 右侧现有控件）。
3. 完成 macOS 标题栏融合参数与拖拽规则。
4. 完成验证与文档收敛。

## Detailed steps
- 更新 `DashboardProps`，增加 `navCollapsed` / `onNavCollapsedChange` / `onActiveViewChange`。
- 调整 `useDashboardUi` 支持受控/非受控折叠状态，并在 market 视图拦截展开。
- 调整 `DashboardContainer` 与 `DashboardContainerLayout` 透传受控状态。
- 删除 `SidebarNav` 内部折叠按钮与 `onToggleCollapse` 回调。
- 重构 `App.tsx` 顶栏结构并接入顶部折叠控制。
- 在 `styles.css` 新增/调整 topbar 拖拽区与 no-drag 规则。
- 在 `createMainWindow.ts` 仅对 darwin 设置 `titleBarStyle: "hidden"`。

## Risks & mitigations
- Risk: 顶栏 `drag` 影响按钮点击。
  - Mitigation: 所有可交互元素显式设置 `-webkit-app-region: no-drag`。
- Risk: market 自动收起与手动切换冲突。
  - Mitigation: 在状态 setter 中统一拦截，market 下禁止展开。
