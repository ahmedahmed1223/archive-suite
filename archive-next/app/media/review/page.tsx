"use client";

import { useEffect, useState } from "react";
import type { ReviewComment } from "@/lib/archive-api";
import { createArchiveApiClient } from "@/lib/archive-api";

export default function ReviewPage() {
  const [mediaUid, setMediaUid] = useState("media-123");
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [body, setBody] = useState("");
  const [timecode, setTimecode] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const api = createArchiveApiClient();

  useEffect(() => {
    if (!mediaUid) return;
    fetchComments();
  }, [mediaUid]);

  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.reviewComments(mediaUid);
      if (result.ok) {
        setComments(result.comments);
        setIsAuthenticated(true);
      } else {
        if ((result as any).ok === false) {
          setIsAuthenticated(false);
        }
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch comments");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    try {
      const result = await api.createReviewComment(
        mediaUid,
        { body: body.trim(), timecodeSeconds: timecode }
      );
      if (result.ok) {
        setComments((prev) => [...prev, result.comment].sort((a, b) => a.timecodeSeconds - b.timecodeSeconds));
        setBody("");
        setTimecode(0);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const handleToggleResolved = async (commentId: string, currentResolved: boolean) => {
    try {
      const result = await api.updateReviewComment(
        commentId,
        { resolved: !currentResolved }
      );
      if (result.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? result.comment : c))
        );
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment");
    }
  };

  if (!isAuthenticated && comments.length === 0 && error?.includes("Unauthorized")) {
    return <div className="p-4 text-center">Please log in to view review comments.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Visual Review Comments</h1>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium mb-2">Media UID</label>
        <input
          type="text"
          value={mediaUid}
          onChange={(e) => setMediaUid(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Enter media UID"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleAddComment} className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold mb-3">Add Comment</h2>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Timecode (seconds)</label>
          <input
            type="number"
            value={timecode}
            onChange={(e) => setTimecode(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Comment</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter your comment"
            rows={3}
          />
        </div>
        <button
          type="submit"
          disabled={!body.trim() || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400"
        >
          {loading ? "Adding..." : "Add Comment"}
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Comments ({comments.length})
        </h2>
        {comments.length === 0 ? (
          <p className="text-gray-500 text-sm">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg border ${
                comment.resolved
                  ? "bg-gray-50 border-gray-200"
                  : "bg-white border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {comment.author} @ {comment.timecodeSeconds.toFixed(1)}s
                  </div>
                  <p className={comment.resolved ? "text-gray-500 line-through text-sm" : "text-gray-700 text-sm"}>
                    {comment.body}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleResolved(comment.id, comment.resolved)}
                  className={`ml-2 px-2 py-1 text-xs rounded ${
                    comment.resolved
                      ? "bg-gray-200 text-gray-700"
                      : "bg-green-200 text-green-700"
                  }`}
                >
                  {comment.resolved ? "Unresolve" : "Resolve"}
                </button>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
