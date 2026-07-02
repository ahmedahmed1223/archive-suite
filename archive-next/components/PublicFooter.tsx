import { BRAND } from "@/lib/brand";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      {BRAND.lockupName} · {BRAND.descriptor}
    </footer>
  );
}
