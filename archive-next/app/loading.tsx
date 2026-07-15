import { Skeleton } from "@/components/ui/Skeleton";

export default function RouteLoading() {
  return (
    <main className="content">
      <section className="panel">
        <Skeleton label="جار تحميل الصفحة..." lines={4} />
      </section>
    </main>
  );
}
