import {
  useAppStore
} from "../../stores/index.js";
import {
  BookOpen,
  Hash,
  UserRound
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { normalizeArabicSearchText } from "../../utils/formatting.js";


const categoryLabels = {
  people: "أشخاص",
  places: "أماكن",
  organizations: "جهات",
  topics: "موضوعات",
  other: "مصطلح"
};

function getAutocompleteTrigger(settings: any, key: any, fallback: any) {
  const value = settings?.autocompleteTriggers?.[key];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 2) : fallback;
}

function buildHierarchicalTagPath(tag: any, tagMap: any) {
  const chain = [];
  let current = tag;
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current.name);
    current = current.parentId ? tagMap.get(current.parentId) : null;
  }
  return chain.filter(Boolean).join(" / ");
}

function getAutocompleteMatch(text: any, caret: any, triggers: any) {
  const source = String(text || "");
  const cursor = Number.isFinite(caret) ? caret : source.length;
  let best: any = null;

  Object.entries(triggers).forEach(([kind, trigger]: any) => {
    if (!trigger) return;
    const start = source.lastIndexOf(trigger, Math.max(0, cursor - 1));
    if (start < 0) return;
    const before = start === 0 ? " " : source[start - 1];
    if (before && !/\s|,|،|\(|\[/.test(before)) return;
    const query = source.slice(start + trigger.length, cursor);
    if (/[\n\r\t]/.test(query)) return;
    if (best && start <= best.start) return;
    best = { kind, trigger, start, end: cursor, query };
  });

  return best;
}

function createSuggestions({ match, allowed, vocabulary, hierarchicalTags, videoItems, users, currentTags = [] }: any) {
  if (!match || !allowed.includes(match.kind)) return [];
  const q = normalizeArabicSearchText(match.query || "");

  if (match.kind === "vocabulary") {
    const userSuggestions = allowed.includes("users")
      ? (users || []).filter((user: any) => user?.isActive !== false).map((user: any) => ({
        id: `user-${user.id || user.username}`,
        kind: "users",
        label: user.displayName || user.username,
        insertText: `@${user.username || user.displayName}`,
        group: "الفريق",
        detail: user.role || "",
        meta: user.username ? `@${user.username}` : ""
      }))
      : [];
    const vocabularySuggestions = (vocabulary || []).map((entry: any) => {
      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
      return {
        id: `vocab-${entry.id || entry.term}`,
        kind: "vocabulary",
        label: entry.term,
        insertText: entry.term,
        group: "مصطلحات القاموس",
        detail: (categoryLabels as any)[entry.category] || categoryLabels.other,
        meta: aliases.length ? aliases.slice(0, 2).join("، ") : entry.description || ""
      };
    });
    return [...userSuggestions, ...vocabularySuggestions].filter((item: any) => {
      const haystack = normalizeArabicSearchText(`${item.label} ${item.detail} ${item.meta}`);
      return !q || haystack.includes(q);
    }).slice(0, 10);
  }

  const tagMap = new Map((hierarchicalTags || []).map((tag: any) => [tag.id, tag]));
  const hTags = (hierarchicalTags || []).map((tag: any) => {
    const path = buildHierarchicalTagPath(tag, tagMap);
    const aliases = Array.isArray(tag.aliases) ? tag.aliases : [];
    return {
      id: `htag-${tag.id}`,
      kind: "tags",
      label: tag.name,
      insertText: path || tag.name,
      group: "الوسوم الهرمية",
      detail: path,
      meta: aliases.slice(0, 2).join("، "),
      color: tag.color
    };
  });
  // Predictive ranking (PR 6): pure pass over existing items computes each
  // tag's overall frequency and how often it co-occurs with the tags already
  // entered in this field. Co-occurrence dominates, then raw frequency.
  const frequency = new Map();
  const coOccurrence = new Map();
  const currentSet = new Set((currentTags || []).map((tag: any) => normalizeArabicSearchText(tag)).filter(Boolean));
  (videoItems || []).forEach((item: any) => {
    const normalized = (Array.isArray(item.tags) ? item.tags : []).map((tag: any) => normalizeArabicSearchText(tag));
    const sharesCurrent = currentSet.size > 0 && normalized.some((key: any) => currentSet.has(key));
    normalized.forEach((key: any) => {
      if (!key) return;
      frequency.set(key, (frequency.get(key) || 0) + 1);
      if (sharesCurrent && !currentSet.has(key)) coOccurrence.set(key, (coOccurrence.get(key) || 0) + 1);
    });
  });

  const seen = new Set(hTags.map((tag: any) => normalizeArabicSearchText(tag.insertText || tag.label)));
  const flatTags: any[] = [];
  (videoItems || []).forEach((item: any) => {
    (Array.isArray(item.tags) ? item.tags : []).forEach((tag: any) => {
      const key = normalizeArabicSearchText(tag);
      if (!key || seen.has(key) || currentSet.has(key)) return;
      seen.add(key);
      const count = frequency.get(key) || 0;
      const co = coOccurrence.get(key) || 0;
      flatTags.push({
        id: `tag-${tag}`,
        kind: "tags",
        label: tag,
        insertText: tag,
        group: "وسوم مستخدمة",
        detail: co > 0 ? `مرتبطة · استُخدمت ${count}` : `استُخدمت ${count}`,
        score: co * 1000 + count
      });
    });
  });
  flatTags.sort((a: any, b: any) => b.score - a.score);

  return [...hTags, ...flatTags].filter((item: any) => {
    const haystack = normalizeArabicSearchText(`${item.label} ${item.detail} ${item.meta || ""}`);
    return !q || haystack.includes(q);
  }).slice(0, 12);
}

export function TagAutocomplete({
  multiline = false,
  value,
  onChange,
  placeholder,
  className = "",
  dir = "rtl",
  rows = 3,
  allowed = ["vocabulary", "tags"],
  onPick,
  inputMode,
  type = "text",
  showDiscoveryHint = true,
  onKeyDown: onExternalKeyDown,
  ...props
}: any) {
  const { vocabulary, hierarchicalTags, videoItems, users, settings } = useAppStore();
  const [match, setMatch] = React.useState(null);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef(null);
  const hintId = React.useId();
  const triggers = React.useMemo(() => ({
    vocabulary: getAutocompleteTrigger(settings, "vocabulary", "@"),
    tags: getAutocompleteTrigger(settings, "tags", "#")
  }), [settings]);

  const currentTags = React.useMemo(
    () => String(value || "").split(/[,،\n]/).map((tag: any) => tag.trim()).filter(Boolean),
    [value]
  );
  const suggestions = React.useMemo(() => createSuggestions({
    match,
    allowed,
    vocabulary,
    hierarchicalTags,
    videoItems,
    users,
    currentTags
  }), [match, allowed, vocabulary, hierarchicalTags, videoItems, users, currentTags]);

  const groupedSuggestions = React.useMemo(() => {
    const groups: any[] = [];
    suggestions.forEach((suggestion: any) => {
      let group = groups.find((entry: any) => entry.label === suggestion.group);
      if (!group) {
        group = { label: suggestion.group, items: [] };
        groups.push(group);
      }
      group.items.push(suggestion);
    });
    return groups;
  }, [suggestions]);

  const updateMatch = React.useCallback((text: any, caret: any) => {
    setMatch(getAutocompleteMatch(text, caret, triggers));
    setHighlightedIndex(0);
  }, [triggers]);

  const close = () => {
    setMatch(null);
    setHighlightedIndex(0);
  };

  const selectSuggestion = (suggestion: any) => {
    if (!match) return;
    const handled = onPick?.(suggestion, match);
    if (handled) {
      close();
      (inputRef.current as any)?.focus();
      return;
    }
    const current = String(value || "");
    const replacement = suggestion.insertText || suggestion.label;
    const nextValue = `${current.slice(0, (match as any).start)}${replacement} ${current.slice((match as any).end)}`;
    const nextCaret = (match as any).start + replacement.length + 1;
    onChange?.(nextValue);
    close();
    requestAnimationFrame(() => {
      (inputRef.current as any)?.focus();
      (inputRef.current as any)?.setSelectionRange?.(nextCaret, nextCaret);
    });
  };

  const handleChange = (event: any) => {
    const nextValue = event.target.value;
    onChange?.(nextValue);
    updateMatch(nextValue, event.target.selectionStart ?? nextValue.length);
  };

  const insertTrigger = (kind: any) => {
    const trigger = (triggers as any)[kind];
    if (!trigger) return;
    const current = String(value || "");
    const caret = (inputRef.current as any)?.selectionStart ?? current.length;
    const needsSpace = caret > 0 && !/\s|[,،]/.test(current[caret - 1]);
    const insertion = `${needsSpace ? " " : ""}${trigger}`;
    const nextValue = `${current.slice(0, caret)}${insertion}${current.slice(caret)}`;
    const nextCaret = caret + insertion.length;
    onChange?.(nextValue);
    updateMatch(nextValue, nextCaret);
    requestAnimationFrame(() => {
      (inputRef.current as any)?.focus();
      (inputRef.current as any)?.setSelectionRange?.(nextCaret, nextCaret);
    });
  };

  const handleKeyDown = (event: any) => {
    if (match && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((index: any) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((index: any) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectSuggestion(suggestions[highlightedIndex] || suggestions[0]);
        return;
      }
      if (event.key === "Escape") {
        close();
        return;
      }
    }
    onExternalKeyDown?.(event);
  };

  const commonProps = {
    ref: inputRef,
    value: value || "",
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onFocus: (event: any) => updateMatch(event.currentTarget.value, event.currentTarget.selectionStart ?? String(value || "").length),
    onClick: (event: any) => updateMatch(event.currentTarget.value, event.currentTarget.selectionStart ?? String(value || "").length),
    onBlur: () => setTimeout(close, 180),
    placeholder: placeholder || (allowed.includes("tags") && allowed.includes("vocabulary")
      ? "اكتب # للوسوم أو @ للقاموس"
      : allowed.includes("tags") ? "اكتب # لاستدعاء الوسوم" : allowed.includes("vocabulary") ? "اكتب @ لاستدعاء القاموس" : ""),
    dir,
    className: `w-full rounded-xl border border-white/10 bg-gray-800/50 px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--va-action,#10b981)] focus:ring-2 focus:ring-[var(--va-action,#10b981)]/10 ${className}`,
    autoComplete: "off",
    inputMode,
    ...props,
    "aria-describedby": [props["aria-describedby"], showDiscoveryHint && allowed.length ? hintId : ""].filter(Boolean).join(" ") || undefined
  };

  return jsxs("div", {
    className: "relative",
    children: [
      multiline ? jsx("textarea", { ...commonProps, rows }) : jsx("input", { ...commonProps, type }),
      showDiscoveryHint && allowed.length > 0 && jsxs("div", {
        id: hintId,
        className: "mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--va-text-muted)]",
        children: [
          jsx("span", { children: "استدعاء سريع:" }),
          allowed.includes("tags") && jsxs("button", {
            type: "button",
            onMouseDown: (event: any) => event.preventDefault(),
            onClick: () => insertTrigger("tags"),
            className: "badge badge-ghost badge-sm gap-1 font-normal hover:badge-primary",
            "aria-label": "إدراج رمز استدعاء الوسوم",
            children: [jsx(Hash, { className: "h-3 w-3" }), "# الوسوم"]
          }),
          allowed.includes("vocabulary") && jsxs("button", {
            type: "button",
            onMouseDown: (event: any) => event.preventDefault(),
            onClick: () => insertTrigger("vocabulary"),
            className: "badge badge-ghost badge-sm gap-1 font-normal hover:badge-primary",
            "aria-label": "إدراج رمز استدعاء القاموس",
            children: [jsx(BookOpen, { className: "h-3 w-3" }), "@ القاموس"]
          })
        ]
      }),
      match && suggestions.length > 0 && jsxs("div", {
        className: "absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 text-right shadow-2xl shadow-black/40 backdrop-blur-xl",
        role: "listbox",
        "aria-label": (match as any).kind === "vocabulary" ? "اقتراحات القاموس" : "اقتراحات الوسوم",
        dir: "rtl",
        children: [
          jsxs("div", {
            className: "flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2",
            children: [
              jsxs("span", {
                className: "flex items-center gap-1.5 text-xs text-gray-400",
                children: [
                  (match as any).kind === "vocabulary" ? jsx(BookOpen, { className: "h-3.5 w-3.5 va-accent-text" }) : jsx(Hash, { className: "h-3.5 w-3.5 text-amber-400" }),
                  (match as any).kind === "vocabulary" ? "الفريق ومصطلحات القاموس" : "الوسوم الهرمية والمستخدمة"
                ]
              }),
              jsx("kbd", { className: "rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-gray-500", children: "Enter" })
            ]
          }),
          jsx("div", {
            className: "custom-scrollbar max-h-72 overflow-y-auto py-1",
            children: groupedSuggestions.map((group: any) => jsxs("div", {
              children: [
                jsx("div", { className: "px-3 py-1 text-xs font-medium text-gray-500", children: group.label }),
                group.items.map((suggestion: any) => {
                  const globalIndex = suggestions.indexOf(suggestion);
                  const highlighted = highlightedIndex === globalIndex;
                  return jsxs("button", {
                    type: "button",
                    role: "option",
                    "aria-selected": highlighted,
                    onMouseDown: (event: any) => event.preventDefault(),
                    onClick: () => selectSuggestion(suggestion),
                    className: `flex w-full items-start gap-2 px-3 py-2 text-right text-sm transition-colors ${
                      highlighted ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-300 hover:bg-white/5"
                    }`,
                    children: [
                      suggestion.kind === "users" ? jsx(UserRound, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" }) : suggestion.color && jsx("span", {
                        className: "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                        style: { backgroundColor: suggestion.color }
                      }),
                      jsxs("span", {
                        className: "min-w-0",
                        children: [
                          jsx("span", { className: "block truncate font-medium", children: suggestion.label }),
                          suggestion.detail && jsx("span", { className: "block truncate text-xs text-gray-500", children: suggestion.detail }),
                          suggestion.meta && jsx("span", { className: "block truncate text-[11px] text-gray-600", children: suggestion.meta })
                        ]
                      })
                    ]
                  }, suggestion.id);
                })
              ]
            }, group.label))
          })
        ]
      })
    ]
  });
}

TagAutocomplete.displayName = "TagAutocomplete";
TagAutocomplete.componentId = "tag-autocomplete";
TagAutocomplete.migrationStatus = "native";

export default TagAutocomplete;
