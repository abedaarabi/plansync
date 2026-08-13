"use client";

import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  const pathname = usePathname();
  const isHome = pathname === "/";
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
      <div className="min-h-dvh min-w-0 landing-atmosphere">
        <LandingNav
          scrolled={scrolled}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          isLoggedIn={isLoggedIn}
          onGoToFreeViewer={goToFreeViewer}
          dark={isHome}
        />
        <main className="marketing-main-inner">{children}</main>
        <LandingFooter onGoToFreeViewer={goToFreeViewer} />
        <CookieConsentDialog />
      </div>
    </MarketingChromeContext.Provider>
  );
}
