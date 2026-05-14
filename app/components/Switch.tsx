import { Switch as BaseUISwitch } from "@base-ui/react/switch";
import { cn } from "../helpers/ui-helper";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (nextChecked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  id?: string;
  className?: string;
  thumbClassName?: string;
  "aria-label"?: string;
}

export default function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  required = false,
  name,
  value,
  id,
  className,
  thumbClassName,
  "aria-label": ariaLabel = "Toggle switch",
}: SwitchProps) {
  return (
    <BaseUISwitch.Root
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      required={required}
      name={name}
      value={value}
      id={id}
      aria-label={ariaLabel}
      className={cn(
        "relative flex h-5 w-9 rounded-full border border-grayscale-6 data-[checked]:border-accent-10 bg-grayscale-5 p-px transition-[background-color,opacity] duration-150 data-[checked]:bg-accent-9 dark:border-grayscale-5 dark:bg-grayscale-4 dark:data-[checked]:bg-accent-9",
        className,
      )}
    >
      <BaseUISwitch.Thumb
        className={cn(
          "aspect-square h-full rounded-full bg-grayscale-1 data-[checked]:bg-accent-4 dark:data-[checked]:bg-accent-12 shadow-sm transition-transform duration-150 data-[checked]:translate-x-4 dark:bg-grayscale-10",
          thumbClassName,
        )}
      />
    </BaseUISwitch.Root>
  );
}
