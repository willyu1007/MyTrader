import type {
  AccountSummary,
  InstrumentProfile,
  InstrumentProfileSummary,
  LedgerEntry,
  MarketDailyBar,
  MarketQuote,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot,
  TagSummary,
  WatchlistItem
} from "@mytrader/shared";

export interface DashboardProps {
  account: AccountSummary;
  onLock: () => Promise<void>;
  onActivePortfolioChange?: (portfolio: {
    id: string | null;
    name: string | null;
  }) => void;
}

export type WorkspaceView =
  | "portfolio"
  | "risk"
  | "market"
  | "index-tracking"
  | "data-analysis"
  | "opportunities"
  | "backtest"
  | "insights"
  | "alerts"
  | "other"
  | "account";

export type PortfolioTab =
  | "overview"
  | "holdings"
  | "trades"
  | "performance"
  | "risk"
  | "allocation"
  | "corporate";

export type OtherTab =
  | "data-management"
  | "instrument-management"
  | "data-status"
  | "test";

export type AnalysisTab = "portfolio" | "instrument" | "index" | "sector";

export interface DashboardUiState {
  activeView: WorkspaceView;
  portfolioTab: PortfolioTab;
  otherTab: OtherTab;
  analysisTab: AnalysisTab;
  isNavCollapsed: boolean;
  error: string | null;
  notice: string | null;
}

export interface PortfolioDomainState {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  snapshot: PortfolioSnapshot | null;
  performanceResult: PortfolioPerformanceRangeResult | null;
  ledgerEntries: LedgerEntry[];
}

export interface MarketDomainState {
  searchQuery: string;
  searchResults: InstrumentProfileSummary[];
  selectedSymbol: string | null;
  selectedProfile: InstrumentProfile | null;
  selectedQuote: MarketQuote | null;
  chartBars: MarketDailyBar[];
  tags: TagSummary[];
  watchlistItems: WatchlistItem[];
}

export interface AnalysisDomainState {
  instrumentQuery: string;
  instrumentSearchResults: InstrumentProfileSummary[];
  instrumentSymbol: string | null;
  instrumentProfile: InstrumentProfile | null;
  instrumentQuote: MarketQuote | null;
  instrumentBars: MarketDailyBar[];
}

export interface PortfolioViewModel {
  activePortfolio: Portfolio | null;
  snapshot: PortfolioSnapshot | null;
  performanceResult: PortfolioPerformanceRangeResult | null;
  ledgerEntries: LedgerEntry[];
}

export interface MarketViewModel {
  selectedSymbol: string | null;
  selectedProfile: InstrumentProfile | null;
  selectedQuote: MarketQuote | null;
  chartBars: MarketDailyBar[];
  tags: TagSummary[];
  watchlistItems: WatchlistItem[];
}

export interface OtherViewModel {
  activeTab: OtherTab;
}
