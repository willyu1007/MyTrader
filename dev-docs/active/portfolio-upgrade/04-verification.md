# 04 Verification

> 璁板綍姣忎竴娆￠獙璇佸懡浠や笌缁撴灉锛坅ppend-only锛夈€?
- 2026-01-14锛歚pnpm typecheck`锛堥€氳繃锛?- 2026-01-14锛歚pnpm typecheck`锛堥€氳繃锛宐aseline backfill gate锛?- 2026-01-15锛歚pnpm -C apps/backend verify:position-engine`锛堥€氳繃锛?00 娆′贡搴忓洖鏀句竴鑷达級
- 2026-01-15锛歚pnpm typecheck`锛堥€氳繃锛?- 2026-01-15锛歚pnpm typecheck`锛堥€氳繃锛屾敹鐩婂彛寰?v0锛?- 2026-01-15锛歚pnpm typecheck`锛堥€氳繃锛屾敹鐩?UI锛?- 2026-01-15锛歚pnpm typecheck`锛堥€氳繃锛屾敹鐩婃洸绾夸笌鍖洪棿閫夋嫨锛?- 2026-01-15锛歚pnpm typecheck`锛堥€氳繃锛屾敹鐩婃洸绾夸笌鍖洪棿閫夋嫨鍐掔儫锛?- 2026-01-15锛歚pnpm -C apps/backend build`锛堥€氳繃锛?- 2026-01-15锛歚pnpm -C apps/frontend build`锛堥€氳繃锛?
- 2026-01-15: `pnpm -C apps/backend dev` (manual smoke) -> failed: missing `@mytrader/shared` dist; dev script expects built shared package
- 2026-01-15: `pnpm -C packages/shared build` (prep for manual smoke)
- 2026-01-15: `pnpm -C apps/backend dev` (manual smoke) -> Vite dev server ready, backend build ok; harness timeout prevented UI checks; terminated stale dev server on port 5173
- 2026-01-15: cleanup removed `packages/shared/dist` and `apps/backend/dist`


- 2026-01-15: `pnpm typecheck`（通过，数据质量 DoD + sequence 校验）
- 2026-01-15: `pnpm typecheck`（失败：CorporateActionMeta 类型不兼容/未使用变量）
- 2026-01-15: `pnpm typecheck`（通过，公司行为 meta + 拆股/合股）
