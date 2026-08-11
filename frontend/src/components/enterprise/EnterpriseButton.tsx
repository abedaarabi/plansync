import { forwardRef, type ButtonHTMLAttributes } from "react";

type EnterpriseButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type EnterpriseButtonSize = "sm" | "md" | "lg";

const sizeStyles: Record<EnterpriseButtonSize, string> = {
  /** Compact — slide-over footers, dense toolbars */
  sm: "min-h-9 px-3.5 py-2 text-sm tracking-[-0.006em]",
  md: "min-h-10 px-4 py-2 text-sm tracking-[-0.006em] max-lg:min-h-11",
  lg: "min-h-11 px-5 py-2.5 text-[0.9375rem] tracking-[-0.006em] max-lg:min-h-12 max-lg:w-full",
};

const variantStyles: Record<EnterpriseButtonVariant, string> = {
  primary:
    "border border-transparent bg-[var(--enterprise-primary)] text-white hover:bg-[var(--enterprise-primary-deep)] focus-visible:ring-[var(--enterprise-primary)]/35",
  secondary:
    "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] focus-visible:ring-[var(--enterprise-primary)]/35",
  ghost:
    "border border-transparent bg-transparent text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] focus-visible:ring-[var(--enterprise-primary)]/30",
  danger:
    "border border-transparent bg-[var(--enterprise-error)] text-white hover:bg-[color-mix(in_srgb,var(--enterprise-error)_90%,#000)] focus-visible:ring-[var(--enterprise-error)]/45",
};

type EnterpriseButtonProps = {
  variant?: EnterpriseButtonVariant;
  size?: EnterpriseButtonSize;
  fullWidth?: boolean;
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
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled ?? loading}
        className={`group inline-flex min-w-0 shrink-0 items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] disabled:cursor-not-allowed disabled:opacity-55 ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
