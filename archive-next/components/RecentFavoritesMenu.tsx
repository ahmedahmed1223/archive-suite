"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Clock, Star } from "lucide-react";
import Link from "next/link";
import { listFavorites } from "@/lib/favorites";
import { listRecent } from "@/lib/recent-items";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Header popover listing recently viewed and favorited records (V1-773). */
export default function RecentFavoritesMenu() {
  const { locale } = useLocale();
  const copy = locale === "en" ? {
    trigger: "Recent and favorite items", title: "Recent and favorites", favorites: "Favorites", recent: "Recent", noFavorites: "No favorite items yet.", noRecent: "You have not opened any records yet.",
  } : {
    trigger: "العناصر الأخيرة والمفضّلة", title: "الأخيرة والمفضّلة", favorites: "المفضّلة", recent: "الأخيرة", noFavorites: "لا توجد عناصر مفضّلة بعد.", noRecent: "لم تفتح أي سجل بعد.",
  };
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback((returnFocus = true) => {
    setIsOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        closePanel(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanel, isOpen]);

  const favorites = isOpen ? listFavorites().slice(0, 5) : [];
  const recent = isOpen ? listRecent().slice(0, 5) : [];

  return (
    <div className="recent-favorites-container">
      <button
        type="button"
        className="icon-action"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={copy.trigger}
        aria-expanded={isOpen}
        aria-controls={panelId}
        title={copy.title}
        ref={triggerRef}
      >
        <Clock aria-hidden="true" size={18} strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="recent-favorites-menu ui-dropdown-content" id={panelId} ref={panelRef} role="menu">
          <p className="recent-favorites-menu__heading">
            <Star aria-hidden="true" size={14} strokeWidth={2} /> {copy.favorites}
          </p>
          {favorites.length === 0 ? (
            <p className="helper-text">{copy.noFavorites}</p>
          ) : (
            favorites.map((item) => (
              <Link key={item.id} href={`/archive/${encodeURIComponent(item.id)}`} role="menuitem" onClick={() => closePanel(false)}>
                {item.title || item.id}
              </Link>
            ))
          )}
          <p className="recent-favorites-menu__heading">
            <Clock aria-hidden="true" size={14} strokeWidth={2} /> {copy.recent}
          </p>
          {recent.length === 0 ? (
            <p className="helper-text">{copy.noRecent}</p>
          ) : (
            recent.map((item) => (
              <Link key={item.id} href={`/archive/${encodeURIComponent(item.id)}`} role="menuitem" onClick={() => closePanel(false)}>
                {item.title || item.id}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
