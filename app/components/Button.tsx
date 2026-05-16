import Link from "next/link";
import { cn } from "../helpers/ui-helper";

export default function Button({
  variant = "primary",
  children,
  className: extraClassName,
  href,
  ...props
}: {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
  href?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  const baseClasses =
    "px-3 py-1.5 transition-colors text-xs font-medium flex flex-row gap-1.5 items-center justify-center rounded-lg border border-b-2 disabled:opacity-50 disabled:pointer-events-none";

  const variantClasses = {
    primary:
      "bg-grayscale-12 text-grayscale-1 hover:bg-grayscale-11 border-grayscale-12 hover:border-grayscale-11",
    secondary:
      "bg-grayscale-1 text-grayscale-12 hover:bg-grayscale-3 border-grayscale-4 hover:border-grayscale-4",
  };

  if (href) {
    return (
      <Link href={href} className={cn(baseClasses, variantClasses[variant], extraClassName)}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(baseClasses, variantClasses[variant], extraClassName)}
      {...props}
    >
      {children}
    </button>
  );
}
