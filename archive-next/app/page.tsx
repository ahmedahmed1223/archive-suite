"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ── Sidebar nav items matching the comp exactly ── */
const sidebarNav: Array<{ id: string; label: string; active?: boolean; href?: string }> = [
  { id: "archive", label: "الأرشيف", active: true },
  { id: "search", label: "البحث", href: "/search" },
  { id: "collections", label: "المجموعات", href: "/collections" },
  { id: "tags", label: "العلامات", href: "/tags" },
  { id: "shares", label: "المشاركات", href: "/shares" },
  { id: "tasks", label: "المهام", href: "/kanban" },
  { id: "reports", label: "التقارير", href: "/reports" },
  { id: "settings", label: "الإعدادات", href: "/settings" },
  { id: "help", label: "مساعدة", href: "/help" },
];

/* ── Media items matching the comp ── */
const recentMedia: Array<{ id: string; title: string; duration: string; date: string; thumb: number; isAudio?: boolean }> = [
  { id: "1", title: "لقطة_جوية_01.mp4", duration: "01:55", date: "20 مايو، 11:47", thumb: 0 },
  { id: "2", title: "موسيقى_تصوير.wav", duration: "02:45", date: "20 مايو، 19:08", thumb: 1, isAudio: true },
  { id: "3", title: "مدينة_ليلية.mov", duration: "03:11", date: "22:31", thumb: 2 },
  { id: "4", title: "لقطة_مقربة_02.mp4", duration: "00:37", date: "أمس، 13:15", thumb: 3 },
  { id: "5", title: "كواليس_اليوم_2.mov", duration: "01:08", date: "أمس، 16:44", thumb: 4 },
  { id: "6", title: "صحراء_واسعة.mov", duration: "05:42", date: "أمس، 18:07", thumb: 5 },
  { id: "7", title: "ديكور_ليل.mp4", duration: "02:15", date: "اليوم، 10:21", thumb: 6 },
];

/* ── Table data matching the comp ── */
const tableData = [
  { id: "1", title: "مشهد_ليلي_01.", icon: "video", type: "فيديو", size: "2.35 GB", date: "2024-05-21 10:21:33", status: "متاح", statusType: "success" as const },
  { id: "2", title: "كواليس_اليوم_02.", icon: "video", type: "فيديو", size: "1.12 GB", date: "2024-05-21 09:18:05", status: "مكتمل", statusType: "success" as const },
  { id: "3", title: "مشهد_نهاري_03.", icon: "video", type: "فيديو", size: "4.78 GB", date: "2024-05-21 02:44:19", status: "قيد المعالجة", statusType: "warning" as const },
  { id: "4", title: "موسيقى_تصوير", icon: "audio", type: "صوت", size: "865 MB", date: "2024-05-20 19:08:11", status: "متاح", statusType: "success" as const },
  { id: "5", title: "لقطة_جوية_01", icon: "video", type: "فيديو", size: "3.22 GB", date: "2024-05-20 11:47:02", status: "مؤرشف", statusType: "info" as const },
  { id: "6", title: "ملصق_فيلم_v02", icon: "image", type: "صورة", size: "1.64 GB", date: "2024-05-19 21:36:55", status: "متاح", statusType: "success" as const },
];

/* ── SVG Icons ── */
function IconArchive() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconCollections() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function IconTasks() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 6h2v12h-2zm-10 0l8.5 6L6 18z" />
    </svg>
  );
}

function IconRewind() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 19l-7-7 7-7" />
      <text x="14" y="16" fill="currentColor" fontSize="8" fontWeight="bold" stroke="none">10</text>
    </svg>
  );
}

function IconForward() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 19l7-7-7-7" />
      <text x="3" y="16" fill="currentColor" fontSize="8" fontWeight="bold" stroke="none">10</text>
    </svg>
  );
}

function IconVolume() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function IconSubtitles() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="6" y1="16" x2="14" y2="16" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconNotification() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="15" height="16" rx="2" />
      <path d="M17 8l5-3v14l-5-3" />
    </svg>
  );
}

function IconAudio() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M12 10v4" />
      <path d="M10 12h4" />
    </svg>
  );
}

const sidebarIcons: Record<string, () => React.JSX.Element> = {
  archive: IconArchive,
  search: IconSearch,
  collections: IconCollections,
  tags: IconTag,
  shares: IconShare,
  tasks: IconTasks,
  reports: IconReports,
  settings: IconSettings,
  help: IconHelp,
};

