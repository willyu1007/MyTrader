# Market Tab Classification Redesign - Roadmap

## Goal
- Replace Market's current stock-centered interaction with a single top-tab classification model (no primary/secondary nesting), so users can switch asset views as fast as the Portfolio tab pattern.

## Non-goals
- Replacing the current market data provider strategy (Tushare remains the active provider)
- Implementing realtime/minute-level feeds
- Rebuilding the ingest scheduler/target pool pipeline in this task
- Redesigning non-Market modules (Portfolio/Risk/Other)

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: Confirm the first release tab set and order. Proposed: `股票`, `ETF`, `指数`, `期货`, `现货`, `自选`.
- Q2: Should `期权` enter v1 tabs now, or defer until data coverage is stable?
- Q3: On first entry to Market, what should be the default tab when no holdings exist?

### Assumptions (if unanswered)
- A1: v1 excludes `期权` and `债券` tabs (risk: medium)
- A2: Default Market tab is `股票`; if no matching symbols, show explicit empty state without auto-jump (risk: low)
- A3: Existing manual filter modal remains available as an advanced override, but tab preset is the primary entry (risk: medium)

## Scope and impact
- Affected areas/modules:
  - Frontend: `apps/frontend/src/components/dashboard/types.ts`
  - Frontend: `apps/frontend/src/components/dashboard/constants.ts`
  - Frontend: `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
  - Frontend: `apps/frontend/src/components/dashboard/views/DashboardContainerLayout.tsx`
  - Frontend: `apps/frontend/src/components/dashboard/views/MarketView.tsx`
  - Frontend: `apps/frontend/src/components/dashboard/views/market/MarketSidebar.tsx`
  - Frontend: `apps/frontend/src/components/dashboard/views/market/MarketDialogs.tsx`
  - Frontend: `apps/frontend/src/components/dashboard/hooks/use-dashboard-market.ts`
  - Frontend: `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-derived.ts`
  - Optional backend follow-up: capability alignment for non-stock categories
- External interfaces/APIs:
  - No required IPC contract break in phase 1
  - Optional phase 2 may add category capability metadata API for better tab availability control
- Data/storage impact:
  - UI state additions only (new active market tab state)
  - Optional local storage key for persisting last selected Market tab
- Backward compatibility:
  - Existing `marketScope` (`holdings/tags/search`) remains intact
  - Existing filter modal and search behavior continue to work

## Milestones
1. **Milestone 1**: Tab model and interaction contract
   - Deliverable: single-layer Market tab taxonomy and state contract documented and implemented in frontend state
   - Acceptance criteria: Market tab state is independent from `marketScope`; no regression on existing scope switching
2. **Milestone 2**: Top-tab UI integration
   - Deliverable: Market top tab bar rendered in the same placement/style class as Portfolio tabs
   - Acceptance criteria: users can switch tabs in one click; active tab is visually obvious; keyboard/tab accessibility works
3. **Milestone 3**: Data/view binding by tab preset
   - Deliverable: each tab drives a predefined market/assetClass/kind filter preset
   - Acceptance criteria: each tab shows expected symbol subset and clear empty states; manual filters still function
4. **Milestone 4**: Validation and hardening
   - Deliverable: typecheck/build pass + manual smoke verification + rollback notes
   - Acceptance criteria: no runtime errors, no freeze in chart/list interactions, no state deadlock between tab/scope/filter

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 - Discovery and final tab contract
- Objective: finalize tab list, labels, and per-tab preset mapping.
- Deliverables:
  - final tab enum
  - preset table (market/assetClass/kind/scope defaults)
  - fallback rules for empty data scenarios
- Verification:
  - contract reviewed against current `MarketScope` and filter semantics
- Rollback:
  - N/A (planning only)

### Phase 1 - Frontend state and type model
- Objective: add explicit `MarketCategoryTab` state and constants.
- Deliverables:
  - new type definitions
  - tab constants and preset mapping
  - state wiring in container and hooks
- Verification:
  - `pnpm typecheck`
- Rollback:
  - remove new tab state/types and revert to previous filter-only path

### Phase 2 - Top tab UI and behavioral binding
- Objective: render Market top tabs and bind tab selection to preset filtering.
- Deliverables:
  - top tab row under Market header
  - tab-driven filtering behavior
  - explicit empty states per tab
- Verification:
  - `pnpm build`
  - manual switch/smoke checklist
- Rollback:
  - feature-flag or direct revert to previous sidebar-only classification

### Phase 3 - Stability pass and follow-up boundaries
- Objective: validate edge cases and document follow-up backend capability work.
- Deliverables:
  - verified test log
  - known limitations and follow-up list
  - handoff-ready dev-docs updates
- Verification:
  - repeated smoke checks on all tabs + scope transitions
- Rollback:
  - remove tab preset coupling, keep legacy filters as source of truth

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
  - `pnpm build`
- Automated tests:
  - run existing dashboard/market tests if present; no new test failures
- Manual checks:
  - switch every Market tab and verify list/detail consistency
  - verify `holdings/tags/search` scope can still be changed without broken state
  - verify filter modal reset/apply remains predictable after tab switches
  - verify chart panel still loads/updates for selected symbols
- Acceptance criteria:
  - single-layer tab model is the primary entry for category switching
  - no forced primary-level classification in UI
  - current workflows (search, watchlist/tag selection, detail view) remain usable

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Tab preset and manual filters conflict, causing confusing results | med | high | Define precedence: tab preset initializes baseline, manual filter is additive and visible | Smoke checks show mismatched counts/empty states | Revert precedence to explicit reset-on-tab-switch |
| Non-stock tabs show mostly empty data due current provider coverage | high | med | Keep explicit empty-state messaging and optionally disable unsupported tabs by capability | High empty-state rate in QA | Temporarily hide unsupported tabs |
| Coupling tab with scope accidentally breaks tags/watchlist flows | med | high | Keep `marketScope` orthogonal; only set default scope on certain tabs, never lock it | Switching tab + scope causes list mismatch | Remove auto-scope behavior |
| Top tab UI placement causes layout regression in Market workspace | low | med | Reuse Portfolio tab container patterns/classes and responsive overflow behavior | Visual regression in market page | Restore previous header block and iterate |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/<task>/
  roadmap.md              # Macro-level planning (plan-maker)
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

The roadmap document can be used as the macro-level input for the other files. The plan-maker skill does not create or update those files.

Suggested mapping:
- The roadmap's **Goal/Non-goals/Scope** -> `00-overview.md`
- The roadmap's **Milestones/Phases** -> `01-plan.md`
- The roadmap's **Architecture direction (high level)** -> `02-architecture.md`
- Decisions/deviations during execution -> `03-implementation-notes.md`
- The roadmap's **Verification** -> `04-verification.md`

## To-dos
- [ ] Confirm tab set and ordering
- [ ] Confirm precedence between tab presets and manual filters
- [ ] Confirm v1 support policy for low-coverage categories
- [ ] Confirm rollout and rollback strategy for Market UX migration
