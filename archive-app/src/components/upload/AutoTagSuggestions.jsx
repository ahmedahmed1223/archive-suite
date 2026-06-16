/**
 * AutoTagSuggestions — shows AI-suggested tags after typing title/summary.
 * Non-blocking: loads async, can be accepted or dismissed tag by tag.
 *
 * Props:
 *   name        {string}   - current title/name field value
 *   summary     {string}   - current notes/description field value
 *   categories  {Array}    - available content-type categories ({ id, name })
 *   onAccept    {Function} - called with a single tag string when user accepts it
 *   authToken   {string}   - Bearer JWT; omit when running without auth
 */
import { useState, useEffect, useRef } from "react";

export function AutoTagSuggestions({ name = "", summary = "", categories = [], onAccept, authToken }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const hasEnough = name.length >= 10 || summary.length >= 20;
    if (!hasEnough) {
      setTags([]);
      return undefined;
    }

    const controller = new AbortController();

    // Debounce: wait 800 ms after user stops typing before firing the request.
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = { "Content-Type": "application/json" };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        const r = await fetch("/api/ai/suggest-tags", {
          method: "POST",
          headers,
          body: JSON.stringify({ name, summary, categories }),
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        setTags(data.tags ?? []);
      } catch (err) {
        if (err.name !== "AbortError") setError("تعذّر تحميل الاقتراحات");
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => {
      clearTimeout(timerRef.current);
      controller.abort();
    };
  }, [name, summary]);

  const accept = (tag) => {
    onAccept?.(tag);
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const dismiss = (tag) => setTags((prev) => prev.filter((t) => t !== tag));

  if (!loading && tags.length === 0 && !error) return null;

  return (
    <div className="mt-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700/60">
      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
        ✨ وسوم مقترحة
        {loading && <span className="animate-pulse">•••</span>}
      </p>
      {error && <p role="alert" className="alert alert-warning alert-sm block bg-transparent border-0 p-0 text-xs text-orange-400">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-emerald-700/60 bg-emerald-900/20 text-emerald-300"
          >
            {tag}
            <button
              onClick={() => accept(tag)}
              aria-label={`قبول ${tag}`}
              className="text-emerald-400 hover:text-white ml-0.5 leading-none"
            >✓</button>
            <button
              onClick={() => dismiss(tag)}
              aria-label={`رفض ${tag}`}
              className="text-gray-500 hover:text-red-400 leading-none"
            >×</button>
          </span>
        ))}
        {tags.length > 1 && (
          <button
            onClick={() => { tags.forEach((t) => onAccept?.(t)); setTags([]); }}
            className="px-2 py-0.5 rounded-full text-xs bg-emerald-800/30 text-emerald-400 hover:bg-emerald-700/30 border border-emerald-700/40"
          >
            قبول الكل
          </button>
        )}
      </div>
    </div>
  );
}

export default AutoTagSuggestions;
