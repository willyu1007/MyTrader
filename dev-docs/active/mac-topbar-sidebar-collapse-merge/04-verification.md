# 04 Verification

## Automated checks
- [x] `pnpm -C apps/frontend typecheck` (baseline before changes): pass
- [x] `pnpm -C apps/backend typecheck` (baseline before changes): pass
- [x] `pnpm -C apps/frontend typecheck` (after implementation): pass
- [x] `pnpm -C apps/backend typecheck` (after implementation): pass
- [x] `pnpm -C apps/backend build` (after `titleBarStyle` update): pass
- [x] `pnpm -C apps/frontend typecheck` (after topbar compact + icon restyle): pass
- [x] `pnpm -C apps/frontend typecheck` (after removing collapse/theme outer frames + nav label): pass
- [x] `pnpm -C apps/frontend typecheck` (after collapse icon simplified to frame + short line): pass
- [x] `pnpm typecheck` (workspace level): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm -C apps/frontend typecheck` (after adding topbar divider + global tab unification): pass
- [x] `pnpm typecheck` (after adding topbar divider + global tab unification): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm -C apps/frontend typecheck` (after merging toolbar title row + global tabs into a single row): pass
- [x] `pnpm typecheck` (after merging toolbar title row + global tabs into a single row): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm -C apps/frontend typecheck` (after moving topbar theme/portfolio/account into settings + topbar portal tabs): pass
- [x] `pnpm typecheck` (after moving topbar theme/portfolio/account into settings + topbar portal tabs): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm -C apps/backend typecheck` (after trafficLightPosition + topbar alignment tweaks): pass
- [x] `pnpm -C apps/frontend typecheck` (after compact settings + topbar left shift + remove settings divider): pass
- [x] `pnpm typecheck` (after compact settings + topbar left shift + remove settings divider): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm -C apps/frontend typecheck` (after removing button outlines + data-management top dashboard card shell): pass
- [x] `pnpm typecheck` (after removing button outlines + data-management top dashboard card shell): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm -C apps/backend typecheck` (after trafficLightPosition y adjustment): pass
- [x] `pnpm -C apps/frontend typecheck` (after dashboard separators + unified fallback tab logic): pass
- [x] `pnpm typecheck` (after dashboard separators + unified fallback tab logic): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm -C apps/backend typecheck` (after trafficLightPosition y=1): pass
- [x] `pnpm -C apps/frontend typecheck` (after dashboard typography + top spacing + side borders tweaks): pass
- [x] `pnpm typecheck` (after dashboard typography + top spacing + side borders tweaks): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`
- [x] `pnpm typecheck` (after trafficLightPosition y=7 + topbar height/alignment tweak): pass
  - includes `packages/shared build`
  - includes `apps/frontend verify:theme`
  - output: `[verify-theme-contract] OK`

## Manual smoke checks
- 待执行（当前会话未拉起 GUI 进行手工验证）：
  - 先完整重启 Electron 主进程（`BrowserWindow` 参数改动不会被 renderer 热更新带上）
  - macOS 顶栏融合视觉（traffic lights + 顶栏安全区）
  - 顶部折叠按钮行为（含 market 禁用）
  - 侧栏三角入口移除且导航点击行为不变

## Rollout / Backout (if applicable)
- Rollout: 直接随前端/后端代码发布。
- Backout: 回退本任务涉及的 8 个业务文件改动。
