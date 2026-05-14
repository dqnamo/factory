import { Input as BaseInput } from "@base-ui/react/input";
import { cn } from "../helpers/ui-helper";

export default function Input({
  variant = "underline",
  className,
  ...props
}: { variant?: "underline" | "border" } & BaseInput.Props) {
  const baseClasses = "outline-none w-full p-3 text-sm transition-colors duration-100 ease-out";
  const underlineClasses = cn(
    baseClasses,
    "border-b border-x-0 border-t-0 border-grayscale-3 focus:border-accent-9",
  );
  const borderClasses = cn(baseClasses, "border border-grayscale-3");
  return (
    <BaseInput
      className={cn(variant === "underline" ? underlineClasses : borderClasses, className)}
      {...props}
    />
  );
}
