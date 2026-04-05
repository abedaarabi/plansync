"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, LogOut, Radio, StopCircle, Users } from "lucide-react";
import { fetchMe, fetchProjectTeam, type ProjectTeamMemberRow } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";
import { meHasProWorkspace } from "@/lib/proWorkspace";
import { collabColorForUser, useViewerCollab } from "../viewerCollabContext";
import { ViewerUserThumb } from "../ViewerUserThumb";
import { useViewerCollabDesktop } from "@/hooks/useViewerCollabDesktop";
import { toast } from "sonner";

function memberRow(
  team: ProjectTeamMemberRow[] | undefined,
  userId: string,
): { name: string; email: string; image: string | null | undefined } {
  const row = team?.find((m) => m.userId === userId);
  return {
    name: row?.name ?? userId.slice(0, 8),
    email: row?.email ?? "",
    image: row?.image,
  };
}

export function SidebarCollabTab() {
  const collab = useViewerCollab();
  const desktop = useViewerCollabDesktop();
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const [ending, setEnding] = useState(false);

  const { data: me } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  const { data: projectTeam } = useQuery({
    queryKey: qk.projectTeam(viewerProjectId ?? ""),
    queryFn: () => fetchProjectTeam(viewerProjectId!),
    enabled: Boolean(viewerProjectId) && Boolean(collab?.collabFeatureEnabled),
    staleTime: 30_000,
  });

  const team = projectTeam?.members;

  const presenceSorted = useMemo(() => {
    if (!collab?.presenceMembers?.length) return [];
    return [...collab.presenceMembers].sort((a, b) => a.userId.localeCompare(b.userId));
  }, [collab?.presenceMembers]);

  const myId = me?.user?.id;

  if (!collab || !collab.collabFeatureEnabled) {
    return (
      <p className="px-1.5 text-center text-[11px] leading-relaxed text-[#94A3B8]">
        Live collaboration is available on Pro project sheets.
      </p>
    );
  }

  const isHost = Boolean(myId && collab.sessionHostUserId === myId);
  const canUseTransport = collab.collabActive;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-0.5 [scrollbar-width:thin]">
      <div className="rounded-lg border border-[#334155] bg-[#1E293B]/90 p-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <Radio
            className={`h-4 w-4 shrink-0 ${
              collab.connectionStatus === "live"
                ? "text-emerald-400"
                : collab.connectionStatus === "reconnecting"
                  ? "text-amber-400"
                  : "text-slate-500"
            }`}
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-[11px] font-semibold text-[#F8FAFC]">Live on this sheet</span>
        </div>
        <p className="text-[10px] leading-snug text-[#94A3B8]">
          See who is viewing and share pointers. Open this link while signed in as another teammate
          to appear as a second person.
        </p>
        {!desktop ? (
          <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/35 px-2 py-1.5 text-[10px] text-amber-100/90">
            Widen the window to desktop width — live cursors and presence use the full layout.
          </p>
        ) : null}
        {!canUseTransport && desktop ? (
          <p className="mt-2 rounded-md border border-sky-900/40 bg-sky-950/30 px-2 py-1.5 text-[10px] text-sky-100/90">
            You are not in the live session. Rejoin below to appear for others and see their
            cursors.
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="viewer-section-title mb-1.5 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[#94A3B8]" strokeWidth={2} aria-hidden />
          People here
        </h3>
        <ul className="space-y-1 rounded-lg border border-[#334155] bg-[#0F172A] p-1">
          {presenceSorted.length === 0 ? (
            <li className="px-2 py-3 text-center text-[10px] text-[#64748B]">No one listed yet.</li>
          ) : (
            presenceSorted.map((m) => {
              const info = memberRow(team, m.userId);
              const you = myId === m.userId;
              const host = collab.sessionHostUserId === m.userId;
              return (
                <li
                  key={m.userId}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-[#1E293B]/80"
                >
                  <span
                    className="shrink-0 rounded-full p-0.5 ring-2 ring-[#0F172A]"
                    style={{ backgroundColor: collabColorForUser(m.userId) }}
                  >
                    <ViewerUserThumb
                      shape="circle"
                      name={info.name}
                      email={info.email}
                      image={you ? me?.user?.image : info.image}
                      className="h-8 w-8 border-0 text-[10px]"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-[#F8FAFC]">
                      {info.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 text-[9px] text-[#64748B]">
                      {you ? <span className="text-sky-400/90">You</span> : null}
                      {host ? (
                        <span className="rounded bg-violet-950/80 px-1 py-px text-violet-200/95">
                          Host
                        </span>
                      ) : null}
                      {m.pageIndex != null ? (
                        <button
                          type="button"
                          className="text-sky-400 hover:underline"
                          onClick={() => setCurrentPage(m.pageIndex! + 1)}
                        >
                          Page {m.pageIndex + 1}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-1.5 border-t border-[#334155] pt-2">
        <button
          type="button"
          className="viewer-focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-[#334155] bg-[#1E293B] py-2 text-[11px] font-medium text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#334155]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied", {
                description:
                  "Teammates with project access can open this sheet. Use a different account to show up as a second person.",
              });
            } catch {
              toast.error("Could not copy link.");
            }
          }}
        >
          <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Copy sheet link
        </button>

        {canUseTransport ? (
          <button
            type="button"
            className="viewer-focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-900/60 py-2 text-[11px] font-medium text-slate-200 transition hover:bg-slate-800"
            onClick={() => collab.leaveCollab()}
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Leave live session
          </button>
        ) : (
          <button
            type="button"
            className="viewer-focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-emerald-900/50 bg-emerald-950/40 py-2 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-950/65 disabled:opacity-40"
            disabled={!desktop}
            onClick={() => collab.rejoinCollab()}
          >
            <Radio className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Rejoin live session
          </button>
        )}

        {canUseTransport && isHost && meHasProWorkspace(me ?? null) ? (
          <button
            type="button"
            disabled={ending}
            className="viewer-focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-red-900/55 bg-red-950/45 py-2 text-[11px] font-medium text-red-100 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
            title="Disconnect live collaboration for everyone viewing this revision"
            onClick={() => {
              void (async () => {
                setEnding(true);
                try {
                  await collab.endSessionForAll();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not end session.");
                } finally {
                  setEnding(false);
                }
              })();
            }}
          >
            <StopCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {ending ? "Ending…" : "End session for everyone"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
