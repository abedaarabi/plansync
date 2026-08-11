import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type EnterpriseIconButtonVariant = "toolbar" | "ghost";

const variantStyles: Record<EnterpriseIconButtonVariant, string> = {
  toolbar:
    "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:ring-[var(--enterprise-primary)]/25",
  ghost:
    "border border-transparent bg-transparent text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:ring-[var(--enterprise-primary)]/25",
};

const sizeStyles = {
  /** ~32px — compact top bar */
  sm: "h-8 min-h-8 w-8 min-w-8 rounded-md [&_svg]:h-4 [&_svg]:w-4",
  /** ~44px touch target */
  md: "h-11 min-h-[44px] w-11 min-w-[44px] rounded-md [&_svg]:h-4 [&_svg]:w-4",
} as const;

type EnterpriseIconButtonProps = {
  variant?: EnterpriseIconButtonVariant;
  size?: keyof typeof sizeStyles;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export const EnterpriseIconButton = forwardRef<HTMLButtonElement, EnterpriseIconButtonProps>(
  function EnterpriseIconButton(
    { variant = "toolbar", size = "sm", className = "", type = "button", children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] disabled:cursor-not-allowed disabled:opacity-55 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
