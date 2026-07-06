"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import MetricStrip, { type MetricStripItem } from "@/components/MetricStrip";

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

/* ── Statistics data ── */
const homeMetrics: MetricStripItem[] = [
  { label: "إجمالي العناصر", value: "12,486", description: "+324 هذا الشهر", icon: <IconArchive />, tone: "accent" },
  { label: "المساحة المستخدمة", value: "48.2 TB", description: "من أصل 64 TB", icon: <IconCollections />, tone: "info" },
  { label: "رفعات هذا الأسبوع", value: "186", description: "+12% عن الأسبوع الماضي", icon: <IconReports />, tone: "success" },
  { label: "قيد المعالجة", value: "23", description: "3 بانتظار المراجعة", icon: <IconTasks />, tone: "warning" },
  { label: "مشاركات نشطة", value: "58", description: "9 روابط تنتهي هذا الأسبوع", icon: <IconShare />, tone: "default" },
  { label: "الوسوم", value: "342", description: "27 وسماً جديداً هذا الشهر", icon: <IconTag />, tone: "default" },
];

const monthlyActivity = [
  { month: "يوليو", value: 42 },
  { month: "أغسطس", value: 58 },
  { month: "سبتمبر", value: 51 },
  { month: "أكتوبر", value: 74 },
  { month: "نوفمبر", value: 68 },
  { month: "ديسمبر", value: 92 },
  { month: "يناير", value: 85 },
  { month: "فبراير", value: 110 },
  { month: "مارس", value: 96 },
  { month: "أبريل", value: 128 },
  { month: "مايو", value: 118 },
  { month: "يونيو", value: 142 },
];

const typeDistribution = [
  { label: "فيديو", value: 6240, color: "var(--color-amber)" },
  { label: "صوت", value: 3120, color: "var(--color-brand-indigo)" },
  { label: "صورة", value: 2350, color: "var(--color-status-success)" },
  { label: "مستند", value: 776, color: "var(--color-silver-muted)" },
];

const storageSegments = [
  { label: "وسائط", value: 34.6, color: "var(--color-amber)" },
  { label: "نسخ احتياطية", value: 9.8, color: "var(--color-brand-indigo)" },
  { label: "أخرى", value: 3.8, color: "var(--color-silver-muted)" },
];
const storageCapacityTb = 64;

/* ── Chart components (pure SVG, no deps) ── */
function ActivityAreaChart() {
  const w = 560;
  const h = 190;
  const padX = 10;
  const padTop = 14;
  const padBottom = 26;
  const max = Math.max(...monthlyActivity.map((d) => d.value));
  const points = monthlyActivity.map((d, i) => ({
    x: padX + (i * (w - padX * 2)) / (monthlyActivity.length - 1),
    y: padTop + (1 - d.value / max) * (h - padTop - padBottom),
    label: d.month,
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${points[points.length - 1].x},${h - padBottom} L${points[0].x},${h - padBottom} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="cd-chart__svg" role="img" aria-label="نشاط الأرشفة الشهري">
      <defs>
        <linearGradient id="cdAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(212, 148, 58, 0.35)" />
          <stop offset="100%" stopColor="rgba(212, 148, 58, 0)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={w - padX}
          y1={padTop + t * (h - padTop - padBottom)}
          y2={padTop + t * (h - padTop - padBottom)}
          stroke="var(--color-border-primary)"
          strokeDasharray="3 5"
        />
      ))}
      <path d={area} fill="url(#cdAreaFill)" />
      <path d={line} fill="none" stroke="var(--color-amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="4.5" fill="var(--color-amber)" stroke="var(--color-anthracite-light)" strokeWidth="2" />
      {points.filter((_, i) => i % 2 === 0).map((p) => (
        <text key={p.label} x={p.x} y={h - 6} textAnchor="middle" fill="var(--color-silver-dim)" fontSize="12.5">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function TypeBarChart() {
  const max = Math.max(...typeDistribution.map((d) => d.value));
  return (
    <div className="cd-bars" role="img" aria-label="توزيع أنواع الوسائط">
      {typeDistribution.map((item, i) => (
        <div className="cd-bars__row" key={item.label}>
          <span className="cd-bars__label">{item.label}</span>
          <div className="cd-bars__track">
            <motion.div
              className="cd-bars__fill"
              style={{ background: item.color }}
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
            />
          </div>
          <span className="cd-bars__value">{item.value.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

function StorageDonut() {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const used = storageSegments.reduce((sum, s) => sum + s.value, 0);
  const usedPct = Math.round((used / storageCapacityTb) * 100);
  let offset = 0;

  return (
    <div className="cd-donut">
      <svg viewBox="0 0 140 140" className="cd-donut__svg" role="img" aria-label={`استخدام التخزين ${usedPct}%`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-anthracite-surface)" strokeWidth="14" />
        {storageSegments.map((seg) => {
          const len = (seg.value / storageCapacityTb) * circumference;
          const el = (
            <circle
              key={seg.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="67" textAnchor="middle" fill="var(--color-silver)" fontSize="27" fontWeight="700">
          {usedPct}%
        </text>
        <text x="70" y="86" textAnchor="middle" fill="var(--color-silver-dim)" fontSize="11.5">
          {used.toFixed(1)} / {storageCapacityTb} TB
        </text>
      </svg>
      <ul className="cd-donut__legend">
        {storageSegments.map((seg) => (
          <li key={seg.label}>
            <span className="cd-donut__swatch" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <span className="cd-donut__amount">{seg.value} TB</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

        {/* ── Statistics Overview ── */}
        <motion.section
          className="cd-stats"
          aria-label="إحصائيات الأرشيف"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <MetricStrip items={homeMetrics} ariaLabel="مؤشرات الأرشيف" />

          <div className="cd-stats__charts">
            <div className="cd-chart cd-chart--area">
              <h3><IconReports /> نشاط الأرشفة الشهري</h3>
              <ActivityAreaChart />
            </div>
            <div className="cd-chart cd-chart--bars">
              <h3><IconCollections /> توزيع أنواع الوسائط</h3>
              <TypeBarChart />
            </div>
            <div className="cd-chart cd-chart--donut">
              <h3><IconArchive /> استخدام التخزين</h3>
              <StorageDonut />
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
