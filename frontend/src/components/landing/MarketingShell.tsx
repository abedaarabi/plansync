"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchMe } from "@/lib/api-client";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { QueryProvider } from "@/providers/QueryProvider";
import { CookieConsentDialog } from "./CookieConsentDialog";
import { LandingFooter } from "./LandingFooter";
import { LandingNav } from "./LandingNav";

type MarketingChromeValue = {
  goToFreeViewer: (source?: string) => void;
};

const MarketingChromeContext = createContext<MarketingChromeValue | null>(null);

export function useMarketingGoToFreeViewer() {
  const v = useContext(MarketingChromeContext);
  if (!v) {
    throw new Error("useMarketingGoToFreeViewer must be used within MarketingShell");
  }
  return v.goToFreeViewer;
}

type MarketingShellProps = {
  children: ReactNode;
};

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <QueryProvider>
      <MarketingShellInner>{children}</MarketingShellInner>
    </QueryProvider>
  );
}

function MarketingShellInner({ children }: MarketingShellProps) {
  const router = useRouter();
  const { data: me } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  const blockLocalPdf = meHasProWorkspace(me ?? null);
  const isLoggedIn = !!me?.user;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const goToFreeViewer = useCallback(
    (source = "marketing_shell") => {
      const destination = blockLocalPdf ? "/projects" : "/viewer";
      trackMarketingEvent("marketing_cta_click", {
        ctaType: "open_free_viewer",
        source,
        destination,
        loggedIn: isLoggedIn,
      });
      if (blockLocalPdf) {
        router.push("/projects");
        return;
      }
      router.push("/viewer");
    },
    [blockLocalPdf, isLoggedIn, router],
  );

  const ctx = useMemo(() => ({ goToFreeViewer }), [goToFreeViewer]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    trackMarketingEvent("marketing_page_view", {
      path: window.location.pathname,
      loggedIn: isLoggedIn,
    });
  }, [isLoggedIn]);

  return (
    <MarketingChromeContext.Provider value={ctx}>
      <div className="min-h-screen landing-atmosphere">
        <LandingNav
          scrolled={scrolled}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          isLoggedIn={isLoggedIn}
          onGoToFreeViewer={goToFreeViewer}
        />
        <main className="pb-24 md:pb-0">{children}</main>
        <div className="fixed inset-x-3 bottom-3 z-40 md:hidden">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.45)] backdrop-blur">
            {!isLoggedIn ? (
              <Link
                href="/sign-in"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              >
                Sign in
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => goToFreeViewer("mobile_sticky_open_viewer")}
              className="btn-shine inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-(--landing-cta) px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-(--landing-cta-bright)"
            >
              Open free viewer
            </button>
          </div>
        </div>
        <LandingFooter onGoToFreeViewer={goToFreeViewer} />
        <CookieConsentDialog />
      </div>
    </MarketingChromeContext.Provider>
  );
}
