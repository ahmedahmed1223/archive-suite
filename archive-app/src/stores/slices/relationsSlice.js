import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { nowIso } from "../storeCore.js";
import {
  createRelation,
  getInverseRelationType,
  getItemRelations,
  isKnownRelationType
} from "../../features/relations/viewModel.js";

export const relationsInitialState = {
  itemRelations: [],
  relationsLoading: false,
  relationsError: null
};

export const relationsActionKeys = [
  "addRelation",
  "removeRelation",
  "getRelationsForItem",
  "loadRelationsFromStorage",
  "clearRelations"
];

// A relation is a duplicate when the same directed (source → target) link
// already exists with the same type.
function isDuplicateRelation(relations, candidate) {
  return relations.some(
    (relation) =>
      relation.sourceId === candidate.sourceId &&
      relation.targetId === candidate.targetId &&
      relation.type === candidate.type
  );
}

// Bidirectional relations get a stored mirror edge so both items list the link
// from their own perspective. The mirror is tagged with `mirrorOf` so removing
// either side cleans up the pair.
function buildMirrorRelation(relation) {
  return createRelation({
    sourceId: relation.targetId,
    targetId: relation.sourceId,
    type: getInverseRelationType(relation.type),
    note: relation.note,
    createdBy: relation.createdBy
  });
}

export function createRelationsActions({ set, get }) {
  return {
    loadRelationsFromStorage: async () => {
      set({ relationsLoading: true, relationsError: null });
      try {
        const stored = await dbGetAll(STORES.ITEM_RELATIONS);
        set({ itemRelations: Array.isArray(stored) ? stored : [], relationsLoading: false });
        return get().itemRelations;
      } catch (error) {
        set({
          relationsLoading: false,
          relationsError: error?.message || "تعذر تحميل العلاقات"
        });
        return [];
      }
    },

    addRelation: async (partial = {}) => {
      const relation = createRelation(partial);
      if (!relation.sourceId || !relation.targetId) {
        set({ relationsError: "يجب تحديد عنصري العلاقة" });
        return null;
      }
      if (relation.sourceId === relation.targetId) {
        set({ relationsError: "لا يمكن ربط العنصر بنفسه" });
        return null;
      }
      if (!isKnownRelationType(relation.type)) {
        set({ relationsError: "نوع العلاقة غير معروف" });
        return null;
      }
      if (isDuplicateRelation(get().itemRelations, relation)) {
        set({ relationsError: "هذه العلاقة موجودة بالفعل" });
        return null;
      }

      const records = [relation];
      // Mirror only when explicitly requested by the caller via partial.bidirectional,
      // or when the chosen type is symmetric (related_to / alternative_of).
      const wantMirror = partial.bidirectional === true ||
        getInverseRelationType(relation.type) === relation.type;
      if (wantMirror) {
        const mirror = { ...buildMirrorRelation(relation), mirrorOf: relation.id };
        if (!isDuplicateRelation(get().itemRelations, mirror)) {
          records.push(mirror);
        }
      }

      set((state) => ({ itemRelations: [...records, ...state.itemRelations], relationsError: null }));
      for (const record of records) {
        await dbPut(STORES.ITEM_RELATIONS, record).catch(() => {});
      }
      return relation;
    },

    removeRelation: async (id) => {
      if (!id) return false;
      const all = get().itemRelations;
      const target = all.find((relation) => relation.id === id);
      if (!target) return false;
      // Remove the relation plus any mirror that points back at it (its inverse).
      const removeIds = new Set([id]);
      for (const relation of all) {
        if (relation.mirrorOf === id) removeIds.add(relation.id);
        if (target.mirrorOf && relation.id === target.mirrorOf) removeIds.add(relation.id);
      }
      set((state) => ({
        itemRelations: state.itemRelations.filter((relation) => !removeIds.has(relation.id)),
        relationsError: null
      }));
      for (const removeId of removeIds) {
        await dbDelete(STORES.ITEM_RELATIONS, removeId).catch(() => {});
      }
      return true;
    },

    getRelationsForItem: (itemId) => getItemRelations(itemId, get().itemRelations),

    clearRelations: () => set({ ...relationsInitialState, relationsUpdatedAt: nowIso() })
  };
}
