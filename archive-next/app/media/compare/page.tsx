"use client";

import { useCallback, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import MediaSourcePicker from "@/components/MediaSourcePicker";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import PageToolbar from "@/components/PageToolbar";
import styles from "./compare.module.css";
import "../media.css";

type SyncMode = "off" | "on";

const TIME_THRESHOLD = 0.3;

export default function ComparePage() {
  const [pathA, setPathA] = useState("");
  const [pathB, setPathB] = useState("");
  const [syncMode, setSyncMode] = useState<SyncMode>("off");

  const playerARef = useRef<HTMLMediaElement | null>(null);
  const playerBRef = useRef<HTMLMediaElement | null>(null);
  const isSyncingRef = useRef(false);

  const syncTime = useCallback((source: HTMLMediaElement | null, target: HTMLMediaElement | null) => {
    if (syncMode === "off" || isSyncingRef.current || !source || !target) return;
    if (Math.abs(source.currentTime - target.currentTime) <= TIME_THRESHOLD) return;

    isSyncingRef.current = true;
    target.currentTime = source.currentTime;
    isSyncingRef.current = false;
  }, [syncMode]);

  const syncPlayback = useCallback((source: HTMLMediaElement | null, target: HTMLMediaElement | null) => {
    if (syncMode === "off" || isSyncingRef.current || !source || !target) return;

    isSyncingRef.current = true;
    if (source.paused) {
      target.pause();
    } else {
      target.play().catch(() => undefined);
    }
    isSyncingRef.current = false;
  }, [syncMode]);

  const isValidPaths = pathA.trim() && pathB.trim();

  return (
    <AppShell subtitle="مقارنة الوسائط" contentClassName={styles.compareContent} tipsPage="media-compare">
      <PageToolbar
        eyebrow={<span className="badge">Side-by-side</span>}
        title="مقارنة الوسائط"
        description="ضع نسختين من المادة جنباً إلى جنب، ثم فعّل المزامنة لمطابقة التشغيل والإيقاف والانتقال الزمني أثناء المراجعة."
        meta={(
          <>
            <span className={`badge ${styles.statusIndicator}`} data-status={syncMode === "on" ? "viewing" : "idle"}>
              {syncMode === "on" ? "المزامنة مفعلة" : "المزامنة متوقفة"}
            </span>
            <span className="badge">{isValidPaths ? "جاهز للتشغيل" : "بانتظار مسارين"}</span>
          </>
        )}
      >
        <form className={`auth-form ${styles.pathInputForm}`} aria-label="مسارات المقارنة">
          <div className={`media-compare-grid ${styles.pathInputGrid}`}>
            <label>
              مسار الملف أ
              <input
                type="text"
                value={pathA}
                onChange={(event) => setPathA(event.target.value)}
                placeholder="media/file-a.mp4"
                aria-label="مسار الملف أ"
              />
            </label>
            <MediaSourcePicker label="تصفح الملف أ" onSelect={setPathA} />
            <label>
              مسار الملف ب
              <input
                type="text"
                value={pathB}
                onChange={(event) => setPathB(event.target.value)}
                placeholder="media/file-b.mp4"
                aria-label="مسار الملف ب"
              />
            </label>
            <MediaSourcePicker label="تصفح الملف ب" onSelect={setPathB} />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={syncMode === "on"}
              onChange={(event) => setSyncMode(event.target.checked ? "on" : "off")}
            />
            مزامنة التشغيل بين الملفين
          </label>
        </form>
      </PageToolbar>

      <OperationalSafetyPanel action="مقارنة النسختين" dryRun confidence={92} auditHref="/activity" />

      {isValidPaths ? (
        <div className={`media-compare-grid ${styles.playersGrid}`} aria-label="مشغلات المقارنة">
          <article className={`panel ${styles.playerPanel}`}>
            <div className={`panel-title-row ${styles.playerHeader}`}>
              <h2>الملف أ</h2>
              <span className={`badge ${styles.sideBadge}`}>A</span>
            </div>
            <MediaPlayer
              path={pathA}
              onReady={(el) => {
                playerARef.current = el;
              }}
              onPlayPause={(el) => syncPlayback(el, playerBRef.current)}
              onTimeUpdate={(el) => syncTime(el, playerBRef.current)}
            />
          </article>

          <article className={`panel ${styles.playerPanel}`}>
            <div className={`panel-title-row ${styles.playerHeader}`}>
              <h2>الملف ب</h2>
              <span className={`badge ${styles.sideBadge}`}>B</span>
            </div>
            <MediaPlayer
              path={pathB}
              onReady={(el) => {
                playerBRef.current = el;
              }}
              onPlayPause={(el) => syncPlayback(el, playerARef.current)}
              onTimeUpdate={(el) => syncTime(el, playerARef.current)}
            />
          </article>
        </div>
      ) : (
        <EmptyState
          title="أدخل مساري الملفات لبدء المقارنة."
          description="حدّد مسار كل ملف نسبي داخل الأرشيف، ثم فعّل المزامنة إن أردت تشغيلاً متطابقاً."
        />
      )}
    </AppShell>
  );
}
