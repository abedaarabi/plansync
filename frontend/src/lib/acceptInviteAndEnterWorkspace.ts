import { apiUrl } from "@/lib/api-url";
import { workspaceGateUrl } from "@/lib/workspacePreference";

type AcceptInviteResult = { ok: true } | { ok: false; error: string };

type RouterLike = {
  replace: (href: string) => void;
  refresh: () => void;
};

export async function acceptInviteAndEnterWorkspace(
  acceptPath: string,
  router: RouterLike,
): Promise<AcceptInviteResult> {
  const res = await fetch(apiUrl(acceptPath), {
    method: "POST",
    credentials: "include",
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 402) {
    return {
      ok: false,
      error: "This workspace requires an active Pro subscription for invites.",
    };
  }
  if (!res.ok) {
    return { ok: false, error: j.error ?? "Could not join workspace." };
  }
  router.replace(workspaceGateUrl("/dashboard"));
  router.refresh();
  return { ok: true };
}
