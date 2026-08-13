import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/** Hierarchical trail: every item except the current page is rendered as a link. */
export default function Breadcrumb({ items }: Readonly<{ items: BreadcrumbItem[] }>) {
  const { t } = useLocale();
  if (items.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label={t.shell.breadcrumbAriaLabel}>
      <ol className="breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="breadcrumb__item" key={`${item.label}-${index}`}>
              {item.href && !isLast ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
              {!isLast ? (
                <span className="breadcrumb__separator" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
