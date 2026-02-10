import type { Dispatch, SetStateAction } from "react";

import type {
  LedgerEntry,
  MarketDataQuality,
  Portfolio,
  PortfolioSnapshot,
  UniversePoolBucketId
} from "@mytrader/shared";

import type {
  LedgerFilter,
  LedgerFormState,
  MarketChartRangeKey,
  MarketFilterMarket,
  MarketScope,
  OtherTab,
  PositionFormState,
  RiskFormState,
  TargetPoolStatsScope,
  TargetPoolStructureStats,
  WorkspaceView
} from "../types";
import { OtherDataManagementTab } from "./other/OtherDataManagementTab";
import { OtherDataStatusTab } from "./other/OtherDataStatusTab";
import { OtherInstrumentManagementTab } from "./other/OtherInstrumentManagementTab";
import { OtherTestTab } from "./other/OtherTestTab";

type DashboardMarketState = ReturnType<
  typeof import("../hooks/use-dashboard-market").useDashboardMarket<
    MarketScope,
    MarketFilterMarket,
    MarketChartRangeKey,
    TargetPoolStatsScope,
    TargetPoolStructureStats
  >
>;
type DashboardPortfolioState =
  import("../hooks/use-dashboard-portfolio").UseDashboardPortfolioResult<
    PositionFormState,
    RiskFormState,
    LedgerFormState,
    LedgerEntry,
    LedgerFilter
  >;
type DashboardMarketAdminDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-admin-derived").useDashboardMarketAdminDerived<TargetPoolStatsScope>
>;
type DashboardMarketTargetPoolDetail = ReturnType<
  typeof import("../hooks/use-dashboard-market-target-pool-detail").useDashboardMarketTargetPoolDetail
>;
type DashboardMarketOrchestration = ReturnType<
  typeof import("../hooks/use-dashboard-market-orchestration").useDashboardMarketOrchestration
>;
type DashboardLedgerActions = ReturnType<
  typeof import("../hooks/use-dashboard-ledger-actions").useDashboardLedgerActions
>;
type DashboardMarketResizeResult = ReturnType<
  typeof import("../hooks/use-dashboard-market-resize").useDashboardMarketResize
>;

interface OtherTabOption {
  key: OtherTab;
  label: string;
}

interface OtherViewExternalProps {
  Button: typeof import("../shared").Button;
  FormGroup: typeof import("../shared").FormGroup;
  HelpHint: typeof import("../shared").HelpHint;
  Input: typeof import("../shared").Input;
  Modal: typeof import("../shared").Modal;
  Panel: typeof import("../shared").Panel;
  PopoverSelect: typeof import("../shared").PopoverSelect;
  UNIVERSE_POOL_BUCKET_ORDER: ReadonlyArray<UniversePoolBucketId>;
  activePortfolio: Portfolio | null;
  dataQuality: MarketDataQuality | null;
  formatCnDate: typeof import("../shared").formatCnDate;
  formatDateTime: typeof import("../shared").formatDateTime;
  formatDurationMs: typeof import("../shared").formatDurationMs;
  formatIngestControlStateLabel: typeof import("../shared").formatIngestControlStateLabel;
  formatIngestRunModeLabel: typeof import("../shared").formatIngestRunModeLabel;
  formatIngestRunScopeLabel: typeof import("../shared").formatIngestRunScopeLabel;
  formatIngestRunStatusLabel: typeof import("../shared").formatIngestRunStatusLabel;
  formatIngestRunTone: typeof import("../shared").formatIngestRunTone;
  formatMarketTokenSource: typeof import("../shared").formatMarketTokenSource;
  formatPctNullable: typeof import("../shared").formatPctNullable;
  formatTagSourceLabel: typeof import("../shared").formatTagSourceLabel;
  formatTargetsReasons: typeof import("../shared").formatTargetsReasons;
  getIngestControlStateDotClass: typeof import("../shared").getIngestControlStateDotClass;
  getUniversePoolBucketLabel: typeof import("../shared").getUniversePoolBucketLabel;
  otherTab: OtherTab;
  otherTabs: ReadonlyArray<OtherTabOption>;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  setOtherTab: Dispatch<SetStateAction<OtherTab>>;
  snapshot: PortfolioSnapshot | null;
}

export type OtherViewProps = DashboardMarketState &
  DashboardPortfolioState &
  DashboardMarketAdminDerived &
  DashboardMarketTargetPoolDetail &
  DashboardMarketOrchestration &
  DashboardLedgerActions &
  Pick<
    DashboardMarketResizeResult,
    | "targetsEditorGridRef"
    | "handleTargetsEditorResizePointerDown"
    | "handleTargetsEditorResizeKeyDown"
  > &
  OtherViewExternalProps;

export function OtherView(props: OtherViewProps) {
  const { Panel, otherTab, otherTabs, setOtherTab } = props;

  return (
    <Panel>
      <div className="border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-background-dark/75">
        <div className="flex items-center gap-1 overflow-x-auto px-3">
          {otherTabs.map((tab: OtherTabOption) => {
            const isActive = otherTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`flex-none min-w-[140px] flex items-center justify-center px-4 py-2 text-sm font-semibold text-center whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-surface-dark"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80"
                }`}
                onClick={() => setOtherTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-6 space-y-6 w-full max-w-none">
        {otherTab === "data-management" && <OtherDataManagementTab {...props} />}

        {otherTab === "instrument-management" && (
          <OtherInstrumentManagementTab {...props} />
        )}

        {otherTab === "data-status" && <OtherDataStatusTab {...props} />}

        {otherTab === "test" && <OtherTestTab {...props} />}
      </div>
    </Panel>
  );
}
