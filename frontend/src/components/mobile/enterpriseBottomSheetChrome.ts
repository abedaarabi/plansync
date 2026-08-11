export type EnterpriseBottomSheetVariant = "enterprise" | "viewer-dark";

export function bottomSheetChrome(
  variant: EnterpriseBottomSheetVariant,
  footerClassName: string,
): {
  backdropBase: string;
  panelTheme: string;
  handle: string;
  footer: string;
} {
  const isViewerDark = variant === "viewer-dark";
  return {
    backdropBase: isViewerDark
      ? "pointer-events-auto absolute inset-0 bg-slate-950/65 transition-opacity duration-250 ease-out "
      : "pointer-events-auto absolute inset-0 bg-[#0b1220]/40 transition-opacity duration-250 ease-out ",
    panelTheme: isViewerDark
      ? "bim-theme border-[var(--bim-border)] bg-[var(--bim-shell)] text-[var(--bim-text)] shadow-none"
      : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-none",
    handle: isViewerDark
      ? "h-1 w-9 rounded-full bg-[var(--bim-border-strong)]"
      : "h-1 w-9 rounded-full bg-[var(--enterprise-border)]",
    footer: isViewerDark
      ? `flex shrink-0 flex-col gap-2 border-t border-[var(--bim-border)] bg-[var(--bim-shell)] px-4 py-2.5 ${footerClassName}`
      : `flex shrink-0 flex-col gap-2 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 ${footerClassName}`,
  };
}
