import { forwardRef, type ButtonHTMLAttributes } from "react";

export type EnterpriseButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type EnterpriseButtonSize = "sm" | "md" | "lg";

const sizeStyles: Record<EnterpriseButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 py-2.5 text-sm",
  lg: "min-h-13 px-6 py-3 text-base",
};

const variantStyles: Record<EnterpriseButtonVariant, string> = {
  primary:
    "border border-transparent bg-[var(--enterprise-primary)] text-white shadow-sm hover:bg-[var(--enterprise-primary-deep)] focus-visible:ring-[var(--enterprise-primary)]/35",
  secondary:
    "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] shadow-sm hover:bg-[var(--enterprise-hover-surface)] focus-visible:ring-[var(--enterprise-primary)]/35",
  ghost:
    "border border-transparent bg-transparent text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)] focus-visible:ring-[var(--enterprise-primary)]/30",
  danger:
    "border border-transparent bg-[var(--enterprise-error)] text-white hover:bg-[color-mix(in_srgb,var(--enterprise-error)_90%,#000)] focus-visible:ring-[var(--enterprise-error)]/45",
};

export type EnterpriseButtonProps = {
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
        className={`group inline-flex min-w-0 shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] disabled:cursor-not-allowed disabled:opacity-55 ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
