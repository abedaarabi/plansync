/**
 * Who can appear on a project Team page: full-workspace members, or project-scoped
 * members that include this project.
 */
export function buildProjectTeamMembers(workspaceMembers, projectMemberPairs, projectId) {
    const byUser = new Map();
    for (const row of projectMemberPairs) {
        let set = byUser.get(row.userId);
        if (!set) {
            set = new Set();
            byUser.set(row.userId, set);
        }
        set.add(row.projectId);
    }
    const out = [];
    for (const wm of workspaceMembers) {
        const scoped = byUser.get(wm.userId);
        if (!scoped || scoped.size === 0) {
            out.push({
                ...wm,
                access: "full",
                canRemoveFromProject: false,
            });
            continue;
        }
        if (scoped.has(projectId)) {
            out.push({
                ...wm,
                access: "project",
                canRemoveFromProject: true,
            });
        }
    }
    return out;
}
