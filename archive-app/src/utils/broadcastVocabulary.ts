/**
 * Structured Arabic broadcast media vocabulary.
 * Program types, genre classifications, and production roles
 * used in Arabic-language television/radio archives.
 */

export const BROADCAST_PROGRAM_TYPES = [
  { id: "news_bulletin", label: "نشرة إخبارية", en: "News Bulletin", category: "news" },
  { id: "news_report", label: "تقرير إخباري", en: "News Report", category: "news" },
  { id: "breaking_news", label: "خبر عاجل", en: "Breaking News", category: "news" },
  { id: "investigative", label: "تحقيق صحفي", en: "Investigative Report", category: "news" },
  { id: "live_coverage", label: "تغطية مباشرة", en: "Live Coverage", category: "news" },
  { id: "press_conference", label: "مؤتمر صحفي", en: "Press Conference", category: "news" },
  { id: "interview_studio", label: "مقابلة استوديو", en: "Studio Interview", category: "interview" },
  { id: "interview_field", label: "مقابلة ميدانية", en: "Field Interview", category: "interview" },
  { id: "interview_phone", label: "مقابلة هاتفية", en: "Phone Interview", category: "interview" },
  { id: "talk_show", label: "برنامج حواري", en: "Talk Show", category: "talk" },
  { id: "debate", label: "نقاش ومناظرة", en: "Debate", category: "talk" },
  { id: "panel_discussion", label: "ندوة وطاولة مستديرة", en: "Panel Discussion", category: "talk" },
  { id: "documentary", label: "وثائقي", en: "Documentary", category: "documentary" },
  { id: "short_documentary", label: "وثائقي قصير", en: "Short Documentary", category: "documentary" },
  { id: "news_feature", label: "فيلم تقريري", en: "News Feature", category: "documentary" },
  { id: "drama_series", label: "مسلسل درامي", en: "Drama Series", category: "drama" },
  { id: "tv_movie", label: "فيلم تلفزيوني", en: "TV Movie", category: "drama" },
  { id: "sitcom", label: "كوميديا موقفية", en: "Sitcom", category: "drama" },
  { id: "sports_match", label: "مباراة رياضية", en: "Sports Match", category: "sports" },
  { id: "sports_show", label: "برنامج رياضي", en: "Sports Show", category: "sports" },
  { id: "sports_analysis", label: "تحليل رياضي", en: "Sports Analysis", category: "sports" },
  { id: "cultural_show", label: "برنامج ثقافي", en: "Cultural Show", category: "culture" },
  { id: "religious_show", label: "برنامج ديني", en: "Religious Program", category: "culture" },
  { id: "music_show", label: "برنامج موسيقي", en: "Music Show", category: "entertainment" },
  { id: "variety_show", label: "برنامج متنوع", en: "Variety Show", category: "entertainment" },
  { id: "reality_show", label: "برنامج واقعي", en: "Reality Show", category: "entertainment" },
  { id: "children_show", label: "برنامج أطفال", en: "Children's Show", category: "children" },
  { id: "education_show", label: "برنامج تعليمي", en: "Educational Program", category: "education" },
  { id: "raw_footage", label: "لقطات خام", en: "Raw Footage", category: "production" },
  { id: "b_roll", label: "مشاهد داعمة", en: "B-Roll", category: "production" },
  { id: "commercial", label: "إعلان تجاري", en: "Commercial", category: "production" },
  { id: "promo", label: "ترويجي", en: "Promo/Teaser", category: "production" },
] as const;

export const BROADCAST_GENRES = [
  { id: "political", label: "سياسي", en: "Political" },
  { id: "economic", label: "اقتصادي", en: "Economic" },
  { id: "social", label: "اجتماعي", en: "Social" },
  { id: "cultural", label: "ثقافي", en: "Cultural" },
  { id: "religious", label: "ديني", en: "Religious" },
  { id: "sports", label: "رياضي", en: "Sports" },
  { id: "entertainment", label: "ترفيهي", en: "Entertainment" },
  { id: "scientific", label: "علمي وتقني", en: "Scientific/Tech" },
  { id: "health", label: "صحي وطبي", en: "Health/Medical" },
  { id: "environmental", label: "بيئي", en: "Environmental" },
  { id: "humanitarian", label: "إنساني", en: "Humanitarian" },
  { id: "local", label: "محلي", en: "Local" },
  { id: "regional", label: "إقليمي", en: "Regional" },
  { id: "international", label: "دولي", en: "International" },
] as const;

export const BROADCAST_ROLES = [
  { id: "anchor", label: "مذيع / مقدم برنامج", en: "Anchor/Host", group: "on_air" },
  { id: "reporter", label: "مراسل", en: "Reporter/Correspondent", group: "on_air" },
  { id: "guest", label: "ضيف", en: "Guest", group: "on_air" },
  { id: "analyst", label: "محلل / خبير", en: "Analyst/Expert", group: "on_air" },
  { id: "spokesperson", label: "متحدث رسمي", en: "Spokesperson", group: "on_air" },
  { id: "director", label: "مخرج", en: "Director", group: "production" },
  { id: "editor", label: "محرر", en: "Editor", group: "production" },
  { id: "cameraman", label: "مصور / كاميرامان", en: "Cameraman", group: "production" },
  { id: "sound_engineer", label: "مهندس صوت", en: "Sound Engineer", group: "production" },
  { id: "lighting", label: "مضيء", en: "Lighting Technician", group: "production" },
  { id: "producer", label: "منتج", en: "Producer", group: "production" },
  { id: "floor_manager", label: "مدير أرضية", en: "Floor Manager", group: "production" },
  { id: "translator", label: "مترجم", en: "Translator", group: "post_production" },
  { id: "subtitle_editor", label: "محرر ترجمة", en: "Subtitle Editor", group: "post_production" },
  { id: "voice_over", label: "تعليق صوتي", en: "Voice-Over Artist", group: "post_production" },
] as const;

export const BROADCAST_CATEGORIES: Record<string, string> = {
  news: "الأخبار",
  interview: "المقابلات",
  talk: "البرامج الحوارية",
  documentary: "الوثائقيات",
  drama: "الدراما",
  sports: "الرياضة",
  culture: "الثقافة والدين",
  entertainment: "الترفيه",
  children: "الأطفال",
  education: "التعليم",
  production: "مواد الإنتاج",
};

/** Returns program type options for use in select fields */
export function getProgramTypeOptions() {
  return BROADCAST_PROGRAM_TYPES.map(t => ({ value: t.id, label: t.label }));
}

/** Returns genre options for classification */
export function getGenreOptions() {
  return BROADCAST_GENRES.map(g => ({ value: g.id, label: g.label }));
}

/** Returns role options */
export function getRoleOptions() {
  return BROADCAST_ROLES.map(r => ({ value: r.id, label: r.label }));
}

/** Returns program types grouped by category with Arabic labels */
export function getGroupedProgramTypes() {
  const groups: Record<string, typeof BROADCAST_PROGRAM_TYPES[number][]> = {};
  for (const t of BROADCAST_PROGRAM_TYPES) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return Object.entries(groups).map(([category, items]) => ({
    category,
    label: BROADCAST_CATEGORIES[category] || category,
    items,
  }));
}
