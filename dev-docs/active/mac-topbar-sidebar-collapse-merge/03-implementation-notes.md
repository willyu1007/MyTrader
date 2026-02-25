# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-02-25

## What changed
- 完成主进程 macOS 融合标题栏参数：`titleBarStyle: "hidden"`（仅 darwin，较 `hiddenInset` 更强制）。
- 完成 App 顶栏结构重构：
  - 去除 Logo 图标与搜索图标
  - 保留居中 `MyTrader` 标题
  - 左侧新增导航折叠按钮（仅解锁后展示）
  - 右侧沿用主题切换/组合/账号信息
- 按产品反馈细化顶栏视觉：
  - 折叠按钮图标替换为“面板轮廓 + 分隔线 + 箭头”样式（贴近参考图）
  - 折叠按钮图标进一步简化为“外框 + 一条短线”
  - 顶栏与控件高度整体压缩，目标接近信号灯高度（更紧凑）
  - 去掉折叠按钮外框（仅保留图标本体）
  - 去掉主题选择容器外框（仅保留分段按钮）
  - 在“主题切换”与“组合”之间新增短分隔线
- 去掉侧栏顶部“导航”文案
- 顶栏补充拖拽规则：容器 `drag`，控件 `no-drag`。
- 完成 Dashboard 折叠状态“受控化”：
  - `DashboardProps` 新增 `navCollapsed` / `onNavCollapsedChange` / `onActiveViewChange`
  - `useDashboardUi` 支持受控/非受控双模式
  - 保留 market 自动收起，并在外部展开请求时拦截
- 移除 SidebarNav 内的收起/展开三角按钮，折叠入口统一上移到顶栏。
- 顶部 tab 入口改为全局统一（纯文案、无图标）：
  - `DashboardContainerLayout` 统一渲染 `投资组合/数据分析/其他` 对应的 tab 行（`组名 | tabs`）
  - `DataAnalysisView` 内部 tab 行移除，仅保留内容区
  - `OtherView` 内部 tab 行移除，仅保留内容区
- 将“TopToolbar 标题行”和“全局 tab 行”进一步合并为单行：
  - `TopToolbar` 支持直接渲染 `组名 | tabs`（保留账号页锁定按钮）
  - `DashboardContainerLayout` 删除独立的第二行 tab 容器
- 本轮按最新交互要求继续调整：
  - 侧栏左下角新增“设置”入口（`SidebarNav` footer）
  - 将“主题选择 / 组合 / 账号”从顶栏迁入设置弹层
  - 顶栏中间预留 `app-topbar-workspace-slot` 槽位，`DashboardContainerLayout` 通过 portal 将“模块标题 + tabs”渲染到顶栏
  - 顶栏右侧改为 `MyTrader` 文字（右对齐），不再在中间显示应用名
  - 移除 `Dashboard` 层 `onLock` 传递，锁定入口改为设置弹层中的按钮
- 根据后续视觉反馈进一步细化：
  - macOS `BrowserWindow` 增加 `trafficLightPosition`，将信号灯下移（与顶栏元素更接近同一水平）
  - 缩小 mac 顶栏左侧保留宽度，模块标题与 tab 整体向左
  - 设置弹层缩小并紧凑化，去掉弹层内“设置”标题文案，主题切换合并为单行布局
  - 设置按钮文案调整为“锁定并返回登录”
  - 去掉侧栏底部设置按钮上方横分割线
- 本轮小调整：
  - 全局按钮描边统一去除（保留 tab 选中反馈，改为 `box-shadow` 下划线）
  - 数据管理页顶部 `source supply dashboard` 从“卡片容器”改为纯 dashboard 网格（去掉外层卡片边框/壳）
- 最新一轮细化：
  - 数据管理页顶部 dashboard 增加网格分割线（`divide-x / divide-y + border-y`）并适当提高字体等级
  - 顶栏模块区统一 tab 轨道逻辑：无子 tab 的模块自动补充只读“概览”tab，保持分割线与基线稳定
  - mac 信号灯位置上调（`trafficLightPosition.y: 12 -> 8`）
- 本轮继续微调：
  - mac 信号灯位置进一步上调（`trafficLightPosition.y: 8 -> 1`）
  - 数据管理 dashboard 标题（如“行情日期”）改为更大黑色字重，内容字号下调
  - 数据管理 dashboard 顶部整体上移（`OtherView` 中 data-management tab 顶部间距 `pt-6 -> pt-2`，dashboard 局部 `-mt-1`）
  - 数据管理 dashboard 增加左右边线（`border` 而非仅 `border-y`）
- 本轮按最新反馈调整：
  - mac 信号灯垂直位置回调（`trafficLightPosition.y: 1 -> 7`）
  - 顶栏高度小幅增高并固定（`34px`），减少视觉压缩感
  - 顶栏三段容器（left/center/right）统一 `height: 100%`，确保元素垂直居中对齐

## Files/modules touched (high level)
- `apps/backend/src/main/createMainWindow.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/styles.css`
- `apps/frontend/src/components/dashboard/types.ts`
- `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
- `apps/frontend/src/components/dashboard/hooks/use-dashboard-ui.ts`
- `apps/frontend/src/components/dashboard/views/SidebarNav.tsx`
- `apps/frontend/src/components/dashboard/views/DashboardContainerLayout.tsx`
- `dev-docs/active/mac-topbar-sidebar-collapse-merge/*`

## Decisions & tradeoffs
- Decision:
  - 仅在 darwin 启用 `titleBarStyle: "hidden"`。
  - Rationale:
    - 降低跨平台回归风险，符合用户要求。
  - Alternatives considered:
    - 全平台 titleBarOverlay，同步成本更高。

## Deviations from plan
- 暂无偏离。

## Known issues / follow-ups
- 需要在 macOS 真机进行最终视觉与交互 smoke（traffic lights 与左侧安全区间距）。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
