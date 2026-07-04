import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { ImportFromUrlForm } from "./ImportFromUrlForm";
import { IntakeTemplatesPanel } from "./IntakeTemplatesPanel";
import { UploadForm } from "./UploadForm";
import { UploadLinksPanel } from "./UploadLinksPanel";

export default function UploadsPage() {
  return (
    <AppShell subtitle="إضافة أرشيف" contentClassName="stack">
      <PageToolbar
        title="إضافة أرشيف"
        description="مسار إضافة غني يجمع رفع ملفات متعددة، metadata، حقول فيديو، قوالب إدخال، معاينة رابط، وروابط رفع خارجية في سطح واحد."
        meta={
          <>
            <span className="badge">Wizard</span>
            <span className="badge">Multi-file</span>
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

      <UploadForm />
      <ImportFromUrlForm />
      <IntakeTemplatesPanel />
      <UploadLinksPanel />
    </AppShell>
  );
}
