# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 顶栏设置 `drag` 后，必须给交互元素显式设置 `no-drag`，否则点击会被拖拽吞掉。
- `BrowserWindow` 标题栏参数变更后必须重建窗口（通常需要重启 Electron 主进程），否则会误判“样式未生效”。

## Pitfall log (append-only)

### 2026-02-25 - 标题栏参数修改后界面看起来未生效
- Symptom:
  - 仍看到“原生标题栏 + 自绘顶栏”双层结构。
- Context:
  - 已修改 `createMainWindow.ts` 的 macOS `titleBarStyle` 配置。
- What we tried:
  - 检查源码与 `dist/main.js`，确认配置已写入构建产物。
- Why it failed (or current hypothesis):
  - 旧窗口进程未重建，仍在使用旧的 `BrowserWindow` 创建参数。
- Fix / workaround (if any):
  - 完整重启 My-Trader 进程后再验证。
- Prevention (how to avoid repeating it):
  - 涉及 `BrowserWindow` 构造参数改动时，验证步骤必须包含“重启主进程/重建窗口”。
- References (paths/commands/log keywords):
  - `apps/backend/src/main/createMainWindow.ts`
  - `pnpm -C apps/backend build`
  - `rg -n "titleBarStyle" apps/backend/dist/main.js`

### 2026-02-25 - 误删 `OtherViewProps` 的 `setOtherTab` 类型字段导致前端 typecheck 失败
- Symptom:
  - `pnpm -C apps/frontend typecheck` 报错：`OtherDataManagementIngestSection.tsx` 中 `setOtherTab` 不满足 `Pick<OtherViewProps, ...>` 约束，且推断为 `unknown`。
- Context:
  - 为“全局 tab 统一”清理 `OtherView` props 时移除了 `setOtherTab` 字段。
- What we tried:
  - 先仅移除 `OtherView` 内部 tab UI 与相关本地逻辑。
  - 再继续删除类型字段与上层传参。
- Why it failed (or current hypothesis):
  - `OtherDataManagementIngestSection` 仍通过 `Pick<OtherViewProps, "setOtherTab" | ...>` 复用该字段（用于“查看记录”跳转到 `data-status`）。
- Fix / workaround (if any):
  - 保留 `OtherViewExternalProps.setOtherTab`，并在 `DashboardContainerLayout -> OtherView` 继续传递；仅移除内部 tab 可视 UI，不移除跨子模块跳转依赖。
- Prevention (how to avoid repeating it):
  - 清理顶层 props 前，先全局搜索 `Pick<OtherViewProps, ...>` / `keyof` 依赖点，确认类型别名是否被下游子模块复用。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/views/OtherView.tsx`
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementIngestSection.tsx`
  - `pnpm -C apps/frontend typecheck`
