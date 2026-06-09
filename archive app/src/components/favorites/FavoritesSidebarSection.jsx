import { Star, X } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../../stores/appStore.js";
import { FAVORITE_ENTITY_TYPES } from "../../stores/slices/favoritesSlice.js";

const ENTITY_ICON = {
  [FAVORITE_ENTITY_TYPES.ITEM]: "🎬",
  [FAVORITE_ENTITY_TYPES.COLLECTION]: "📁",
  [FAVORITE_ENTITY_TYPES.FOLDER]: "🗂️",
  [FAVORITE_ENTITY_TYPES.SEARCH]: "🔍"
};

export function FavoritesSidebarSection({ onNavigate, collapsed = false }) {
  const { favorites, removeFavorite, setCurrentPage, setSelectedItemId } = useAppStore();

  if (!favorites || favorites.length === 0) return null;

  function handleFavoriteClick(fav) {
    if (fav.entityType === FAVORITE_ENTITY_TYPES.ITEM) {
      setSelectedItemId?.(fav.entityId);
      setCurrentPage?.("detail");
    } else if (fav.entityType === FAVORITE_ENTITY_TYPES.COLLECTION) {
      setCurrentPage?.("collections");
    } else if (fav.entityType === FAVORITE_ENTITY_TYPES.FOLDER) {
      setCurrentPage?.("archive");
    } else if (fav.entityType === FAVORITE_ENTITY_TYPES.SEARCH) {
      setCurrentPage?.("search");
    }
    onNavigate?.();
  }

  if (collapsed) {
    return jsx("div", {
      className: "mb-2 flex flex-col items-center gap-1",
      children: jsx("div", {
        title: "المفضلة",
        className: "flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-yellow-400",
        children: jsx(Star, { className: "h-4 w-4", fill: "currentColor" })
      })
    });
  }

  return jsxs("div", {
    className: "mb-3",
    children: [
      jsxs("div", {
        className: "mb-1 flex items-center gap-2 px-3 text-[11px] font-medium uppercase tracking-wider text-gray-500",
        children: [
          jsx(Star, { className: "h-3 w-3 text-yellow-400", fill: "currentColor" }),
          jsx("span", { children: "المفضلة" })
        ]
      }),
      jsx("div", {
        className: "flex flex-col gap-0.5",
        children: favorites.slice(0, 8).map((fav) =>
          jsxs("div", {
            key: fav.key,
            className: "group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white cursor-pointer",
            children: [
              jsx("span", { className: "text-base shrink-0", children: ENTITY_ICON[fav.entityType] || "⭐" }),
              jsx("span", {
                className: "flex-1 truncate",
                onClick: () => handleFavoriteClick(fav),
                children: fav.label || fav.entityId
              }),
              jsx("button", {
                type: "button",
                title: "إزالة من المفضلة",
                onClick: (e) => { e.stopPropagation(); removeFavorite({ entityType: fav.entityType, entityId: fav.entityId }); },
                className: "invisible shrink-0 rounded p-0.5 text-gray-600 hover:text-red-400 group-hover:visible",
                children: jsx(X, { className: "h-3 w-3" })
              })
            ]
          }, fav.key)
        )
      })
    ]
  });
}
