"use client";

import * as Icons from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { resolveIcon } from "@/lib/icon-registry";
import type { NavigationItem, NavSection } from "@/lib/navigation";

export interface AppNavigationDrawerProps {
  groups: ReadonlyArray<{
    section: NavSection | string;
    label: string;
    items: readonly NavigationItem[];
  }>;
  activeHref?: string;
  open: boolean;
  onClose(): void;
}

// V14-UX-002 (Task 2): the route drawer extracted from AppHeader. Markup,
// links and capability gates are unchanged — only ownership moved.
export default function AppNavigationDrawer({
  groups,
  activeHref,
  open,
  onClose
}: Readonly<AppNavigationDrawerProps>) {
  const { t } = useLocale();
  const routeLinksRef = useRef<HTMLElement>(null);
  const groupRefs = useRef<HTMLDetailsElement[]>([]);
  const [scroll, setScroll] = useState({ up: false, down: false });

  const updateScroll = () => {
    const navigation = routeLinksRef.current;
    if (!navigation) return;
    const maxScroll = Math.max(0, navigation.scrollHeight - navigation.clientHeight);
    setScroll({ up: navigation.scrollTop > 1, down: navigation.scrollTop < maxScroll - 1 });
  };

  useEffect(() => {
    const navigation = routeLinksRef.current;
    if (!navigation) return;
    updateScroll();
    window.addEventListener("resize", updateScroll);
    return () => window.removeEventListener("resize", updateScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const scrollByPage = (direction: 1 | -1) =>
    routeLinksRef.current?.scrollBy({
      top: direction * Math.max(240, Math.round((routeLinksRef.current?.clientHeight ?? 0) * 0.72)),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });

  return (
    <>
      {open ? <button type="button" className="navigation-backdrop" aria-label={t.shell.closeNavigation} onClick={onClose} /> : null}
      <div className="sidebar-navigation" data-open={open ? "true" : "false"}>
        <button type="button" className="sidebar-scroll-control" aria-label={t.shell.scrollNavigationUp} title={t.shell.scrollNavigationUp} disabled={!scroll.up} onClick={() => scrollByPage(-1)}>
          <Icons.ChevronUp aria-hidden="true" size={18} strokeWidth={2} />
        </button>
        <nav id="app-primary-nav" className="route-links" aria-label={t.shell.routes} ref={routeLinksRef} onScroll={updateScroll}>
          <div className="nav-group-actions" aria-label={t.shell.navigationGroupTools}>
            <button type="button" className="button button-ghost button-sm" onClick={() => groupRefs.current.forEach((group) => { group.open = true; })}>{t.shell.expandAllGroups}</button>
            <button type="button" className="button button-ghost button-sm" onClick={() => groupRefs.current.forEach((group) => { group.open = false; })}>{t.shell.collapseAllGroups}</button>
          </div>
          {groups.map((group, index) => (
            <details
              className="nav-group"
              data-section={group.section}
              key={group.section}
              open={group.items.some((item) => item.href === activeHref) || (!activeHref && index === 1)}
              ref={(element) => { if (element) groupRefs.current[index] = element; }}
            >
              <summary>{group.label}</summary>
              <div className="nav-section" data-section={group.section}>
                {group.items.map((item) => {
                  const Icon = resolveNavIcon(item.icon);
                  return (
                    <Link key={item.href} className="badge app-nav-link" data-section={item.section} href={item.href} aria-current={item.href === activeHref ? "page" : undefined}>
                      <Icon aria-hidden="true" className="app-nav-link__icon" size={16} strokeWidth={2} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </details>
          ))}
        </nav>
        <button type="button" className="sidebar-scroll-control" aria-label={t.shell.scrollNavigationDown} title={t.shell.scrollNavigationDown} disabled={!scroll.down} onClick={() => scrollByPage(1)}>
          <Icons.ChevronDown aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </div>
    </>
  );
}

function resolveNavIcon(name: string) {
  return resolveIcon(name, Icons.Circle);
}
