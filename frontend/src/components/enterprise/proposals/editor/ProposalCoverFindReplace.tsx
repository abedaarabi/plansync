"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { ChevronDown, ChevronUp, Replace, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  editor: Editor;
  open: boolean;
  onClose: () => void;
};

export function ProposalCoverFindReplace({ editor, open, onClose }: Props) {
  const findRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: (snap) => {
      const fr = (
        snap.editor.storage as {
          findAndReplace?: {
            searchTerm: string;
            replaceTerm: string;
            results: unknown[];
            currentIndex: number | null;
            caseSensitive: boolean;
            wholeWord: boolean;
          };
        }
      ).findAndReplace;
      return {
        searchTerm: fr?.searchTerm ?? "",
        replaceTerm: fr?.replaceTerm ?? "",
        count: fr?.results?.length ?? 0,
        current: fr?.currentIndex != null ? fr.currentIndex + 1 : 0,
        caseSensitive: fr?.caseSensitive ?? false,
        wholeWord: fr?.wholeWord ?? false,
      };
    },
  });

  useEffect(() => {
    if (!open) {
      editor.commands.clearSearch();
      return;
    }
    findRef.current?.focus();
    findRef.current?.select();
  }, [open, editor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        findRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5">
      <Search className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]" aria-hidden />
      <input
        ref={findRef}
        value={state.searchTerm}
        onChange={(e) => editor.commands.setSearchTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) editor.commands.goToPreviousResult();
            else editor.commands.goToNextResult();
          }
        }}
        placeholder="Find"
        className="h-8 w-36 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-xs focus:border-[var(--enterprise-primary)] focus:outline-none sm:w-44"
      />
      <span className="min-w-[3.5rem] text-[11px] text-[var(--enterprise-text-muted)]">
        {state.count ? `${state.current}/${state.count}` : "0"}
      </span>
      <button
        type="button"
        title="Previous"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
        onClick={() => editor.commands.goToPreviousResult()}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Next"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
        onClick={() => editor.commands.goToNextResult()}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <Replace
        className="ml-1 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
        aria-hidden
      />
      <input
        value={state.replaceTerm}
        onChange={(e) => editor.commands.setReplaceTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editor.commands.replace();
          }
        }}
        placeholder="Replace"
        className="h-8 w-32 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 text-xs focus:border-[var(--enterprise-primary)] focus:outline-none sm:w-40"
      />
      <button
        type="button"
        className="rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-[11px] font-semibold text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
        onClick={() => editor.commands.replace()}
      >
        Replace
      </button>
      <button
        type="button"
        className="rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-[11px] font-semibold text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
        onClick={() => editor.commands.replaceAll()}
      >
        All
      </button>
      <label className="ml-1 flex items-center gap-1 text-[11px] text-[var(--enterprise-text-muted)]">
        <input
          type="checkbox"
          checked={state.caseSensitive}
          onChange={(e) => editor.commands.setCaseSensitive(e.target.checked)}
        />
        Aa
      </label>
      <label className="flex items-center gap-1 text-[11px] text-[var(--enterprise-text-muted)]">
        <input
          type="checkbox"
          checked={state.wholeWord}
          onChange={(e) => editor.commands.setWholeWord(e.target.checked)}
        />
        Word
      </label>
      <button
        type="button"
        title="Close"
        className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
