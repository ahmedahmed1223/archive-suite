import { Star, Trash2 } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
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

function FavoriteRow({ fav, videoItems, onNavigate, onRemove }) {
  const item = fav.entityType === FAVORITE_ENTITY_TYPES.ITEM
    ? videoItems.find((v) => v.uid === fav.entityId || v.id === fav.entityId)
    : null;

  const displayLabel = fav.label || item?.title || fav.entityId;

  return jsxs("div", {
    className: "group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors",
    children: [
      jsx("span", { className: "text-xl shrink-0", children: ENTITY_ICON[fav.entityType] || "⭐" }),
      jsxs("div", {
        className: "flex-1 min-w-0 cursor-pointer",
        onClick: () => onNavigate(fav),
        children: [
          jsx("p", { className: "truncate text-sm font-medium text-gray-100", children: displayLabel }),
          jsx("p", { className: "text-xs text-gray-500", children: ENTITY_LABEL[fav.entityType] || fav.entityType })
        ]
      }),
      jsx("button", {
        type: "button",
        title: "إزالة من المفضلة",
        onClick: () => onRemove(fav),
        className: "invisible shrink-0 rounded-lg p-1.5 text-gray-600 hover:bg-red-500/10 hover:text-red-400 group-hover:visible transition-colors",
        children: jsx(Trash2, { className: "h-4 w-4" })
      })
    ]
  });
}

export default function FavoritesPage() {
  const {
    favorites,
    removeFavorite,
    videoItems,
    setCurrentPage,
    setSelectedItemId
  } = useAppStore();

  function handleNavigate(fav) {
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

  function handleRemove(fav) {
    removeFavorite({ entityType: fav.entityType, entityId: fav.entityId });
  }

  const byType = React.useMemo(() => {
    const groups = {};
    for (const fav of favorites) {
      if (!groups[fav.entityType]) groups[fav.entityType] = [];
      groups[fav.entityType].push(fav);
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
            className: "flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10",
            children: jsx(Star, { className: "h-5 w-5 text-yellow-400", fill: "currentColor" })
          }),
          jsxs("div", {
            children: [
              jsx("h1", { className: "text-xl font-semibold text-gray-100", children: "المفضلة" }),
              jsx("p", { className: "text-sm text-gray-500", children: `${favorites.length} عنصر محفوظ` })
            ]
          })
        ]
      }),

      favorites.length === 0
        ? jsxs("div", {
            className: "flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] py-16 text-center",
            children: [
              jsx(Star, { className: "h-10 w-10 text-gray-600" }),
              jsx("p", { className: "text-gray-400", children: "لا توجد عناصر مفضلة بعد" }),
              jsx("p", { className: "text-sm text-gray-600", children: "انقر على أيقونة النجمة ★ في أي عنصر لإضافته هنا" })
            ]
          })
        : jsx("div", {
            className: "flex flex-col gap-6",
            children: Object.entries(byType).map(([type, favs]) =>
              jsxs("div", {
                key: type,
                children: [
                  jsx("h2", {
                    className: "mb-2 text-xs font-medium uppercase tracking-wider text-gray-500",
                    children: ENTITY_LABEL[type] || type
                  }),
                  jsx("div", {
                    className: "flex flex-col gap-2",
                    children: favs.map((fav) =>
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
