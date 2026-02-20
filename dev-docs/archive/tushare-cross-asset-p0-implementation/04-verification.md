# 04 Verification

## Automated checks
- `pnpm typecheck` -> expect exit 0
- `pnpm build` -> expect exit 0
- `pnpm -C apps/backend typecheck` -> expect exit 0
- `pnpm -C apps/frontend typecheck` -> expect exit 0

## P0 gate checks (required)
- [ ] P0 资产全量 + 增量 run 各至少 1 次成功
- [ ] 最近 3 个交易日无阻断错误 run
- [ ] P0 覆盖率 `complete + partial >= 95%`
- [ ] 关键字段空值率 <= 0.5%
- [ ] 主键冲突 = 0
- [ ] 手动/定时/启动补跑/暂停恢复取消回归通过

## Manual checks
- [ ] Stock + ETF 主链路可查询并可解释缺口
- [ ] Index 上下文可供给成员/权重/背景数据
- [ ] Futures + Spot（SGE）日线链路稳定
- [ ] run 详情中的错误摘要可读且不泄露 token

## Runs (recorded)
- 2026-02-20: 初始化任务文档（尚未执行代码级验证）
