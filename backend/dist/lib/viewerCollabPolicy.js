export function collaborationGloballyEnabled(env) {
    return env.COLLABORATION_ENABLED;
}
export function collaborationEnabledForWorkspace(env, workspace) {
    return collaborationGloballyEnabled(env) && workspace.viewerCollaborationEnabled;
}
