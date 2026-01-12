# 04 Verification

## Automated checks
- `pnpm typecheck` -> expect exit 0 once scaffolding and TS config are in place
- `pnpm test` -> expect exit 0 once unit tests are added

## Runs (recorded)
- 2026-01-12: `pnpm typecheck` -> exit 0
- 2026-01-12: `pnpm build` -> exit 0
- 2026-01-12: `pnpm typecheck && pnpm build` -> exit 0 (登录 UI/目录选择交互调整)
- 2026-01-12: `pnpm typecheck && pnpm build` -> exit 0 (主题样式与全中文文案)
- 2026-01-12: `pnpm typecheck && pnpm build` -> exit 0（目录选择修复 + 跟随系统主题）
- 2026-01-12: `pnpm start` -> 可正常拉起 Electron（手动退出）
- 2026-01-12: `pnpm typecheck` -> exit 0（登录页重构 + `window.mytrader` 缺失降级）
- 2026-01-12: `pnpm build` -> exit 0（登录页重构 + `window.mytrader` 缺失降级）
- 2026-01-12: `pnpm typecheck` -> exit 0（目录选择弹窗聚焦增强 + 前端交互提示优化）
- 2026-01-12: `pnpm build` -> exit 0（目录选择弹窗聚焦增强 + 前端交互提示优化）
- 2026-01-12: `pnpm typecheck` -> exit 0（顶部栏品牌标识样式对齐）
- 2026-01-12: `pnpm build` -> exit 0（顶部栏品牌标识样式对齐）
- 2026-01-12: `pnpm typecheck` -> exit 0（目录选择 IPC 增加 dev 日志）
- 2026-01-12: `pnpm build` -> exit 0（目录选择 IPC 增加 dev 日志）
- 2026-01-13: `pnpm -C apps/backend start` -> preload 注入日志出现（验证 preload 已加载）
- 2026-01-13: `pnpm typecheck && pnpm build` -> exit 0（preload 打包 `@mytrader/shared` 修复注入）
- 2026-01-13: `pnpm typecheck && pnpm build` -> exit 0（登录页样式对齐 + 新增 `ui_login.md` 规范）
- 2026-01-13: `pnpm typecheck && pnpm build` -> exit 0（登录页排版/字体比例优化）

## Manual smoke checks
- Create account -> expect new data directory and DB files created
- Lock/unlock -> expect account data inaccessible while locked
- Switch account -> expect previous account DBs closed and data isolated
- Add portfolio/position -> expect exposure and limit warnings to appear
- Ingest market data + CSV import -> expect valuations updated with timestamps
- Create opinion -> expect tag + search to return results
- Run backtest -> expect metrics and curves saved and reloadable

## Rollout / Backout (if applicable)
- Rollout: local desktop app update only; no server deploy
- Backout: remove account data directories and shared cache if corruption occurs
