import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { Link2, PlusCircle, UploadCloud } from "lucide-react";
import { ImportFromUrlForm } from "./ImportFromUrlForm";
import { IntakeTemplatesPanel } from "./IntakeTemplatesPanel";
import { UploadForm } from "./UploadForm";
import { UploadLinksPanel } from "./UploadLinksPanel";

export default function UploadsPage() {
  return (
    <AppShell subtitle="إضافة أرشيف" contentClassName="stack">
      <PageToolbar
        icon={<PlusCircle size={24} strokeWidth={2} />}
        eyebrow={<span className="badge">Add Workspace</span>}
        title="إضافة مادة"
        description="مسار واضح لإنشاء مادة أرشيف: ملفات، بيانات وصفية، وسوم، مراجعة، ثم إنشاء بدون فقدان أدوات الاستيراد والقوالب."
        meta={
          <>
            <span className="badge">معالج خطوة بخطوة</span>
            <span className="badge">رفع متعدد</span>
            <span className="badge">Metadata</span>
            <span className="badge">حتى 600MB</span>
          </>
        }
        actions={
          <>
            <a className="button button-secondary" href="/archive">فتح الأرشيف</a>
            <a className="button button-secondary" href="/media/jobs">مهام الوسائط</a>
          </>
        }
      />

      <section className="add-workspace" aria-label="إضافة مادة للأرشيف">
        <div className="add-workspace__primary">
          <div className="workspace-panel__header">
            <div>
              <h2>المعالج الرئيسي</h2>
              <p>ابدأ من الملفات، ثم أكمل البيانات والمراجعة قبل إنشاء السجل.</p>
            </div>
            <span className="badge"><UploadCloud aria-hidden="true" size={14} /> رفع</span>
          </div>
          <UploadForm />
        </div>
        <aside className="add-workspace__support" aria-label="أدوات الإضافة المساندة">
          <section className="workspace-panel">
            <div className="workspace-panel__header">
              <div>
                <h2>استيراد سريع</h2>
                <p>جهّز مادة من رابط أو قالب أو رابط رفع خارجي.</p>
              </div>
              <span className="badge"><Link2 aria-hidden="true" size={14} /> أدوات</span>
            </div>
          </section>
          <ImportFromUrlForm />
          <IntakeTemplatesPanel />
          <UploadLinksPanel />
        </aside>
      </section>
    </AppShell>
  );
}
