import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type EnterpriseIconButtonVariant = "toolbar" | "ghost";

const variantStyles: Record<EnterpriseIconButtonVariant, string> = {
  toolbar:
    "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:ring-[var(--enterprise-primary)]/25",
  ghost:
    "border border-transparent bg-transparent text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:ring-[var(--enterprise-primary)]/25",
};

/** sm ≈32px chrome; md ≈44px touch. Icon-only controls must pass aria-label. */
const sizeStyles = {
  sm: "h-8 min-h-8 w-8 min-w-8 rounded-md [&_svg]:h-4 [&_svg]:w-4",
  md: "h-11 min-h-[44px] w-11 min-w-[44px] rounded-md [&_svg]:h-4 [&_svg]:w-4",
} as const;

type EnterpriseIconButtonProps = {
  "aria-label": string;
  variant?: EnterpriseIconButtonVariant;
  size?: keyof typeof sizeStyles;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label">;

export const EnterpriseIconButton = forwardRef<HTMLButtonElement, EnterpriseIconButtonProps>(
  function EnterpriseIconButton(
    {
      "aria-label": ariaLabel,
      variant = "toolbar",
      size = "sm",
      className = "",
      type = "button",
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={`inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] disabled:cursor-not-allowed disabled:opacity-55 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
