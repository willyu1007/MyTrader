interface SidebarNavItem {
  key: string;
  label: string;
  icon: string;
}

export interface SidebarNavProps {
  activeView: string;
  isNavCollapsed: boolean;
  items: readonly SidebarNavItem[];
  onSelectView: (view: string) => void;
  onOpenSettings?: () => void;
}

export function SidebarNav({
  activeView,
  isNavCollapsed,
  items,
  onSelectView,
  onOpenSettings
}: SidebarNavProps) {
  return (
    <aside
      className={`${
        isNavCollapsed ? "w-16" : "w-40"
      } flex-shrink-0 bg-surface-light/95 dark:bg-surface-dark/90 backdrop-blur-xl border-r border-border-light dark:border-border-dark flex flex-col transition-all duration-300 z-20`}
    >
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => {
          const isActive = item.key === activeView;
          return (
            <button
              key={item.key}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                ${isActive
                  ? "bg-primary text-white font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-background-dark/80 hover:text-slate-900 dark:hover:text-white"
                }
                ${isNavCollapsed ? "justify-center px-2" : ""}
              `}
              type="button"
              onClick={() => onSelectView(item.key)}
              title={item.label}
            >
              <span
                className={`material-icons-outlined ${isNavCollapsed ? "text-xl" : "text-lg"} ${
                  isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                }`}
              >
                {item.icon}
              </span>
              {!isNavCollapsed && (
                <div className="flex flex-col items-start text-left leading-tight">
                  <span>{item.label}</span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2">
        <button
          type="button"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
            text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-background-dark/80 hover:text-slate-900 dark:hover:text-white
            ${isNavCollapsed ? "justify-center px-2" : ""}
          `}
          onClick={onOpenSettings}
          title="设置"
        >
          <span className={`material-icons-outlined ${isNavCollapsed ? "text-xl" : "text-lg"}`}>
            settings
          </span>
          {!isNavCollapsed && <span>设置</span>}
        </button>
      </div>
    </aside>
  );
}
