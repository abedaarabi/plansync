import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type EnterpriseButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type EnterpriseButtonSize = "sm" | "md" | "lg";

/** Size intent: sm footers/toolbars (~36px), md default (~44px), lg auth/CTAs (~48px). */
const sizeStyles: Record<EnterpriseButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-2 text-sm tracking-[-0.006em]",
  md: "min-h-10 px-4 py-2 text-sm tracking-[-0.006em] max-lg:min-h-11",
  lg: "min-h-11 px-5 py-2.5 text-[0.9375rem] tracking-[-0.006em] max-lg:min-h-12 max-lg:w-full",
};

/**
 * secondary = neutral bordered surface (Cancel / secondary actions).
 * soft = tinted primary (matches legacy `.enterprise-btn-secondary`).
 */
const variantStyles: Record<EnterpriseButtonVariant, string> = {
  primary:
    "border border-transparent bg-[var(--enterprise-primary)] text-white hover:bg-[var(--enterprise-primary-deep)] focus-visible:ring-[var(--enterprise-primary)]/35",
  secondary:
    "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] focus-visible:ring-[var(--enterprise-primary)]/35",
  soft: "border border-[color-mix(in_srgb,var(--enterprise-primary)_28%,var(--enterprise-border))] bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] hover:border-[color-mix(in_srgb,var(--enterprise-primary)_45%,var(--enterprise-border))] hover:bg-[color-mix(in_srgb,var(--enterprise-primary-soft)_70%,var(--enterprise-surface))] focus-visible:ring-[var(--enterprise-primary)]/35",
  ghost:
    "border border-transparent bg-transparent text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] focus-visible:ring-[var(--enterprise-primary)]/30",
  danger:
    "border border-transparent bg-[var(--enterprise-error)] text-white hover:bg-[color-mix(in_srgb,var(--enterprise-error)_90%,#000)] focus-visible:ring-[var(--enterprise-error)]/45",
};

const BASE_CLASS =
  "group inline-flex min-w-0 shrink-0 items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] disabled:cursor-not-allowed disabled:opacity-55";

/** Shared class builder for `<button>` and rare styled `<Link>` CTAs. */
export function enterpriseButtonClassName({
  variant = "primary",
  size = "md",
  fullWidth,
  className = "",
}: {
  variant?: EnterpriseButtonVariant;
  size?: EnterpriseButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return [
    BASE_CLASS,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

type EnterpriseButtonProps = {
  variant?: EnterpriseButtonVariant;
  size?: EnterpriseButtonSize;
  fullWidth?: boolean;
  /** Disables the control, sets aria-busy, and shows a spinner before children. */
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const EnterpriseButton = forwardRef<HTMLButtonElement, EnterpriseButtonProps>(
  function EnterpriseButton(
    {
      variant = "primary",
      size = "md",
      fullWidth,
      loading,
      className = "",
      disabled,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const isDisabled = Boolean(disabled || loading);

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={enterpriseButtonClassName({ variant, size, fullWidth, className })}
        {...rest}
      >
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
