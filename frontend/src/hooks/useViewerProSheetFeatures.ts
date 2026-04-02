"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api-client";
import { viewerHasProSheetFeatures } from "@/lib/proWorkspace";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

/**
 * Whether Issues / RFIs / takeoff-on-sheet (and similar) should be shown in `/viewer`.
 * False for local PDFs and until `me` has loaded.
 */
export function useViewerProSheetFeatures() {
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const { data: me, isPending } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  });
  const enabled = !isPending && viewerHasProSheetFeatures(me, cloudFileVersionId);
  return { enabled, isPending, cloudFileVersionId };
}
