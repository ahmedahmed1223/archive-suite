// ponytail: pure preview of applying a metadata template to a draft (V1-827) —
// caller decides whether to commit the result; nothing is saved here.
import type { MetadataTemplate } from "@/lib/archive-api";

export interface DescribeDraftLike {
  description: string;
  type: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

/** يملأ الحقول الفارغة فقط من القالب — لا يستبدل قيمًا أدخلها المستخدم بالفعل. */
export function previewTemplateApplication(draft: DescribeDraftLike, template: MetadataTemplate): DescribeDraftLike {
  const templateDescription = typeof template.fields.description === "string" ? template.fields.description : undefined;
  const templateType = typeof template.fields.type === "string" ? template.fields.type : undefined;

  return {
    description: draft.description || templateDescription || draft.description,
    type: draft.type || templateType || draft.type,
    tags: draft.tags.length ? draft.tags : [...template.tags],
    metadata: { ...template.fields, ...draft.metadata }
  };
}
