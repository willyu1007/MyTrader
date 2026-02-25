import { Button } from "../primitives/Buttons";

interface TopToolbarNavItem {
  key: string;
  label: string;
}

interface TopToolbarTab {
  key: string;
  label: string;
  active: boolean;
  onSelect: () => void;
  title?: string;
}

export interface TopToolbarProps {
  activeView: string;
  otherTab: string;
  navItems: readonly TopToolbarNavItem[];
  topTabGroupLabel?: string;
  topTabs?: readonly TopToolbarTab[];
  marketPriceAsOf?: string | null;
  onLock: () => Promise<void>;
}

export function TopToolbar({
  activeView,
  otherTab,
  navItems,
  topTabGroupLabel,
  topTabs,
  marketPriceAsOf,
  onLock
}: TopToolbarProps) {
  const currentViewLabel =
    activeView === "other" && otherTab === "data-status"
      ? "数据状态"
      : navItems.find((n) => n.key === activeView)?.label;
  const hasTopTabs = Boolean(topTabs && topTabs.length > 0);

  return (
    <div className="h-10 border-b border-border-light dark:border-border-dark flex items-center gap-3 px-3 flex-shrink-0 bg-white/85 dark:bg-background-dark/75 backdrop-blur-lg">
      <div className="flex-1 min-w-0">
        {hasTopTabs ? (
          <div className="flex items-center gap-2 overflow-x-auto" role="tablist">
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {topTabGroupLabel ?? currentViewLabel}
            </span>
            <span
              className="w-px h-3 bg-slate-300 dark:bg-border-dark flex-shrink-0"
              aria-hidden="true"
            />
            {topTabs?.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={tab.active}
                className={`flex-none px-3 py-2 text-[13px] font-semibold transition-colors border-b-2 ${
                  tab.active
                    ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-surface-dark"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80"
                }`}
                onClick={tab.onSelect}
                title={tab.title}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {currentViewLabel}
            </h2>
            {activeView === "market" && (
              <span className="relative top-[1px] text-xs font-mono text-slate-500 dark:text-slate-400">
                {marketPriceAsOf ?? "--"}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {activeView === "account" && (
          <Button variant="secondary" size="sm" onClick={onLock} icon="lock">
            锁定
          </Button>
        )}
      </div>
    </div>
  );
}
