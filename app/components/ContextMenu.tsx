"use client";

import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { cn } from "../helpers/ui-helper";

export type ContextMenuItem =
  | {
      type: "item";
      id: string;
      label: string;
      onClick: () => void;
      variant?: "danger";
      disabled?: boolean;
    }
  | { type: "separator"; id: string };

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  className?: string;
}

export default function ContextMenu({ items, children, className }: ContextMenuProps) {
  return (
    <BaseContextMenu.Root>
      <BaseContextMenu.Trigger className={cn("outline-none", className)}>
        {children}
      </BaseContextMenu.Trigger>
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner className="outline-hidden z-50">
          <BaseContextMenu.Popup className="origin-[var(--transform-origin)] rounded-lg border border-grayscale-4 bg-grayscale-1 py-1 shadow-lg transition-[opacity] data-[ending-style]:opacity-0">
            {items.map((item) =>
              item.type === "separator" ? (
                <BaseContextMenu.Separator
                  key={item.id}
                  className="mx-2 my-1 h-px bg-grayscale-4"
                />
              ) : (
                <BaseContextMenu.Item
                  key={item.id}
                  disabled={item.disabled}
                  onClick={item.onClick}
                  className={cn(
                    "flex cursor-default items-center px-3 py-1.5 text-xs outline-hidden select-none",
                    "data-[highlighted]:bg-grayscale-3 data-[highlighted]:text-grayscale-12",
                    "disabled:opacity-40 disabled:pointer-events-none",
                    item.variant === "danger"
                      ? "text-red-11 data-[highlighted]:text-red-11"
                      : "text-grayscale-11",
                  )}
                >
                  {item.label}
                </BaseContextMenu.Item>
              ),
            )}
          </BaseContextMenu.Popup>
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  );
}
