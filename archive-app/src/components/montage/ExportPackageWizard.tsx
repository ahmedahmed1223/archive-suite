import * as React from "react";
import {
  ArrowRight,
  ArrowLeft,
  Download,
  FileJson,
  Film,
  ListVideo,
  FileText,
  Image,
  Mic,
  Package
} from "lucide-react";
import { DialogV2 } from "../ui/DialogV2.jsx";
import { buildProjectDeliveryPackage } from "../../features/projects/viewModel.js";

/**
 * ExportPackageWizard — 2-step export dialog.
 *
 * Step 1: Review package contents with toggleable inclusions and estimated
 *         size summary derived from buildProjectDeliveryPackage.
 * Step 2: Choose output format, confirm output name, trigger export.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   project: object,
 *   items: object[],
 *   itemsById: Map,
 *   onExport: (kind: string, options: object) => void
 * }} props
 */
export function ExportPackageWizard({ open, onClose, project, items, itemsById, onExport }: any) {
  const [step, setStep] = React.useState(1);
  const [outputName, setOutputName] = React.useState("");
  const [format, setFormat] = React.useState("json");
  const [inclusions, setInclusions] = React.useState({
    edl: true,
    json: true,
    proxyVideos: true,
    originalFiles: false,
    transcripts: true,
    thumbnails: true
  });

  // Derive package info from the project
  const pkg = React.useMemo(() => {
    if (!project) return null;
    return buildProjectDeliveryPackage(project, itemsById || new Map());
  }, [project, itemsById]);

  // Reset state whenever the dialog opens
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setFormat("json");
      setOutputName(project?.name || "مشروع");
      setInclusions({
        edl: true,
        json: true,
        proxyVideos: true,
        originalFiles: false,
        transcripts: true,
        thumbnails: true
      });
    }
  }, [open, project?.name]);

  const toggleInclusion = (key: any) =>
    setInclusions((prev: any) => ({ ...prev, [key]: !prev[key] }));

  const sourceCount = pkg?.sources?.length || 0;
  const clipCount = pkg?.timeline?.clips?.length || 0;

  // Very rough size estimate (indicative only, not real file sizes)
  function estimateSize() {
    let mb = 0;
    if (inclusions.json) mb += 0.1;
    if (inclusions.edl) mb += 0.05;
    if (inclusions.thumbnails) mb += sourceCount * 0.2;
    if (inclusions.transcripts) mb += sourceCount * 0.05;
    if (inclusions.proxyVideos) mb += clipCount * 50;
    if (inclusions.originalFiles) mb += clipCount * 500;
    if (mb >= 1000) return `~${(mb / 1000).toFixed(1)} GB`;
    return `~${Math.round(mb)} MB`;
  }

  const INCLUSION_ITEMS = [
    { key: "edl", label: "ملف EDL", description: "قائمة قرارات التحرير (CMX3600)", icon: ListVideo },
    { key: "json", label: "ملف JSON", description: "بيانات الخط الزمني الكاملة", icon: FileJson },
    { key: "proxyVideos", label: "نسخ Proxy", description: "ملفات فيديو منخفضة الجودة للمراجعة", icon: Film },
    { key: "originalFiles", label: "الملفات الأصلية", description: "ملفات المصدر عالية الجودة", icon: Film },
    { key: "transcripts", label: "التفريغات", description: "نصوص الحوار والتعليق المرفقة", icon: Mic },
    { key: "thumbnails", label: "الصور المصغّرة", description: "صور preview لكل عنصر", icon: Image }
  ];

  const FORMAT_OPTIONS = [
    { value: "edl", label: "EDL", description: "للاستخدام في Premiere / Resolve / FCP" },
    { value: "json", label: "JSON", description: "بيانات الخط الزمني الكاملة" },
    { value: "mp4", label: "MP4", description: "فيديو مُدمج جاهز للمشاركة" },
    { value: "all", label: "الكل", description: "EDL + JSON + حزمة التسليم" }
  ];

  const handleExport = () => {
    onExport?.(format, { name: outputName.trim() || project?.name || "مشروع", inclusions });
    onClose?.();
  };

  const stepTitle = step === 1 ? "محتويات الحزمة" : "وجهة التصدير";

  return (
    <DialogV2
      open={open}
      onClose={onClose}
      title={`معالج التصدير — ${stepTitle}`}
      description={`الخطوة ${step} من 2`}
      className="max-w-xl"
    >
      {step === 1 ? (
        <Step1Contents
          pkg={pkg}
          inclusions={inclusions}
          onToggle={toggleInclusion}
          inclusionItems={INCLUSION_ITEMS}
          estimatedSize={estimateSize()}
          sourceCount={sourceCount}
          clipCount={clipCount}
        />
      ) : (
        <Step2Destination
          format={format}
          onFormatChange={setFormat}
          formatOptions={FORMAT_OPTIONS}
          outputName={outputName}
          onOutputNameChange={setOutputName}
          projectName={project?.name}
        />
      )}

      {/* Wizard footer */}
      <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--va-border-soft)] pt-4">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm"
        >
          إلغاء
        </button>

        <div className="flex items-center gap-2">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-ghost btn-sm gap-2"
              aria-label="العودة للخطوة السابقة"
            >
              <ArrowRight className="h-4 w-4" />
              رجوع
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn btn-primary btn-sm gap-2"
              aria-label="المتابعة لخطوة وجهة التصدير"
            >
              التالي
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExport}
              className="btn btn-primary btn-sm gap-2"
              aria-label="تصدير الحزمة"
            >
              <Download className="h-4 w-4" />
              تصدير الحزمة
            </button>
          )}
        </div>
      </div>
    </DialogV2>
  );
}

