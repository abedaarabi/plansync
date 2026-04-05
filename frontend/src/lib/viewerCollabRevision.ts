/** Client-side revision for optimistic locking on viewer-state PUT (-1 = unknown / omit baseRevision). */
let viewerCollabRevision = -1;

export function resetViewerCollabRevision(): void {
  viewerCollabRevision = -1;
}

export function getViewerCollabRevision(): number {
  return viewerCollabRevision;
}

export function setViewerCollabRevision(n: number): void {
  viewerCollabRevision = n;
}
