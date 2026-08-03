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
      ? "pointer-events-auto absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ease-out "
      : "pointer-events-auto absolute inset-0 bg-[var(--enterprise-text)]/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out ",
    panelTheme: isViewerDark
      ? "bim-theme border-[var(--bim-border)] bg-[var(--bim-shell)] text-[var(--bim-text)] shadow-[var(--bim-panel-shadow)]"
      : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]",
    handle: isViewerDark
      ? "h-1 w-10 rounded-full bg-[var(--bim-border-strong)]"
      : "h-1 w-10 rounded-full bg-[var(--enterprise-border)]",
    footer: isViewerDark
      ? `flex shrink-0 flex-col gap-2 border-t border-[var(--bim-border)] bg-[var(--bim-panel)]/80 px-4 py-3 ${footerClassName}`
      : `flex shrink-0 flex-col gap-2 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-4 py-3 ${footerClassName}`,
  };
}
