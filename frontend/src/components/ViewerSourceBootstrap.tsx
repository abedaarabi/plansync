"use client";

import { apiUrl } from "@/lib/api-url";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, fetchResolvedFileRevision } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

/** Dedupe React Strict Mode double-invoke for audit POST (same module lifetime). */
const loggedFileOpenAudit = new Set<string>();

/**
 * When `/viewer?fileId=…&name=…` (optional `&version=N`, `&fileVersionId=…`) is opened from cloud
 * Projects, load PDF from `/api/v1/files/:id/content`. `fileVersionId` enables Pro cloud persistence
 * for markups, measurements, and calibration (`FileVersion.annotationBlob`).
 * Logs FILE_OPENED via `POST /api/v1/files/:fileId/open` (project resolved server-side).
 */
export function ViewerSourceBootstrap() {
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId");
  const nameParam = searchParams.get("name");
  const versionParam = searchParams.get("version");
  const fileVersionIdParam = searchParams.get("fileVersionId");
  const projectIdParam = searchParams.get("projectId");
  const setPdf = useViewerStore((s) => s.setPdf);
  const { data: me, isPending: mePending } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!fileId) return;

    let cancelled = false;

    void (async () => {
      const displayName = nameParam ? decodeURIComponent(nameParam) : "document.pdf";
      const v =
        versionParam != null && versionParam !== ""
          ? `?version=${encodeURIComponent(versionParam)}`
          : "";
      // Use same-origin for PDF bytes so browser cookies are always included for protected files.
      // (Cross-origin api host can be fetched by app calls with credentials, but pdf.js URL loads are less reliable.)
      const contentUrl = `/api/v1/files/${encodeURIComponent(fileId)}/content${v}`;

      let cloudFv: string | null =
        fileVersionIdParam != null && fileVersionIdParam !== "" ? fileVersionIdParam : null;
      let resolvedProjectId: string | null = null;

      if (!cloudFv) {
        try {
          const verN =
            versionParam != null && versionParam !== "" ? Number(versionParam) : undefined;
          const resolved = await fetchResolvedFileRevision(
            fileId,
            verN != null && !Number.isNaN(verN) ? verN : undefined,
          );
          if (cancelled) return;
          cloudFv = resolved.fileVersionId;
          resolvedProjectId = resolved.projectId;
        } catch {
          /* Not Pro, offline, or missing access — still open the PDF without a version row id. */
        }
      } else if (projectIdParam == null || projectIdParam.trim() === "") {
        /**
         * Deep links often pass `fileVersionId` without `projectId`. Sidebar Pro tabs (takeoff,
         * issues, …) require `viewerProjectId` — resolve it from the same revision endpoint while
         * keeping the URL's `cloudFv` as the source of truth.
         */
        try {
          const verN =
            versionParam != null && versionParam !== "" ? Number(versionParam) : undefined;
          const resolved = await fetchResolvedFileRevision(
            fileId,
            verN != null && !Number.isNaN(verN) ? verN : undefined,
          );
          if (cancelled) return;
          resolvedProjectId = resolved.projectId;
        } catch {
          /* Same as unresolved revision — PDF may still load from content URL. */
        }
      }

      if (cancelled) return;

      const viewerProjectId =
        projectIdParam != null && projectIdParam.trim() !== ""
          ? projectIdParam.trim()
          : resolvedProjectId;

      setPdf(contentUrl, displayName, null, {
        cloudFileVersionId: cloudFv,
        viewerProjectId,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, nameParam, versionParam, fileVersionIdParam, projectIdParam, setPdf]);

  useEffect(() => {
    if (!fileId || mePending || !me) return;
    const key = `${fileId}:${versionParam ?? ""}:${fileVersionIdParam ?? ""}`;
    if (loggedFileOpenAudit.has(key)) return;
    loggedFileOpenAudit.add(key);
    const body: { fileVersionId?: string; version?: number } = {};
    if (fileVersionIdParam) body.fileVersionId = fileVersionIdParam;
    if (versionParam != null && versionParam !== "") {
      const n = Number(versionParam);
      if (!Number.isNaN(n)) body.version = n;
    }
    void fetch(apiUrl(`/api/v1/files/${encodeURIComponent(fileId)}/open`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (res.ok) return;
        if (res.status === 402) return;
        loggedFileOpenAudit.delete(key);
      })
      .catch(() => {
        loggedFileOpenAudit.delete(key);
      });
  }, [fileId, versionParam, fileVersionIdParam, mePending, me]);

  return null;
}
