"use client";

import { useEffect, useRef, useState } from "react";
import MediaPlayer from "@/components/MediaPlayer";
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
  const [useCurrentTime, setUseCurrentTime] = useState(true);

  const playerRef = useRef<HTMLMediaElement | null>(null);
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

    // Use current playback time if enabled and player is ready
    const commentTimecode = useCurrentTime && playerRef.current
      ? Math.round(playerRef.current.currentTime * 100) / 100
      : timecode;

    try {
      const result = await api.createReviewComment(
        mediaUid,
        { body: body.trim(), timecodeSeconds: commentTimecode }
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

  const handleSeekToComment = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = seconds;
      playerRef.current.play();
    }
  };

  const formatTimecode = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isAuthenticated && comments.length === 0 && error?.includes("Unauthorized")) {
    return <div className="p-4 text-center">Please log in to view review comments.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Visual Review</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Media player and input */}
        <div className="col-span-2 space-y-6">
          {/* Media path input */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium mb-2">Archive File Path</label>
            <input
              type="text"
              value={mediaUid}
              onChange={(e) => setMediaUid(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g., /archive/media/file.mp4"
            />
            <p className="text-xs text-gray-500 mt-1">Also used as the review session UID</p>
          </div>

          {/* Media player */}
          {mediaUid && (
            <MediaPlayer
              path={mediaUid}
              title="Media under review"
              onReady={(el) => {
                playerRef.current = el;
              }}
            />
          )}

          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-lg font-semibold mb-3">Add Comment</h2>

            <div className="mb-3 flex gap-2">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={useCurrentTime}
                  onChange={(e) => setUseCurrentTime(e.target.checked)}
                  className="mr-2"
                />
                Use current playback time
              </label>
            </div>

            {!useCurrentTime && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Timecode (seconds)</label>
                <input
                  type="number"
                  value={timecode}
                  onChange={(e) => setTimecode(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Comment</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Enter your comment"
                rows={3}
              />
            </div>

            <button
              type="submit"
              disabled={!body.trim() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400 text-sm"
            >
              {loading ? "Adding..." : "Add Comment"}
            </button>
          </form>
        </div>

        {/* Right: Comments panel */}
        <div className="col-span-1 space-y-3">
          <h2 className="text-lg font-semibold">
            Comments ({comments.length})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-gray-500 text-sm">No comments yet</p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                    comment.resolved
                      ? "bg-gray-50 border-gray-200"
                      : "bg-white border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => handleSeekToComment(comment.timecodeSeconds)}
                      className="font-mono text-blue-600 hover:underline text-xs font-semibold"
                    >
                      {formatTimecode(comment.timecodeSeconds)}
                    </button>
                    <button
                      onClick={() => handleToggleResolved(comment.id, comment.resolved)}
                      className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                        comment.resolved
                          ? "bg-gray-200 text-gray-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {comment.resolved ? "✓" : "○"}
                    </button>
                  </div>
                  <p className={comment.resolved ? "text-gray-500 line-through text-xs" : "text-gray-700 text-xs"}>
                    {comment.body}
                  </p>
                  <div className="text-xs text-gray-400 mt-1">
                    {comment.author}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
