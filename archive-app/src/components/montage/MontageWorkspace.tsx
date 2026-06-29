import * as React from "react";
import { PanelLeftOpen, PanelRightOpen, X } from "lucide-react";

import "./MontageWorkspace.css";

function CompactDrawerButton({ label, icon: Icon, onClick }: any) {
  return (
    <div className="tooltip tooltip-bottom" data-tip={label}>
      <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={onClick} aria-label={label}>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MontageWorkspace({
  header,
  toolbar,
  mediaBin,
  monitor,
  inspector,
  timeline,
  footer
}: any) {
  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);

  const openMedia = () => {
    setInspectorOpen(false);
    setMediaOpen(true);
  };
  const openInspector = () => {
    setMediaOpen(false);
    setInspectorOpen(true);
  };

  return (
    <section className="montage-workspace" dir="rtl" aria-label="مساحة عمل المونتاج">
      {header ? <header className="montage-workspace__header">{header}</header> : null}
      <div className="montage-workspace__commandbar">
        <div className="montage-workspace__compact-actions" aria-label="لوحات مساحة العمل">
          <CompactDrawerButton label="فتح مكتبة المواد" icon={PanelRightOpen} onClick={openMedia} />
          <CompactDrawerButton label="فتح مفتش القصاصة" icon={PanelLeftOpen} onClick={openInspector} />
        </div>
        {toolbar ? <div role="toolbar" aria-label="أدوات المونتاج" className="montage-workspace__toolbar">{toolbar}</div> : null}
      </div>

      <div className="montage-workspace__upper">
        <aside
          role="region"
          aria-label="مكتبة مواد المشروع"
          className="montage-workspace__panel montage-workspace__panel--media"
          data-open={String(mediaOpen)}
        >
          <button type="button" className="montage-workspace__drawer-close btn btn-ghost btn-xs btn-square" onClick={() => setMediaOpen(false)} aria-label="إغلاق مكتبة المواد">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
          {mediaBin}
        </aside>

        <main role="region" aria-label="شاشة البرنامج" className="montage-workspace__monitor">
          {monitor}
        </main>

        <aside
          role="region"
          aria-label="مفتش القصاصة"
          className="montage-workspace__panel montage-workspace__panel--inspector"
          data-open={String(inspectorOpen)}
        >
          <button type="button" className="montage-workspace__drawer-close btn btn-ghost btn-xs btn-square" onClick={() => setInspectorOpen(false)} aria-label="إغلاق مفتش القصاصة">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
          {inspector}
        </aside>
      </div>

      {(mediaOpen || inspectorOpen) ? (
        <button
          type="button"
          className="montage-workspace__overlay"
          aria-label="إغلاق اللوحة الجانبية"
          onClick={() => { setMediaOpen(false); setInspectorOpen(false); }}
        />
      ) : null}

      <section role="region" aria-label="الخط الزمني" className="montage-workspace__timeline">
        {timeline}
      </section>
      {footer ? <footer className="montage-workspace__footer">{footer}</footer> : null}
    </section>
  );
}

export default MontageWorkspace;
