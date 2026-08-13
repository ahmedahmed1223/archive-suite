"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import * as Icons from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLocalizedNavigation, primaryNav } from "@/lib/navigation";
import { getShortcut, matchesKeyEvent } from "@/lib/keyboard-shortcuts";
import { useFocusMode } from "@/lib/use-focus-mode";
import { useDensity } from "@/lib/use-density";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { resolveIcon } from "@/lib/icon-registry";

const commandEventName = "masar:open-command-palette";
const navIcon = (name: string) => resolveIcon(name, Icons.Circle);

export function openCommandPalette() {
  window.dispatchEvent(new Event(commandEventName));
}

export default function CommandPalette() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const { density, toggleDensity } = useDensity();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.isComposing && matchesKeyEvent(event, getShortcut("commandPalette"))) {
        event.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setOpen(true);
        }
      }
    };
    const onOpen = () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(commandEventName, onOpen);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(commandEventName, onOpen);
    };
  }, [open]);

  const localizedNavigation = useMemo(() => getLocalizedNavigation(locale), [locale]);
  const grouped = useMemo(
    () =>
      localizedNavigation.items.reduce(
        (acc, item) => {
          acc[item.section] = [...(acc[item.section] || []), item];
          return acc;
        },
        {} as Record<(typeof primaryNav)[number]["section"], Array<{ href: string; label: string; section: (typeof primaryNav)[number]["section"]; icon: string }>>
      ),
    [localizedNavigation]
  );

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  const copy = t.pages.commandPalette;
  const quickActions = [
    {
      id: "toggle-focus-mode",
      label: isFocusMode ? copy.focusOff : copy.focusOn,
      icon: isFocusMode ? "ZoomOut" : "Maximize",
      run: toggleFocusMode
    },
    {
      id: "toggle-density",
      label: density === "compact" ? copy.densityComfortable : copy.densityCompact,
      icon: "Rows3",
      run: toggleDensity
    }
  ];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="command-overlay" />
        <Dialog.Content
          className="command-dialog"
          aria-label={copy.aria}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
        >
          <Command className="command-palette" loop dir={locale === "en" ? "ltr" : "rtl"}>
            <div className="command-input-row">
              <Icons.Search aria-hidden="true" size={18} />
              <Command.Input placeholder={copy.placeholder} autoFocus />
            </div>
            <Command.List className="command-list">
              <Command.Empty className="command-empty">{copy.empty}</Command.Empty>
              <Command.Group heading={copy.quick}>
                {quickActions.map((action) => (
                  <Command.Item key={action.id} value={action.label} onSelect={() => runAction(action.run)}>
                    <span className="command-item-label">
                      {(() => {
                        const Icon = navIcon(action.icon);
                        return <Icon aria-hidden="true" size={17} strokeWidth={2} />;
                      })()}
                      <span>{action.label}</span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
              {(Object.keys(grouped) as Array<keyof typeof grouped>).map((section) => (
                <Command.Group key={section} heading={localizedNavigation.sections[section]}>
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
