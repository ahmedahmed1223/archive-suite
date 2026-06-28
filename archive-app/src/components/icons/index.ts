import { jsx } from "react/jsx-runtime";
import type { CSSProperties, SyntheticEvent } from "react";
import {
  Archive,
  BookOpen,
  Database,
  FileSpreadsheet,
  Film,
  FolderOpen,
  LayoutGrid,
  Link,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Tags,
  Upload,
  Users,
  Video
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface IconSpecInput {
  type?: string;
  value?: string;
  color?: string;
  sourceName?: string;
  updatedAt?: string | number | null;
}

export interface IconSpec {
  type: "lucide" | "emoji" | "text" | "image" | "url";
  value: string;
  color?: string;
  sourceName?: string;
  updatedAt?: string | number | null;
}

export interface AppIconRegistryItem {
  id: string;
  label: string;
  category: string;
  icon: LucideIcon;
}

export interface RenderArchiveIconOptions {
  fallbackIcon?: string;
  color?: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}

export const APP_ICON_REGISTRY: AppIconRegistryItem[] = [
  { id: "folder-open", label: "مجلد", category: "تنظيم", icon: FolderOpen },
  { id: "archive", label: "أرشيف", category: "تنظيم", icon: Archive },
  { id: "video", label: "فيديو", category: "وسائط", icon: Video },
  { id: "film", label: "فيلم", category: "وسائط", icon: Film },
  { id: "tags", label: "وسوم", category: "تنظيم", icon: Tags },
  { id: "tag", label: "وسم", category: "تنظيم", icon: Tag },
  { id: "book-open", label: "قاموس", category: "معرفة", icon: BookOpen },
  { id: "database", label: "بيانات", category: "بيانات", icon: Database },
  { id: "file-spreadsheet", label: "Excel", category: "بيانات", icon: FileSpreadsheet },
  { id: "shield-check", label: "أمان", category: "أمان", icon: ShieldCheck },
  { id: "settings", label: "إعدادات", category: "نظام", icon: Settings },
  { id: "sparkles", label: "ذكي", category: "نظام", icon: Sparkles },
  { id: "star", label: "مفضل", category: "عرض", icon: Star },
  { id: "grid", label: "شبكة", category: "عرض", icon: LayoutGrid },
  { id: "search", label: "بحث", category: "عمل", icon: Search },
  { id: "upload", label: "استيراد", category: "عمل", icon: Upload },
  { id: "link", label: "رابط", category: "عمل", icon: Link },
  { id: "users", label: "مستخدمون", category: "إدارة", icon: Users }
];

export const ICON_PICKER_EMOJIS = ["📁", "🎬", "📺", "🎤", "🎭", "🎵", "📷", "🗂️", "📋", "⭐", "🔖", "💎", "🏆", "🎯", "📌", "🔐", "📊", "🧭"];

export function normalizeIconSpec(iconSpec: IconSpecInput | null | undefined, fallbackIcon = "📁"): IconSpec {
  if (iconSpec && typeof iconSpec === "object" && typeof iconSpec.type === "string") {
    const type = iconSpec.type;
    const value = typeof iconSpec.value === "string" ? iconSpec.value.trim() : "";

    if (value && ["lucide", "emoji", "text", "image", "url"].includes(type)) {
      return {
        type: type as IconSpec["type"],
        value,
        color: iconSpec.color,
        sourceName: iconSpec.sourceName || "",
        updatedAt: iconSpec.updatedAt || null
      };
    }
  }

  const fallback = typeof fallbackIcon === "string" && fallbackIcon.trim() ? fallbackIcon.trim() : "📁";
  return { type: "emoji", value: fallback };
}

export function getFallbackIconFromSpec(iconSpec: IconSpecInput | null | undefined, fallbackIcon = "📁") {
  const normalized = normalizeIconSpec(iconSpec, fallbackIcon);
  return ["emoji", "text"].includes(normalized.type) ? normalized.value : fallbackIcon;
}

export function renderArchiveIcon(
  iconSpec: IconSpecInput | null | undefined,
  {
    fallbackIcon = "📁",
    color = "#10b981",
    className = "h-5 w-5",
    imageClassName = "h-7 w-7 rounded-md object-cover",
    textClassName = "text-xl"
  }: RenderArchiveIconOptions = {}
) {
  const spec = normalizeIconSpec(iconSpec, fallbackIcon);

  if (spec.type === "lucide") {
    const registryItem = APP_ICON_REGISTRY.find((item) => item.id === spec.value) || APP_ICON_REGISTRY[0];
    const IconComponent = registryItem?.icon || FolderOpen;
    return jsx(IconComponent, { className, style: { color: spec.color || color } as CSSProperties });
  }

  if (spec.type === "image" || spec.type === "url") {
    return jsx("img", {
      src: spec.value,
      alt: "",
      className: imageClassName,
      onError: (event: SyntheticEvent<HTMLImageElement>) => {
        event.currentTarget.style.display = "none";
      }
    });
  }

  return jsx("span", { className: textClassName, children: spec.value || fallbackIcon });
}
