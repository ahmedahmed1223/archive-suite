import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";

export const FAVORITE_ENTITY_TYPES = {
  ITEM: "item",
  COLLECTION: "collection",
  FOLDER: "folder",
  SEARCH: "search"
};

function createFavorite({ entityType, entityId, label = "", order = 0 } = {}) {
  return {
    key: `${entityType}:${entityId}`,
    entityType,
    entityId,
    label,
    order,
    createdAt: new Date().toISOString()
  };
}

export const favoritesInitialState = {
  favorites: [],
  favoritesLoading: false,
  favoritesError: null
};

export const favoritesActionKeys = [
  "addFavorite",
  "removeFavorite",
  "reorderFavorite",
  "isFavorite",
  "loadFavoritesFromStorage",
  "clearFavoritesStore"
];

// Guard against concurrent loadFavoritesFromStorage calls (StrictMode double-invoke).
let _loadFavoritesInFlight = false;

export function createFavoritesActions({ set, get }) {
  return {
    loadFavoritesFromStorage: async () => {
      if (_loadFavoritesInFlight) return get().favorites;
      _loadFavoritesInFlight = true;
      set({ favoritesLoading: true, favoritesError: null });
      try {
        const stored = await dbGetAll(STORES.FAVORITES).catch(() => []);
        const favorites = Array.isArray(stored) ? stored : [];
        favorites.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        set({ favorites, favoritesLoading: false });
        return favorites;
      } catch (error) {
        set({ favoritesLoading: false, favoritesError: error?.message || "تعذر تحميل المفضلة" });
        return get().favorites;
      } finally {
        _loadFavoritesInFlight = false;
      }
    },

    addFavorite: async ({ entityType, entityId, label = "" } = {}) => {
      if (!entityType || !entityId) return null;
      const key = `${entityType}:${entityId}`;
      if (get().favorites.some((f) => f.key === key)) return null;
      const maxOrder = get().favorites.reduce((max, f) => Math.max(max, f.order ?? 0), -1);
      const fav = createFavorite({ entityType, entityId, label, order: maxOrder + 1 });
      set((state) => ({ favorites: [...state.favorites, fav], favoritesError: null }));
      await dbPut(STORES.FAVORITES, fav).catch(() => {});
      return fav;
    },

    removeFavorite: async ({ entityType, entityId } = {}) => {
      if (!entityType || !entityId) return false;
      const key = `${entityType}:${entityId}`;
      set((state) => ({ favorites: state.favorites.filter((f) => f.key !== key) }));
      await dbDelete(STORES.FAVORITES, key).catch(() => {});
      return true;
    },

    reorderFavorite: async (key, newOrder) => {
      set((state) => {
        const updated = state.favorites.map((f) =>
          f.key === key ? { ...f, order: newOrder } : f
        );
        updated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return { favorites: updated };
      });
      const fav = get().favorites.find((f) => f.key === key);
      if (fav) await dbPut(STORES.FAVORITES, fav).catch(() => {});
    },

    isFavorite: (entityType, entityId) => {
      const key = `${entityType}:${entityId}`;
      return get().favorites.some((f) => f.key === key);
    },

    clearFavoritesStore: () => set({ ...favoritesInitialState })
  };
}
