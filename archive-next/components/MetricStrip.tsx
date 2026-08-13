import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface MetricStripItem {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger" | "info";
}

export default function MetricStrip({
  items,
  ariaLabel
}: Readonly<{
  items: MetricStripItem[];
  ariaLabel?: string;
}>) {
  const { t } = useLocale();

  return (
    <section className="metric-strip" aria-label={ariaLabel ?? t.shell.metricStrip.ariaLabel}>
      {items.map((item, index) => (
        <article className="metric-card" data-tone={item.tone || "default"} key={index}>
          {item.icon ? <div className="metric-card__icon" aria-hidden="true">{item.icon}</div> : null}
          <div className="metric-card__body">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.description ? <small>{item.description}</small> : null}
          </div>
        </article>
      ))}
    </section>
  );
}
