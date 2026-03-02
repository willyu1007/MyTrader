# 04 Verification

## Automated checks
- `pnpm typecheck`
  - Result: PASS
  - Notes: shared/backend/frontend typecheck 全通过，`apps/frontend verify:theme` 通过。
- `pnpm build`
  - Result: PASS
  - Notes: shared/frontend/backend 均成功构建。
- `pnpm typecheck`（触发器 A 补齐后复验）
  - Result: PASS
- 机会模块链路测试（手工/脚本混合）：
  - Result: PASS
  - 覆盖项：规则运行、信号生命周期、排序、多标的比对、自由比对草稿与快照上限、触发策略 A/B。
  - 后处理：已删除测试产物（verify 脚本与接线）。

## Manual checks
- 待产品侧手工验收（UI 流程与交互文案）：
  - 机会列表筛选与状态流转
  - 自动识别规则编辑/试跑/日志可读性
  - 自由比对 6+1 布局与详情窗口联动体验
