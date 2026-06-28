import { normalizeArabicSearchText } from "../../utils/formatting.js";

type CommandPaletteCommand = {
  id: string;
  label?: string;
  detail?: string;
  keys?: string;
  kind?: string;
  group?: string;
  run?: () => unknown;
  [key: string]: any;
};

type VideoItemLike = {
  id: string;
  title?: string;
  type?: string;
  subtype?: string;
  tags?: string[];
  tagsText?: string;
  isDeleted?: boolean;
  [key: string]: any;
};

function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  if (!haystack) return 0;
  // Exact substring earns the highest score plus a position bonus.
  const exactIndex = haystack.indexOf(needle);
  if (exactIndex !== -1) {
    return 1000 + Math.max(0, 200 - exactIndex);
  }
  // Walk the haystack consuming needle chars in order; reward consecutive matches.
  let score = 0;
  let consecutive = 0;
  let h = 0;
  for (let n = 0; n < needle.length; n += 1) {
    const target = needle[n];
    let found = false;
    while (h < haystack.length) {
      if (haystack[h] === target) {
        score += 4 + consecutive * 3;
        consecutive += 1;
        h += 1;
        found = true;
        break;
      }
      consecutive = 0;
      h += 1;
    }
    if (!found) return 0;
  }
  // Reward shorter haystacks that still matched (more focused result).
  return score + Math.max(0, 50 - haystack.length);
}

export function filterCommandPaletteCommands<TCommand extends CommandPaletteCommand>(commands: TCommand[] = [], query = ""): TCommand[] {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return commands;
  const scored: Array<{ command: TCommand; score: number }> = [];
  for (const command of commands) {
    const haystack = normalizeArabicSearchText(`${command.label || ""} ${command.detail || ""} ${command.keys || ""}`);
    const score = fuzzyScore(haystack, normalizedQuery);
    if (score > 0) {
      scored.push({ command, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.command);
}

export function buildVideoItemCommands(
  videoItems: VideoItemLike[] = [],
  { query = "", limit = 5, onOpen }: { query?: string; limit?: number; onOpen?: (item: VideoItemLike) => unknown } = {}
): CommandPaletteCommand[] {
  if (!Array.isArray(videoItems) || videoItems.length === 0 || typeof onOpen !== "function") return [];
  const normalizedQuery = normalizeArabicSearchText(query);
  const candidates: Array<{ command: CommandPaletteCommand; score: number }> = [];
  for (const item of videoItems) {
    if (!item || item.isDeleted) continue;
    const title = item.title || "بدون عنوان";
    const command = {
      id: `video-${item.id}`,
      label: `افتح فيديو: ${title}`,
      detail: [item.subtype, item.type, item.id].filter(Boolean).join(" · ") || "عنصر أرشيف",
      keys: [title, item.tagsText, ...(item.tags || [])].filter(Boolean).join(" "),
      kind: "item",
      run: () => onOpen(item)
    };
    if (!normalizedQuery) {
      candidates.push({ command, score: 1 });
    } else {
      const haystack = normalizeArabicSearchText(`${title} ${command.keys}`);
      const score = fuzzyScore(haystack, normalizedQuery);
      if (score > 0) candidates.push({ command, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map((entry) => entry.command);
}

const COMMAND_GROUP_LABELS: Record<string, string> = {
  recent: "آخر الأوامر",
  page: "الصفحات",
  action: "إجراءات مباشرة",
  item: "مواد الأرشيف",
  project: "المشاريع",
  settings: "الإعدادات"
};

const COMMAND_GROUP_ORDER = ["recent", "page", "action", "item", "project", "settings"];

export function groupCommandPaletteCommands(commands: CommandPaletteCommand[] = []) {
  const groups = new Map<string, { id: string; label: string; items: CommandPaletteCommand[] }>();
  for (const command of commands) {
    const id = command.group || command.kind || "action";
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        label: COMMAND_GROUP_LABELS[id] || id,
        items: []
      });
    }
    groups.get(id)?.items.push(command);
  }
  return [...groups.values()].sort((a, b) => {
    const ai = COMMAND_GROUP_ORDER.indexOf(a.id);
    const bi = COMMAND_GROUP_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}
