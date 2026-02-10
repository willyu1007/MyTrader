import type { PortfolioSnapshot } from "@mytrader/shared";
import type {
  MarketChartRangeKey,
  MarketFilterMarket,
  MarketScope,
  TargetPoolStatsScope,
  TargetPoolStructureStats
} from "../types";
import { MarketDetailWorkspace } from "./market/MarketDetailWorkspace";
import { MarketDialogs } from "./market/MarketDialogs";
import { MarketSidebar } from "./market/MarketSidebar";

type DashboardMarketState = ReturnType<
  typeof import("../hooks/use-dashboard-market").useDashboardMarket<
    MarketScope,
    MarketFilterMarket,
    MarketChartRangeKey,
    TargetPoolStatsScope,
    TargetPoolStructureStats
  >
>;
type DashboardMarketAdminDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-admin-derived").useDashboardMarketAdminDerived<TargetPoolStatsScope>
>;
type DashboardMarketDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-derived").useDashboardMarketDerived
>;
type DashboardMarketOrchestration = ReturnType<
  typeof import("../hooks/use-dashboard-market-orchestration").useDashboardMarketOrchestration
>;
type DashboardMarketResizeResult = ReturnType<
  typeof import("../hooks/use-dashboard-market-resize").useDashboardMarketResize
>;

interface MarketViewExternalProps {
  Button: typeof import("../shared").Button;
  ChartErrorBoundary: typeof import("../shared").ChartErrorBoundary;
  FormGroup: typeof import("../shared").FormGroup;
  IconButton: typeof import("../shared").IconButton;
  Input: typeof import("../shared").Input;
  MarketAreaChart: typeof import("../shared").MarketAreaChart;
  MarketQuoteHeader: typeof import("../shared").MarketQuoteHeader;
  MarketVolumeMiniChart: typeof import("../shared").MarketVolumeMiniChart;
  Modal: typeof import("../shared").Modal;
  PopoverSelect: typeof import("../shared").PopoverSelect;
  formatCnDate: typeof import("../shared").formatCnDate;
  formatCnWanYiNullable: typeof import("../shared").formatCnWanYiNullable;
  formatNumber: typeof import("../shared").formatNumber;
  formatSignedCnWanYiNullable: typeof import("../shared").formatSignedCnWanYiNullable;
  formatSignedPctNullable: typeof import("../shared").formatSignedPctNullable;
  formatThemeLabel: typeof import("../shared").formatThemeLabel;
  getCnChangeTone: typeof import("../shared").getCnChangeTone;
  getCnToneTextClass: typeof import("../shared").getCnToneTextClass;
  marketChartRanges: ReadonlyArray<MarketRangeOption>;
  snapshot: PortfolioSnapshot | null;
  sortTagMembersByChangePct: typeof import("../shared").sortTagMembersByChangePct;
}

export type MarketViewProps = DashboardMarketState &
  DashboardMarketAdminDerived &
  DashboardMarketDerived &
  DashboardMarketOrchestration &
  Pick<
    DashboardMarketResizeResult,
    | "handleMarketExplorerResizePointerDown"
    | "handleMarketExplorerResizeKeyDown"
  > &
  MarketViewExternalProps;

export interface MarketTagFacetItem {
  tag: string;
  level: string;
  name: string;
}

export interface MarketRangeOption {
  key: MarketChartRangeKey;
  label: string;
}

export interface MarketChartHoverDatum {
  date: string;
  close: number;
}

export function MarketView(props: MarketViewProps) {
  const {
    handleMarketExplorerResizeKeyDown,
    handleMarketExplorerResizePointerDown
  } = props;

  return (
    <>
      <div className="h-full min-h-0 flex">
        <MarketSidebar {...props} />

        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={handleMarketExplorerResizePointerDown}
          onKeyDown={handleMarketExplorerResizeKeyDown}
          className="w-1 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 focus:bg-primary/25 focus:outline-none"
          title="拖拽调节宽度（←/→ 可微调）"
        />

        <MarketDetailWorkspace {...props} />
      </div>

      <MarketDialogs {...props} />
    </>
  );
}
