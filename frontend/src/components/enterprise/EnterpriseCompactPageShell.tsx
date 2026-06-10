type MaxWidth = "3xl" | "6xl" | "7xl" | "full" | "1600";

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  "3xl": "max-w-3xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
  "1600": "max-w-[1600px]",
};

type Props = {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
  /** Full-height flex column (assets, materials, files). */
  fullHeight?: boolean;
};

export function EnterpriseCompactPageShell({
  children,
  maxWidth = "6xl",
  fullHeight = false,
}: Props) {
  const maxClass = MAX_WIDTH_CLASS[maxWidth];

  if (fullHeight) {
    return (
      <div className="mobile-app-page mobile-viewport-pane flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden">
        <div
          className={`mx-auto flex min-h-0 w-full ${maxClass} flex-1 flex-col px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4 lg:px-8`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 px-4 pb-6 pt-3 sm:px-6 sm:pb-8 sm:pt-4 lg:px-8">
      <div className={`mx-auto w-full ${maxClass} pb-[env(safe-area-inset-bottom,0px)]`}>
        {children}
      </div>
    </div>
  );
}
