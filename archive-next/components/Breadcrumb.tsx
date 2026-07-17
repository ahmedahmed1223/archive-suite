import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/** مسار تنقّل هرمي: يعرض كل عنصر كرابط عدا الأخير (الصفحة الحالية). */
export default function Breadcrumb({ items }: Readonly<{ items: BreadcrumbItem[] }>) {
  if (items.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label="مسار التنقل">
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
