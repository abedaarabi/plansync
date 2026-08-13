"use client";

import { useCallback, useEffect, useState } from "react";

/** Persist Insights panel open/seen flags (session + localStorage), shared by Files/WO overviews. */
export function useInsightsPanelState(openKey: string, seenKey: string) {
  const [insightsOpen, setInsightsOpen] = useState(false);
  /** null until hydrated — avoid flashing the “new” badge incorrectly. */
  const [insightsSeen, setInsightsSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setInsightsSeen(localStorage.getItem(seenKey) === "1");
      if (sessionStorage.getItem(openKey) === "1") setInsightsOpen(true);
    } catch {
      setInsightsSeen(true);
    }
  }, [openKey, seenKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(openKey, insightsOpen ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [insightsOpen, openKey]);

  const openInsights = useCallback(() => {
    setInsightsOpen(true);
    setInsightsSeen((prev) => {
      if (prev === true) return prev;
      try {
        localStorage.setItem(seenKey, "1");
      } catch {
        /* private mode */
      }
      return true;
    });
  }, [seenKey]);

  return { insightsOpen, setInsightsOpen, insightsSeen, openInsights };
}
