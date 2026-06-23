/**
 * TabsV2 — v2 design-system compound tab component.
 * Keyboard navigation (arrow keys, Home, End), full ARIA tablist/tab/tabpanel.
 *
 * Usage:
 * <TabsV2 defaultValue="overview">
 *   <TabsV2.List>
 *     <TabsV2.Tab value="overview">نظرة عامة</TabsV2.Tab>
 *     <TabsV2.Tab value="settings">الإعدادات</TabsV2.Tab>
 *   </TabsV2.List>
 *   <TabsV2.Panel value="overview"><p>...</p></TabsV2.Panel>
 *   <TabsV2.Panel value="settings"><p>...</p></TabsV2.Panel>
 * </TabsV2>
 *
 * @param {{ defaultValue?: string, value?: string, onChange?: (value: string) => void, variant?: 'underline'|'filled', children: React.ReactNode, className?: string }} props
 */
import * as React from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* ─── Context ─────────────────────────────────────────────────────────────── */

const TabsContext = React.createContext(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsV2 sub-components must be used inside <TabsV2>");
  return ctx;
}

/* ─── Root ─────────────────────────────────────────────────────────────────── */

function TabsV2Root({
  defaultValue,
  value: controlledValue,
  onChange,
  variant = "underline",
  className = "",
  children,
}) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue ?? ""
  );

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  function select(val) {
    if (!isControlled) setInternalValue(val);
    onChange?.(val);
  }

  // Collect tab values for keyboard navigation
  const tabValuesRef = React.useRef([]);

  const ctx = React.useMemo(
    () => ({ activeValue, select, variant, tabValuesRef }),
    [activeValue, variant]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cx("flex flex-col", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ─── List ─────────────────────────────────────────────────────────────────── */

function TabsList({ className = "", children, ...rest }) {
  const { variant } = useTabsContext();

  return (
    <div
      role="tablist"
      className={cx(
        "flex items-center",
        variant === "underline"
          ? "border-b border-[var(--va-border-soft)] gap-0"
          : "gap-1 p-1 rounded-[var(--va-radius-lg)] bg-[var(--va-surface-2)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ─── Tab (trigger) ────────────────────────────────────────────────────────── */

function TabsTab({ value, disabled = false, className = "", children, ...rest }) {
  const { activeValue, select, variant, tabValuesRef } = useTabsContext();
  const isActive = activeValue === value;
  const tabRef = React.useRef(null);

  // Register this tab's value so the List can navigate among siblings
  React.useEffect(() => {
    if (!tabValuesRef.current.includes(value)) {
      tabValuesRef.current = [...tabValuesRef.current, value];
    }
    return () => {
      tabValuesRef.current = tabValuesRef.current.filter((v) => v !== value);
    };
  }, [value, tabValuesRef]);

  function handleKeyDown(e) {
    const values = tabValuesRef.current;
    const currentIndex = values.indexOf(value);

    let nextIndex = currentIndex;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % values.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + values.length) % values.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = values.length - 1;
    } else {
      return;
    }

    const nextValue = values[nextIndex];
    select(nextValue);

    // Move DOM focus to the newly activated tab
    const tablist = tabRef.current?.closest('[role="tablist"]');
    if (tablist) {
      const nextTab = tablist.querySelector(`[data-tabs-value="${nextValue}"]`);
      nextTab?.focus();
    }
  }

  const underlineClasses = cx(
    "relative px-4 py-2.5 text-sm font-medium whitespace-nowrap",
    "transition-colors duration-[var(--va-duration-base)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
    "focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-bg,transparent)]",
    isActive
      ? "text-[var(--va-text)] after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-emerald-500 after:rounded-t"
      : "text-[var(--va-text-muted)] hover:text-[var(--va-text-2)]",
    disabled && "cursor-not-allowed opacity-50 pointer-events-none"
  );

  const filledClasses = cx(
    "px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-[var(--va-radius-md)]",
    "transition-colors duration-[var(--va-duration-base)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
    "focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-surface-2,transparent)]",
    isActive
      ? "bg-[var(--va-elevated)] text-[var(--va-text)] shadow-sm"
      : "text-[var(--va-text-muted)] hover:text-[var(--va-text-2)]",
    disabled && "cursor-not-allowed opacity-50 pointer-events-none"
  );

  const { variant: tabVariant } = useTabsContext();

  return (
    <button
      ref={tabRef}
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      data-tabs-value={value}
      onClick={() => !disabled && select(value)}
      onKeyDown={handleKeyDown}
      className={cx(
        tabVariant === "filled" ? filledClasses : underlineClasses,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ─── Panel ─────────────────────────────────────────────────────────────────── */

function TabsPanel({ value, className = "", children, ...rest }) {
  const { activeValue } = useTabsContext();
  const isActive = activeValue === value;

  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={!isActive}
      tabIndex={0}
      className={cx(
        "focus-visible:outline-none",
        isActive ? "block" : "hidden",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ─── Compound export ───────────────────────────────────────────────────────── */

TabsV2Root.displayName = "TabsV2";
TabsList.displayName = "TabsV2.List";
TabsTab.displayName = "TabsV2.Tab";
TabsPanel.displayName = "TabsV2.Panel";

TabsV2Root.List = TabsList;
TabsV2Root.Tab = TabsTab;
TabsV2Root.Panel = TabsPanel;

export const TabsV2 = TabsV2Root;