function StatusIcon({ type }: { type: string }) {
  if (type === "success") return <span className="cd-status-dot cd-status-dot--success"><IconCheck /></span>;
  if (type === "warning") return <span className="cd-status-dot cd-status-dot--warning"><IconWarning /></span>;
  return <span className="cd-status-dot cd-status-dot--info"><IconArchive /></span>;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "audio") return <IconAudio />;
  if (type === "image") return <IconImage />;
  return <IconVideo />;
}

export default function CinematicDashboard() {
  const [selectedRow, setSelectedRow] = useState<string>("1");
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollMedia = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 240;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="cd-shell">
      {/* ── Right Sidebar ── */}
      <aside className="cd-sidebar" aria-label="التنقل الرئيسي">
        <nav className="cd-sidebar__nav">
          {sidebarNav.map((item, i) => {
            const Icon = sidebarIcons[item.id];
            return (
              <motion.a
                key={item.id}
                href={item.active ? "#" : item.href}
                className={`cd-sidebar__item ${item.active ? "cd-sidebar__item--active" : ""}`}
                title={item.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <span className="cd-sidebar__icon"><Icon /></span>
                <span className="cd-sidebar__label">{item.label}</span>
              </motion.a>
            );
          })}
        </nav>
      </aside>

      {/* ── Main Content ── */}
      <div className="cd-main">
        {/* ── Top Bar ── */}
        <motion.header
          className="cd-topbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="cd-topbar__brand">
            <span className="cd-topbar__logo">مسار</span>
            <span className="cd-topbar__logo-latin">Masar</span>
          </div>

          <nav className="cd-topbar__breadcrumb" aria-label="مسار التنقل">
            <a href="/">الرئيسية</a>
            <span className="cd-topbar__sep">&gt;</span>
            <span className="cd-topbar__current">الأرشيف</span>
            <button className="cd-topbar__back" aria-label="رجوع">
              <IconChevronLeft />
            </button>
          </nav>

          <div className="cd-topbar__search">
            <IconSearch />
            <span>ابحث في الأرشيف...</span>
          </div>

          <div className="cd-topbar__actions">
            <button className="cd-topbar__btn cd-topbar__btn--new" type="button">
              <IconPlus />
              <span>جديد</span>
            </button>
            <button className="cd-topbar__btn" type="button" aria-label="الإشعارات">
              <IconNotification />
            </button>
            <div className="cd-topbar__user">
              <img
                src="/brand/masar-mark.svg"
                alt=""
                width={32}
                height={32}
                className="cd-topbar__avatar"
              />
              <span>أحمد النجار</span>
              <IconChevronLeft />
            </div>
          </div>
        </motion.header>

        {/* ── Video Preview Area ── */}
        <motion.section
          className="cd-player"
          aria-label="معاينة الفيديو"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="cd-player__viewport">
            <img
              src="/images/hero-filmset.png"
              alt="مشهد تصوير سينمائي"
              className="cd-player__image"
              width={1536}
              height={768}
              fetchPriority="high"
            />
            <div className="cd-player__overlay">
              <div className="cd-player__badges">
                <span className="cd-player__badge">4K</span>
                <span className="cd-player__badge">UHD</span>
              </div>
              <div className="cd-player__title-row">
                <span className="cd-player__filename">مشهد_ليلي_01.mp4</span>
                <div className="cd-player__title-actions">
                  <button type="button" aria-label="مفضلة"><IconStar /></button>
                  <button type="button" aria-label="المزيد"><IconMore /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="cd-player__controls">
            <div className="cd-player__controls-right">
              <button
                className={`cd-player__play ${isPlaying ? "cd-player__play--active" : ""}`}
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? "إيقاف" : "تشغيل"}
              >
                <IconPlay />
              </button>
              <button type="button" className="cd-player__ctrl" aria-label="السابق"><IconPrev /></button>
              <button type="button" className="cd-player__ctrl" aria-label="التالي"><IconNext /></button>
              <button type="button" className="cd-player__ctrl" aria-label="تراجع 10 ثوان"><IconRewind /></button>
              <button type="button" className="cd-player__ctrl" aria-label="تقديم 10 ثوان"><IconForward /></button>
              <button type="button" className="cd-player__ctrl" aria-label="الصوت"><IconVolume /></button>
            </div>

            <div className="cd-player__timeline">
              <span className="cd-player__time cd-player__time--current">00:01:24:08</span>
              <span className="cd-player__time-sep">/</span>
              <span className="cd-player__time">00:03:18:12</span>
              <div className="cd-player__progress">
                <div className="cd-player__progress-track">
                  <div className="cd-player__progress-fill" style={{ width: "42%" }} />
                  <div className="cd-player__progress-handle" style={{ left: "42%" }} />
                </div>
              </div>
            </div>

            <div className="cd-player__controls-left">
              <button type="button" className="cd-player__ctrl" aria-label="الكاميرا"><IconCamera /></button>
              <button type="button" className="cd-player__ctrl" aria-label="الترجمة"><IconSubtitles /></button>
              <button type="button" className="cd-player__ctrl" aria-label="الإعدادات"><IconGear /></button>
              <button type="button" className="cd-player__ctrl" aria-label="ملء الشاشة"><IconFullscreen /></button>
            </div>
          </div>
        </motion.section>

        {/* ── Recent Media Strip ── */}
        <motion.section
          className="cd-recent"
          aria-label="العناصر الحديثة"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="cd-recent__header">
            <div className="cd-recent__title">
              <IconClock />
              <h2>العناصر الحديثة</h2>
            </div>
            <a href="/archive" className="cd-recent__viewall">
              <IconChevronRight />
              <span>عرض الكل</span>
            </a>
          </div>

          <div className="cd-recent__scroll-wrap">
            <button
              className="cd-recent__arrow cd-recent__arrow--right"
              type="button"
              onClick={() => scrollMedia("right")}
              aria-label="التالي"
            >
              <IconChevronRight />
            </button>

            <div className="cd-recent__strip" ref={scrollRef}>
              {recentMedia.map((item, i) => (
                <motion.article
                  key={item.id}
                  className="cd-media-card"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.05, duration: 0.35 }}
                >
                  <div className="cd-media-card__thumb">
                    {item.isAudio ? (
                      <div className="cd-media-card__waveform">
                        {Array.from({ length: 24 }).map((_, j) => (
                          <span
                            key={j}
                            className="cd-media-card__wave-bar"
                            style={{ height: `${20 + Math.random() * 60}%` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="cd-media-card__img-placeholder" data-index={item.thumb} />
                    )}
                    <span className="cd-media-card__duration">{item.duration}</span>
                  </div>
                  <div className="cd-media-card__info">
                    <span className="cd-media-card__name">{item.title}</span>
                    <span className="cd-media-card__date">{item.date}</span>
                  </div>
                </motion.article>
              ))}
            </div>

            <button
              className="cd-recent__arrow cd-recent__arrow--left"
              type="button"
              onClick={() => scrollMedia("left")}
              aria-label="السابق"
            >
              <IconChevronLeft />
            </button>
          </div>
        </motion.section>

        {/* ── Data Table ── */}
        <motion.section
          className="cd-table-section"
          aria-label="جدول الملفات"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th className="cd-table__th cd-table__th--title">العنوان</th>
                  <th className="cd-table__th">التاريخ</th>
                  <th className="cd-table__th">النوع</th>
                  <th className="cd-table__th">الحجم</th>
                  <th className="cd-table__th">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr
                    key={row.id}
                    className={`cd-table__row ${selectedRow === row.id ? "cd-table__row--selected" : ""}`}
                    onClick={() => setSelectedRow(row.id)}
                  >
                    <td className="cd-table__td cd-table__td--title">
                      <button type="button" className="cd-table__star" aria-label="مفضلة"><IconStar /></button>
                      <button type="button" className="cd-table__more" aria-label="المزيد"><IconMore /></button>
                      <StatusIcon type={row.statusType} />
                      <span className="cd-table__status-label">{row.status}</span>
                    </td>
                    <td className="cd-table__td">{row.date}</td>
                    <td className="cd-table__td">{row.type}</td>
                    <td className="cd-table__td">{row.size}</td>
                    <td className="cd-table__td cd-table__td--name">
                      <TypeIcon type={row.icon} />
                      <span>{row.title}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="cd-pagination">
            <div className="cd-pagination__info">عرض 1-6 من 326 عنصر</div>
            <div className="cd-pagination__controls">
              <button type="button" className="cd-pagination__btn" disabled><IconChevronRight /></button>
              <button type="button" className="cd-pagination__btn" disabled><IconChevronRight /></button>
              <button type="button" className="cd-pagination__page cd-pagination__page--active">1</button>
              <button type="button" className="cd-pagination__page">2</button>
              <button type="button" className="cd-pagination__page">3</button>
              <span className="cd-pagination__dots">...</span>
              <button type="button" className="cd-pagination__page">55</button>
              <button type="button" className="cd-pagination__btn"><IconChevronLeft /></button>
              <button type="button" className="cd-pagination__btn"><IconChevronLeft /></button>
            </div>
            <div className="cd-pagination__perpage">
              <span>عناصر لكل صفحة</span>
              <select defaultValue="25" className="cd-pagination__select">
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