ExportPackageWizard.displayName = "ExportPackageWizard";

// ── Step 1 — Package Contents ─────────────────────────────────────────────────

function Step1Contents({
  pkg,
  inclusions,
  onToggle,
  inclusionItems,
  estimatedSize,
  sourceCount,
  clipCount
}: any) {
  return (
    <div dir="rtl" className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center">
          <p className="font-bold text-[var(--va-text)]">{clipCount}</p>
          <p className="text-[var(--va-text-muted)]">قصاصة</p>
        </div>
        <div className="rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center">
          <p className="font-bold text-[var(--va-text)]">{sourceCount}</p>
          <p className="text-[var(--va-text-muted)]">مصدر</p>
        </div>
        <div className="rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center">
          <p className="font-bold text-[var(--va-text)]">{estimatedSize}</p>
          <p className="text-[var(--va-text-muted)]">تقديري</p>
        </div>
      </div>

      {/* Checklist */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold text-[var(--va-text-muted)]">اختر المحتويات المراد تضمينها</legend>
        {inclusionItems.map(({ key, label, description, icon: Icon }: any) => (
          <label
            key={key}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
              inclusions[key]
                ? "va-accent-border va-accent-bg-soft"
                : "border-[var(--va-border-soft)] bg-[var(--va-surface)] hover:border-[var(--va-border-soft)]"
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(inclusions[key])}
              onChange={() => onToggle(key)}
              className="checkbox checkbox-sm"
              aria-label={label}
            />
            <Icon className={`h-4 w-4 shrink-0 ${inclusions[key] ? "va-accent-text" : "text-[var(--va-text-muted)]"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--va-text)]">{label}</p>
              <p className="text-xs text-[var(--va-text-muted)]">{description}</p>
            </div>
          </label>
        ))}
      </fieldset>

      {/* Package version badge */}
      {pkg?.version && (
        <p className="text-right text-[10px] text-[var(--va-text-muted)]">
          صيغة الحزمة: {pkg.version}
        </p>
      )}
    </div>
  );
}

// ── Step 2 — Destination ──────────────────────────────────────────────────────

function Step2Destination({
  format,
  onFormatChange,
  formatOptions,
  outputName,
  onOutputNameChange,
  projectName
}: any) {
  const nameId = React.useId();

  return (
    <div dir="rtl" className="space-y-4">
      {/* Format selector */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold text-[var(--va-text-muted)]">صيغة التصدير</legend>
        <div className="grid grid-cols-2 gap-2">
          {formatOptions.map((option: any) => (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col rounded-xl border p-3 transition-colors ${
                format === option.value
                  ? "va-accent-border va-accent-bg-soft"
                  : "border-[var(--va-border-soft)] bg-[var(--va-surface)] hover:border-[var(--va-border-soft)]"
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value={option.value}
                checked={format === option.value}
                onChange={() => onFormatChange(option.value)}
                className="sr-only"
                aria-label={option.label}
              />
              <span className={`text-sm font-semibold ${format === option.value ? "va-accent-text" : "text-[var(--va-text)]"}`}>
                {option.label}
              </span>
              <span className="mt-0.5 text-[11px] text-[var(--va-text-muted)]">{option.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Output name */}
      <div className="space-y-1">
        <label htmlFor={nameId} className="block text-xs font-semibold text-[var(--va-text-muted)]">
          اسم الملف
        </label>
        <input
          id={nameId}
          value={outputName}
          onChange={(e: any) => onOutputNameChange(e.target.value)}
          placeholder={projectName || "اسم المشروع"}
          className="input input-bordered w-full"
          aria-label="اسم ملف التصدير"
        />
        <p className="text-[11px] text-[var(--va-text-muted)]">
          سيُستخدم هذا الاسم للملف أو الحزمة المُصدَّرة.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-2 text-xs text-[var(--va-text-muted)]">
        <Package className="h-4 w-4 shrink-0 va-accent-text" />
        <span>
          سيتم تصدير الحزمة بصيغة <strong className="text-[var(--va-text)]">{format.toUpperCase()}</strong> باسم <strong className="text-[var(--va-text)]">"{outputName || projectName}"</strong>.
        </span>
      </div>
    </div>
  );
}
