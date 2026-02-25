# 04 Verification

## Automated checks
- `pnpm typecheck`
  - Expected: pass, no new TypeScript errors.
- `pnpm build`
  - Expected: pass, dashboard market view compiles without runtime bundle errors.

## Manual smoke checks
- [ ] 打开 `市场行情` 页面，顶部可见单层分类 tab（无一级分类入口）。
- [ ] 逐个切换 tab（股票/ETF/指数/期货/现货/自选），列表结果与预设分类一致。
- [ ] 在任意 tab 下切换 `marketScope`（持仓/标签/搜索）后，列表与详情不崩溃且语义清晰。
- [ ] 在筛选弹层设置 market/assetClass/kind 后，结果符合预期且可重置。
- [ ] `自选` tab 能稳定进入 watchlist 语义（或给出清晰空状态）。
- [ ] 选中 symbol 后右侧详情图表可加载，切 tab 后不会残留脏状态。
- [ ] 当 tab 数据不足时，页面显示可解释空状态，不出现误导文案。

## Rollout / Backout (if applicable)
- Rollout:
  - 先在本地完成 smoke，确认无回归后合并。
- Backout:
  - 若出现关键回归，回退 Market 顶部 tab 渲染与 tab-preset 绑定，恢复原过滤入口。
