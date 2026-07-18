import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { Link2, PlusCircle } from "lucide-react";
import { ImportFromUrlForm } from "./ImportFromUrlForm";
import { IntakeTemplatesPanel } from "./IntakeTemplatesPanel";
import { UploadForm } from "./UploadForm";
import { UploadLinksPanel } from "./UploadLinksPanel";
import { FilelessRecordForm } from "./FilelessRecordForm";

export default function UploadsPage() {
  return (
    <AppShell subtitle="إضافة أرشيف" contentClassName="stack" tipsPage="uploads">
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
          <FilelessRecordForm />
          <UploadForm />
        </div>
        <details className="add-workspace__support" aria-label="أدوات الإضافة المساندة">
          <summary className="add-workspace__support-header">
            <div>
              <h2>أدوات مساندة</h2>
              <p>افتح عند الحاجة لاستيراد رابط أو إدارة القوالب وروابط الفريق.</p>
            </div>
            <span className="badge"><Link2 aria-hidden="true" size={14} /> أدوات</span>
          </summary>
          <div className="add-workspace__support-grid">
            <ImportFromUrlForm />
            <IntakeTemplatesPanel />
            <UploadLinksPanel />
          </div>
        </details>
      </section>
    </AppShell>
  );
}
