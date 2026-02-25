# Roadmap - mac-topbar-sidebar-collapse-merge

## Goal
- 在 macOS 上融合原生标题栏与应用顶栏，移除重复顶栏视觉。
- 将导航折叠入口上移到最上层顶栏左侧，移除侧栏内三角按钮。

## Scope
- Electron 主窗口参数（macOS）
- 前端 App 顶栏布局与拖拽行为
- Dashboard 侧栏折叠状态链路（改为 App 可控）

## Non-goals
- 不改 Windows/Linux 标题栏行为
- 不把 TopToolbar 业务栏并入最上层顶栏
- 不引入新视觉体系（沿用现有 token/样式）

## Milestones
1. 建立可控的导航折叠状态与 activeView 回传链路。
2. 将侧栏折叠按钮从 SidebarNav 移除，并在 App 顶栏左侧接入。
3. macOS 启用隐藏内嵌标题栏，完成拖拽区/no-drag 规则。
4. 完成 typecheck 与手工验收记录。

## Rollback
- 若 macOS 融合标题栏出现异常，可临时回退 `titleBarStyle` 变更并保留顶部折叠入口。
