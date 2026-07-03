"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/css";

export const Dropdown = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;
export const DropdownGroup = DropdownMenu.Group;
export const DropdownItem = DropdownMenu.Item;
export const DropdownSeparator = DropdownMenu.Separator;

export function DropdownContent({ className, ...props }: ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={cx("ui-dropdown-content", className)} sideOffset={8} align="end" {...props} />
    </DropdownMenu.Portal>
  );
}
