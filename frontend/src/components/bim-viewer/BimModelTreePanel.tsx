"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import type { BimVisibilityGroup } from "./bimEngine";
import { filterVisibilityGroups, groupCategoriesByDiscipline } from "./bimModelTree";

// fallow-ignore-next-line complexity
export function BimModelTreePanel(props: {
  storeys: BimVisibilityGroup[];
  categories: BimVisibilityGroup[];
  collapsed?: boolean;
  embedded?: boolean;
  onToggleCollapsed?: () => void;
  onToggle: (kind: "storey" | "category", name: string, visible: boolean) => void;
  onShowAll: () => void;
}) {
  const [search, setSearch] = useState("");
  const [levelsOpen, setLevelsOpen] = useState(true);
  const [disciplinesOpen, setDisciplinesOpen] = useState(true);
  const [openDisciplines, setOpenDisciplines] = useState<Set<string>>(
    () => new Set(["architecture", "structure", "mechanical", "electrical", "mep"]),
  );

  const filteredStoreys = useMemo(
    () => filterVisibilityGroups(props.storeys, search),
    [props.storeys, search],
  );
  const disciplines = useMemo(
    () => groupCategoriesByDiscipline(filterVisibilityGroups(props.categories, search)),
    [props.categories, search],
  );

  if (props.collapsed && !props.embedded) {
    return (
      <div className="hidden shrink-0 flex-col items-center border-r border-[var(--bim-border)] bg-[var(--bim-panel)] py-2 sm:flex sm:w-10">
        <button
          type="button"
          onClick={props.onToggleCollapsed}
          aria-label="Expand model tree"
          className="bim-focus-ring bim-tool-btn"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  const shellClass = props.embedded
    ? "flex min-h-0 flex-1 flex-col"
    : "bim-panel-embedded hidden w-64 shrink-0 sm:flex sm:w-72";

  return (
    <aside className={shellClass} aria-label="Model tree">
      {!props.embedded ? (
        <div className="flex items-center gap-2 border-b border-[var(--bim-border)] px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--bim-text)]">
            Model tree
          </p>
          <button
            type="button"
            onClick={props.onShowAll}
            className="bim-focus-ring shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--bim-accent)] transition-colors duration-150 hover:bg-[var(--bim-hover)]"
          >
            Show all
          </button>
          {props.onToggleCollapsed ? (
            <button
              type="button"
              onClick={props.onToggleCollapsed}
              aria-label="Collapse model tree"
              className="bim-focus-ring bim-tool-btn"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-[var(--bim-border)] px-4 py-2">
          <p className="text-[11px] font-medium text-[var(--bim-text-muted)]">
            Levels & disciplines
          </p>
          <button
            type="button"
            onClick={props.onShowAll}
            className="bim-focus-ring shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--bim-accent)] hover:bg-[var(--bim-hover)]"
          >
            Show all
          </button>
        </div>
      )}

      {!props.embedded ? (
        <div className="border-b border-[var(--bim-border)] px-4 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--bim-text-muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search levels, types…"
              aria-label="Search model tree"
              className="bim-input pl-8"
            />
          </div>
        </div>
      ) : (
        <div className="border-b border-[var(--bim-border)] px-4 py-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--bim-text-muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search levels, types…"
              aria-label="Search model tree"
              className="bim-input pl-8"
            />
          </div>
        </div>
      )}

      <div className="bim-dock-scroll px-2 py-2">
        <TreeSection title="Levels" open={levelsOpen} onToggle={() => setLevelsOpen((v) => !v)}>
          {filteredStoreys.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-[var(--bim-text-muted)]">No levels found.</p>
          ) : (
            filteredStoreys.map((g) => (
              <VisibilityRow
                key={`storey-${g.name}`}
                label={g.name}
                visible={g.visible}
                onToggle={(visible) => props.onToggle("storey", g.name, visible)}
              />
            ))
          )}
        </TreeSection>

        <TreeSection
          title="Disciplines"
          open={disciplinesOpen}
          onToggle={() => setDisciplinesOpen((v) => !v)}
        >
          {disciplines.map((d) => {
            const open = openDisciplines.has(d.id);
            const allVisible = d.categories.every((c) => c.visible);
            const someVisible = d.categories.some((c) => c.visible);
            return (
              <div key={d.id} className="mb-0.5">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDisciplines((prev) => {
                        const next = new Set(prev);
                        if (next.has(d.id)) next.delete(d.id);
                        else next.add(d.id);
                        return next;
                      })
                    }
                    aria-expanded={open}
                    className="bim-focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)]"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      for (const c of d.categories) {
                        props.onToggle("category", c.name, !allVisible);
                      }
                    }}
                    className="bim-focus-ring bim-tree-row min-w-0 flex-1"
                    aria-pressed={someVisible}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{d.label}</span>
                    <span className="shrink-0 text-[10px] text-[var(--bim-text-muted)]">
                      {d.categories.length}
                    </span>
                    {allVisible ? (
                      <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]" aria-hidden />
                    ) : (
                      <EyeOff
                        className="h-3.5 w-3.5 shrink-0 text-[var(--bim-text-muted)]"
                        aria-hidden
                      />
                    )}
                  </button>
                </div>
                {open ? (
                  <div className="ml-5 border-l border-[var(--bim-border)] pl-1">
                    {d.categories.map((c) => (
                      <VisibilityRow
                        key={`cat-${c.name}`}
                        label={c.name.replace(/^Ifc/i, "")}
                        visible={c.visible}
                        nested
                        onToggle={(visible) => props.onToggle("category", c.name, visible)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </TreeSection>
      </div>
    </aside>
  );
}

function TreeSection(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={props.open}
        className="bim-focus-ring mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left"
      >
        {props.open ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--bim-text-muted)]" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--bim-text-muted)]" aria-hidden />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-text-muted)]">
          {props.title}
        </span>
      </button>
      {props.open ? props.children : null}
    </div>
  );
}

function VisibilityRow(props: {
  label: string;
  visible: boolean;
  nested?: boolean;
  onToggle: (visible: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onToggle(!props.visible)}
      aria-pressed={props.visible}
      className={`bim-focus-ring bim-tree-row ${props.nested ? "py-1" : ""}`}
    >
      {props.visible ? (
        <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]" aria-hidden />
      ) : (
        <EyeOff className="h-3.5 w-3.5 shrink-0 text-[var(--bim-text-muted)]" aria-hidden />
      )}
      <span
        className={`min-w-0 flex-1 truncate ${props.visible ? "" : "text-[var(--bim-text-muted)] line-through"}`}
      >
        {props.label}
      </span>
    </button>
  );
}
