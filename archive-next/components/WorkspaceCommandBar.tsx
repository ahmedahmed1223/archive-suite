"use client";

import { Bell, Search, UserCircle } from "lucide-react";
import { openCommandPalette } from "@/components/CommandPalette";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuthSession } from "@/lib/auth-session";

export default function WorkspaceCommandBar() {
  const auth = useAuthSession();
  const userLabel = auth.user?.name ?? auth.user?.email ?? auth.user?.id ?? "مستخدم";

  return (
    <div className="workspace-commandbar" aria-label="شريط أوامر مساحة العمل">
      <div className="workspace-commandbar__user" title={userLabel}>
        <UserCircle size={34} aria-hidden="true" />
        <span>
          <strong>{userLabel}</strong>
          <small>{auth.user?.role === "admin" ? "مدير الأرشيف" : "مساحة العمل"}</small>
        </span>
      </div>
      <button type="button" className="workspace-commandbar__search" onClick={openCommandPalette}>
        <Search size={18} aria-hidden="true" />
        <span>البحث في الأرشيف...</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="workspace-commandbar__tools">
        <button type="button" className="icon-action" aria-label="التنبيهات">
          <Bell size={18} aria-hidden="true" />
          <span className="workspace-commandbar__dot" aria-hidden="true" />
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
