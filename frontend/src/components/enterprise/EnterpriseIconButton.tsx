import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type EnterpriseIconButtonVariant = "toolbar" | "ghost";

const variantStyles: Record<EnterpriseIconButtonVariant, string> = {
  toolbar:
    "border border-[var(--enterprise-border)]/95 bg-[var(--enterprise-surface)]/90 text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:ring-[var(--enterprise-primary)]/25",
  ghost:
    "border border-transparent bg-transparent text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:ring-[var(--enterprise-primary)]/25",
};

const sizeStyles = {
  /** ~36px — matches compact top bar */
  sm: "h-9 min-h-9 w-9 min-w-9 rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px]",
  /** ~44px touch target */
  md: "h-11 min-h-[44px] w-11 min-w-[44px] rounded-xl [&_svg]:h-4 [&_svg]:w-4",
} as const;

export type EnterpriseIconButtonProps = {
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
        className={`inline-flex shrink-0 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] disabled:cursor-not-allowed disabled:opacity-55 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
