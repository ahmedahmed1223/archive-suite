"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { navSectionLabels, primaryNav } from "@/lib/navigation";
import { getShortcut, matchesKeyEvent } from "@/lib/keyboard-shortcuts";

const commandEventName = "masar:open-command-palette";
const iconRegistry = Icons as unknown as Record<string, LucideIcon>;
const navIcon = (name: string) => iconRegistry[name] || Icons.Circle;

export function openCommandPalette() {
  window.dispatchEvent(new Event(commandEventName));
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const shortcutBinding = getShortcut("commandPalette");

    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesKeyEvent(event, shortcutBinding)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpen = () => setOpen(true);
    const onShortcutsChanged = () => {
      // Rebind listener on shortcut changes
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(commandEventName, onOpen);
    window.addEventListener("archive:shortcuts-changed", onShortcutsChanged);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(commandEventName, onOpen);
      window.removeEventListener("archive:shortcuts-changed", onShortcutsChanged);
    };
  }, []);

  const grouped = useMemo(
    () =>
      primaryNav.reduce(
        (acc, item) => {
          acc[item.section] = [...(acc[item.section] || []), item];
          return acc;
        },
        {} as Record<(typeof primaryNav)[number]["section"], typeof primaryNav[number][]>
      ),
    []
  );

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="command-overlay" />
        <Dialog.Content className="command-dialog" aria-label="لوحة أوامر مسار">
          <Command className="command-palette" loop dir="rtl">
            <div className="command-input-row">
              <Icons.Search aria-hidden="true" size={18} />
              <Command.Input placeholder="ابحث عن صفحة أو إجراء..." autoFocus />
            </div>
            <Command.List className="command-list">
              <Command.Empty className="command-empty">لا توجد نتيجة مطابقة.</Command.Empty>
              {(Object.keys(grouped) as Array<keyof typeof grouped>).map((section) => (
                <Command.Group key={section} heading={navSectionLabels[section]}>
                  {grouped[section].map((item) => (
                    <Command.Item key={item.href} value={`${item.label} ${item.href}`} onSelect={() => navigate(item.href)}>
                      <span className="command-item-label">
                        {(() => {
                          const Icon = navIcon(item.icon);
                          return <Icon aria-hidden="true" size={17} strokeWidth={2} />;
                        })()}
                        <span>{item.label}</span>
                      </span>
                      <small>{item.href}</small>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
