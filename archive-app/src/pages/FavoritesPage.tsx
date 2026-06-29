import { Star, Trash2 } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { ErrorMessage } from "../components/common/ErrorMessage.jsx";
import { EmptyState } from "../components/ui/primitives.jsx";
import { useAppStore } from "../stores/index.js";
import { FAVORITE_ENTITY_TYPES } from "../stores/slices/favoritesSlice.js";

const ENTITY_LABEL = {
  [FAVORITE_ENTITY_TYPES.ITEM]: "عنصر أرشيف",
  [FAVORITE_ENTITY_TYPES.COLLECTION]: "مجموعة",
  [FAVORITE_ENTITY_TYPES.FOLDER]: "مجلد",
  [FAVORITE_ENTITY_TYPES.SEARCH]: "بحث محفوظ"
};

const ENTITY_ICON = {
  [FAVORITE_ENTITY_TYPES.ITEM]: "🎬",
  [FAVORITE_ENTITY_TYPES.COLLECTION]: "📁",
  [FAVORITE_ENTITY_TYPES.FOLDER]: "🗂️",
  [FAVORITE_ENTITY_TYPES.SEARCH]: "🔍"
};

function FavoriteRow({ fav, videoItems, onNavigate, onRemove }: any) {
  const item = fav.entityType === FAVORITE_ENTITY_TYPES.ITEM
    ? videoItems.find((v: any) => v.uid === fav.entityId || v.id === fav.entityId)
    : null;

  const displayLabel = fav.label || item?.title || fav.entityId;

  return jsxs("div", {
    className: "group flex items-center gap-3 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-4 py-3 transition-colors hover:border-emerald-500/25 hover:bg-[var(--va-surface-2)]",
    children: [
      jsx("span", { className: "text-xl shrink-0", children: ENTITY_ICON[fav.entityType] || "⭐" }),
      jsxs("div", {
        className: "flex-1 min-w-0 cursor-pointer",
        onClick: () => onNavigate(fav),
        children: [
          jsx("p", { className: "truncate text-sm font-medium text-[var(--va-text)]", children: displayLabel }),
          jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: ENTITY_LABEL[fav.entityType] || fav.entityType })
        ]
      }),
      jsx("button", {
        type: "button",
        title: "إزالة من المفضلة",
        "aria-label": "إزالة من المفضلة",
        onClick: () => onRemove(fav),
        className: "invisible shrink-0 rounded-[var(--va-radius-md)] p-1.5 text-[var(--va-text-muted)] transition-colors hover:bg-rose-500/10 hover:text-rose-400 group-hover:visible focus-visible:visible",
        children: jsx(Trash2, { className: "h-4 w-4" })
      })
    ]
  });
}

export default function FavoritesPage() {
  const {
    favorites,
    favoritesError,
    removeFavorite,
    loadFavoritesFromStorage,
    videoItems,
    setCurrentPage,
    setSelectedItemId
  } = useAppStore();

  function handleNavigate(fav: any) {
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
  }

  function handleRemove(fav: any) {
    removeFavorite({ entityType: fav.entityType, entityId: fav.entityId });
  }

  const byType = React.useMemo(() => {
    const groups = {};
    for (const fav of favorites) {
      if (!(groups as any)[fav.entityType]) (groups as any)[fav.entityType] = [];
      (groups as any)[fav.entityType].push(fav);
    }
    return groups;
  }, [favorites]);

  return jsxs("div", {
    className: "mx-auto max-w-3xl px-4 py-8",
    children: [
      jsxs("div", {
        className: "mb-6 flex items-center gap-3",
        children: [
          jsx("div", {
            className: "flex h-10 w-10 items-center justify-center rounded-[var(--va-radius-lg)] bg-[var(--va-highlight-soft)]",
            children: jsx(Star, { className: "h-5 w-5 text-[var(--va-highlight)]", fill: "currentColor" })
          }),
          jsxs("div", {
            children: [
              jsx("h1", { className: "text-xl font-semibold text-[var(--va-text)]", children: "المفضلة" }),
              jsx("p", { className: "text-sm text-[var(--va-text-muted)]", children: `${favorites.length} عنصر محفوظ` })
            ]
          })
        ]
      }),

      favoritesError && jsx(ErrorMessage, {
        error: { message: favoritesError },
        onRetry: loadFavoritesFromStorage,
        className: "mb-4"
      }),

      favorites.length === 0
        ? jsx(EmptyState, {
            icon: jsx(Star, { className: "h-7 w-7" }),
            title: "لا توجد عناصر مفضلة بعد",
            description: "انقر على أيقونة النجمة ★ في أي عنصر لإضافته هنا."
          })
        : jsx("div", {
            className: "flex flex-col gap-6",
            children: Object.entries(byType).map(([type, favs]: any) =>
              jsxs("div", {
                key: type,
                children: [
                  jsx("h2", {
                    className: "mb-2 text-xs font-medium uppercase tracking-wider text-[var(--va-text-muted)]",
                    children: ENTITY_LABEL[type] || type
                  }),
                  jsx("div", {
                    className: "flex flex-col gap-2",
                    children: favs.map((fav: any) =>
                      jsx(FavoriteRow, {
                        key: fav.key,
                        fav,
                        videoItems,
                        onNavigate: handleNavigate,
                        onRemove: handleRemove
                      }, fav.key)
                    )
                  })
                ]
              })
            )
          })
    ]
  });
}
