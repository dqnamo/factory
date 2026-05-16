"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { XIcon } from "@phosphor-icons/react";
import * as React from "react";
import { cn } from "../helpers/ui-helper";

const DESKTOP_QUERY = "(min-width: 768px)";

type ModalDrawerClassNames = {
  trigger?: string;
  backdrop?: string;
  viewport?: string;
  popup?: string;
  content?: string;
  footer?: string;
  close?: string;
  handle?: string;
};

type ModalDrawerProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean | "trap-focus";
  disablePointerDismissal?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  classNames?: ModalDrawerClassNames;
};

function useMediaQuery(query: string, defaultMatches = true) {
  return React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        const mediaQuery = window.matchMedia(query);
        mediaQuery.addEventListener("change", onStoreChange);

        return () => {
          mediaQuery.removeEventListener("change", onStoreChange);
        };
      },
      [query],
    ),
    () => window.matchMedia(query).matches,
    () => defaultMatches,
  );
}

export default function ModalDrawer({
  trigger,
  children,
  footer,
  open,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  disablePointerDismissal,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  classNames,
}: ModalDrawerProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const backdropClassName = cn(
    "absolute inset-0 z-50 bg-grayscale-1/50 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
    classNames?.backdrop,
  );
  const closeClassName = cn(
    "absolute right-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded-md  bg-grayscale-2 text-grayscale-11 transition-colors hover:bg-grayscale-3 hover:text-grayscale-12",
    classNames?.close,
  );
  const contentClassName = cn("flex flex-col gap-4 overflow-y-auto", classNames?.content);
  const footerClassName = cn(
    "mt-5 flex flex-row justify-end gap-2 border-t border-grayscale-3 pt-4",
    classNames?.footer,
  );

  if (isDesktop) {
    return (
      <Dialog.Root
        open={currentOpen}
        onOpenChange={handleOpenChange}
        modal={modal}
        disablePointerDismissal={disablePointerDismissal}
      >
        <Dialog.Trigger>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className={backdropClassName} />
          <Dialog.Viewport
            className={cn(
              "fixed inset-0 z-50 flex min-h-dvh items-center justify-center p-4",
              classNames?.viewport,
            )}
          >
            <Dialog.Popup
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              className={cn(
                "relative w-full max-w-md rounded-xl border border-grayscale-3 bg-white text-left small-shadow",
                "transition-[opacity,transform] duration-150 ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
                classNames?.popup,
              )}
            >
              <Dialog.Close className={closeClassName} aria-label="Close">
                <XIcon size={12} weight="bold" />
              </Dialog.Close>
              <div className={cn(contentClassName, "max-h-[60dvh]")}>{children}</div>
              {footer ? <div className={footerClassName}>{footer}</div> : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root
      open={currentOpen}
      onOpenChange={handleOpenChange}
      modal={modal}
      disablePointerDismissal={disablePointerDismissal}
    >
      <Drawer.Trigger>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={backdropClassName} />
        <Drawer.Viewport
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] min-h-dvh items-end",
            classNames?.viewport,
          )}
        >
          <Drawer.Popup
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "relative flex max-h-[90dvh] w-full flex-col rounded-t-lg border border-b-0 border-grayscale-3 bg-grayscale-1 p-5 pt-3 text-left medium-shadow",
              "transition-[opacity,transform] duration-200 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
              classNames?.popup,
            )}
          >
            <div
              className={cn(
                "mx-auto mb-4 h-1 w-10 rounded-full bg-grayscale-5",
                classNames?.handle,
              )}
            />
            <Drawer.Close className={closeClassName} aria-label="Close">
              <XIcon size={14} weight="bold" />
            </Drawer.Close>
            <Drawer.Content className={cn(contentClassName, "min-h-0 pr-8")}>
              <div className="overflow-y-auto">{children}</div>
              {footer ? <div className={footerClassName}>{footer}</div> : null}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
