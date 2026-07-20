"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import type { MentionableUser } from "@/lib/archive-api";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  "aria-label"?: string;
}

// ponytail: fixed dropdown below the textarea, not caret-anchored — a caret-position
// popup needs measuring text metrics or a library; add if the flat layout ever feels wrong.
export default function MentionTextarea({ value, onChange, placeholder, rows = 4, id, "aria-label": ariaLabel }: MentionTextareaProps) {
  const [users, setUsers] = useState<MentionableUser[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    const api = createArchiveApiClient();
    api.mentionableUsers().then((response) => {
      if (!cancelled && response.ok) setUsers(response.users);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const normalized = query.trim().toLowerCase();
    const matches = normalized === "" ? users : users.filter((user) => user.name.toLowerCase().includes(normalized));
    return matches.slice(0, 6);
  }, [query, users]);

  function currentMentionMatch(text: string, cursor: number): RegExpMatchArray | null {
    return text.slice(0, cursor).match(/@([^\s@]*)$/);
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;
    onChange(nextValue);
    const cursor = event.target.selectionStart ?? nextValue.length;
    const match = currentMentionMatch(nextValue, cursor);
    setQuery(match ? match[1] : null);
  }

  function selectUser(user: MentionableUser) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const match = currentMentionMatch(value, cursor);
    const start = match ? cursor - match[0].length : cursor;
    const nextValue = `${value.slice(0, start)}@${user.name} ${value.slice(cursor)}`;
    onChange(nextValue);
    setQuery(null);

    const newCursor = start + user.name.length + 2;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(newCursor, newCursor);
    });
  }

  return (
    <div className="mention-textarea">
      <textarea
        ref={textareaRef}
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
      />
      {suggestions.length > 0 ? (
        <ul className="mention-suggestions" role="listbox" aria-label="اقتراحات الإشارة">
          {suggestions.map((user) => (
            <li key={user.id}>
              <button type="button" role="option" aria-selected="false" onClick={() => selectUser(user)}>
                {user.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
