"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api-client";
import { viewerHasProPlusSheetFeatures, viewerHasProSheetFeatures } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

/**
 * Whether Team+ sheet features (issues, RFIs, collab) should be shown in `/viewer`.
 * False for local PDFs and until `me` has loaded.
 * `takeoffEnabled` is Pro+ only (not Team).
 */
export function useViewerProSheetFeatures() {
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const { data: me, isPending } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  });
  const enabled = !isPending && viewerHasProSheetFeatures(me, cloudFileVersionId);
  const takeoffEnabled = !isPending && viewerHasProPlusSheetFeatures(me, cloudFileVersionId);
  return { enabled, takeoffEnabled, isPending, cloudFileVersionId };
}
