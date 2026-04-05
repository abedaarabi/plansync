import type { Env } from "./env.js";

export function collaborationGloballyEnabled(env: Env): boolean {
  return env.COLLABORATION_ENABLED;
}

export function collaborationEnabledForWorkspace(
  env: Env,
  workspace: { viewerCollaborationEnabled: boolean },
): boolean {
  return collaborationGloballyEnabled(env) && workspace.viewerCollaborationEnabled;
}
