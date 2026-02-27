# 05-pitfalls

## do-not-repeat
- `toFiniteNumber(null)` 不能返回 `0`：会把“缺失值”误判为有效输入，导致估值结果异常（例如目标倍数被隐式置 0）。
- `daily_basics` 扩列后，ingest tuple 类型必须同步更新；否则 wave2 写入会在 typecheck 阶段失败。
- stock 方法 input schema 不能共用单一 `target.multiple` 抽象字段；必须显式映射公式实际参数（如 `targetPe/targetPb/...`），否则主观覆盖不会生效到真实计算参数。
- backend build 配置需要保持语法完整（`tsup.config.ts` 误写多余 `)` 会直接阻断 verify 链路）。
