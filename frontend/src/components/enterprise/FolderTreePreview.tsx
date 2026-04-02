"use client";

import type { FolderTemplateNode } from "@/lib/api-client";

export function FolderTreePreview({
  nodes,
  depth = 0,
}: {
  nodes: FolderTemplateNode[];
  depth?: number;
}) {
  if (!nodes.length) {
    return (
      <p className="text-[12px] text-[var(--enterprise-text-muted)]">
        No folders in this template.
      </p>
    );
  }
  return (
    <ul
      className={`space-y-1 ${depth > 0 ? "mt-1 border-l border-[var(--enterprise-border)] pl-3" : ""}`}
    >
      {nodes.map((n, i) => (
        <li key={`${depth}-${i}-${n.name}`}>
          <span className="text-[12px] text-[var(--enterprise-text)]">{n.name}</span>
          {n.children?.length ? <FolderTreePreview nodes={n.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}
