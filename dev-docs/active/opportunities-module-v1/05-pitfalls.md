# 05 Pitfalls

## Do-not-repeat summary
- 机会信号生命周期测试不要使用“固定历史 as-of 日期”作为未过期样本。

## 2026-03-02 - 固定历史日期导致 pinned 生命周期断言失败
- Symptom:
  - `verify:opportunities-e2e` 中断言 “pinned 信号仍保持 active” 失败。
- Root cause:
  - 测试使用了固定历史日期（2026-01-26）作为 run as-of，执行时系统当前日期已超过 `as_of + 7d`，信号天然处于过期窗口。
- What was tried:
  - 先检查 `pinOpportunitySignal` 与 `refreshSignalLifecycle` 逻辑，确认代码路径正确。
- Fix/workaround:
  - 将 e2e 测试数据改为“相对当前日期”生成（`today` 与 `today-1d`），避免与真实执行日脱钩。
- Prevention:
  - 所有涉及 TTL/过期窗口的验证用例优先使用“相对当前时间”构造，避免固定日期在未来失效。
