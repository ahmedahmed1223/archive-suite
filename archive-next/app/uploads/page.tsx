import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { UploadForm } from "./UploadForm";

export default function UploadsPage() {
  return (
    <AppShell subtitle="رفع الملفات" contentClassName="stack">
      <PageToolbar
        title="رفع الملفات"
        description="ارفع ملفًا واحدًا إلى مخزن الأرشفة لإنشاء سجل جديد تلقائيًا. تُجهَّز ملفات الوسائط (صور/فيديو) لمهمة صورة مصغّرة بعد الرفع."
        meta={
          <>
            <span className="badge">رفع مباشر</span>
            <span className="badge">حتى 600MB</span>
          </>
        }
        actions={<a className="button button-secondary" href="/media/jobs">مهام الوسائط</a>}
      />

      <UploadForm />
    </AppShell>
  );
}
