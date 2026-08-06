"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Eye, Loader2, Maximize2, Pencil, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "tippy.js/dist/tippy.css";
import type { RfiMentionItem } from "@/components/enterprise/RfiMentionList";
import { ProposalCoverBubbleMenu } from "@/components/enterprise/proposals/editor/ProposalCoverBubbleMenu";
import { ProposalCoverFindReplace } from "@/components/enterprise/proposals/editor/ProposalCoverFindReplace";
import { ProposalCoverToolbar } from "@/components/enterprise/proposals/editor/ProposalCoverToolbar";
import { createProposalCoverExtensions } from "@/components/enterprise/proposals/editor/proposalCoverExtensions";
import {
  resolveProposalMergePreview,
  wrapProposalMergeFieldsAsMentions,
} from "@/components/enterprise/proposals/editor/proposalCoverMerge";
import {
  cleanPastedCoverHtml,
  filesFromDataTransfer,
  readImageFileAsDataUrl,
} from "@/components/enterprise/proposals/editor/proposalCoverPaste";
import type { CoverVariable } from "@/components/enterprise/proposals/editor/proposalCoverTypes";
import "@/components/enterprise/proposals/editor/proposalCoverEditor.css";

type Props = {
  content?: string;
  onChange?: (html: string, json: Record<string, unknown>) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  variables?: CoverVariable[];
  insertPayload?: { key: string; text: string } | null;
  contentRevision?: number;
  /**
   * `document` — proposal cover letter (merge fields).
   * `discussion` — RFI/thread composer (@mentions + Post).
   */
  variant?: "document" | "discussion";
  mentionUsers?: RfiMentionItem[];
  onSubmit?: (html: string) => void;
  isPending?: boolean;
  disabled?: boolean;
};

function EditorStats({ editor }: { editor: Editor }) {
  const stats = useEditorState({
    editor,
    selector: (snap) => {
      const storage = snap.editor.storage as {
        characterCount?: { characters: () => number; words: () => number };
      };
      return {
        chars: storage.characterCount?.characters() ?? snap.editor.getText().length,
        words: storage.characterCount?.words() ?? 0,
      };
    },
  });
  return (
    <span>
      {stats.words} words · {stats.chars} characters
    </span>
  );
}

function canSubmitHtml(editor: Editor): boolean {
  return editor.getText().trim().length > 0;
}

async function insertImagesAt(editor: Editor, files: File[], pos?: number) {
  for (const file of files) {
    try {
      const src = await readImageFileAsDataUrl(file);
      if (pos != null) {
        editor.chain().focus().insertContentAt(pos, { type: "image", attrs: { src } }).run();
      } else {
        editor.chain().focus().setImage({ src }).run();
      }
    } catch {
      // skip unreadable files
    }
  }
}

// fallow-ignore-next-line complexity
export function ProposalCoverEditor({
  content = "",
  onChange,
  placeholder,
  readOnly,
  className,
  variables = [],
  insertPayload = null,
  contentRevision = 0,
  variant = "document",
  mentionUsers = [],
  onSubmit,
  isPending = false,
  disabled = false,
}: Props) {
  const isDiscussion = variant === "discussion";
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [findOpen, setFindOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const lastInsertKeyRef = useRef<string | null>(null);
  const lastRevisionRef = useRef<number | null>(null);
  const variablesRef = useRef(variables);
  variablesRef.current = variables;
  const mentionUsersRef = useRef(mentionUsers);
  mentionUsersRef.current = mentionUsers;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editorRef = useRef<Editor | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const onRequestImageUrlRef = useRef(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const url = window.prompt("Image URL", "https://");
    if (!url?.trim()) return;
    ed.chain().focus().setImage({ src: url.trim() }).run();
  });

  const defaultPlaceholder = isDiscussion
    ? "Write a reply… Type / for blocks, @ to mention someone."
    : "Start writing… Type / for blocks, # for merge fields.";

  const extensions = useMemo(
    () =>
      createProposalCoverExtensions({
        placeholder: placeholder ?? defaultPlaceholder,
        getVariables: () => variablesRef.current,
        getMentionUsers: () => mentionUsersRef.current,
        mentionMode: isDiscussion ? "users" : "mergeFields",
        onRequestImageUrl: () => onRequestImageUrlRef.current(),
        includeFindReplace: true,
      }),
    [placeholder, defaultPlaceholder, isDiscussion],
  );

  const initialHtml = isDiscussion
    ? content || "<p></p>"
    : wrapProposalMergeFieldsAsMentions(content || "<p></p>");

  const editor = useEditor(
    {
      extensions,
      content: initialHtml,
      immediatelyRender: false,
      editable: !readOnly && !disabled,
      shouldRerenderOnTransaction: false,
      onUpdate({ editor: ed }) {
        onChangeRef.current?.(ed.getHTML(), ed.getJSON() as Record<string, unknown>);
      },
      editorProps: {
        attributes: {
          class: `tiptap focus:outline-none${isDiscussion ? " proposal-cover-discussion" : ""}`,
          spellcheck: "true",
        },
        transformPastedHTML: (html) => cleanPastedCoverHtml(html),
        handlePaste: (_view, event) => {
          const files = filesFromDataTransfer(event.clipboardData);
          const ed = editorRef.current;
          if (!files.length || !ed) return false;
          event.preventDefault();
          void insertImagesAt(ed, files);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const files = filesFromDataTransfer(event.dataTransfer);
          const ed = editorRef.current;
          if (!files.length || !ed) return false;
          event.preventDefault();
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          void insertImagesAt(ed, files, coords?.pos);
          return true;
        },
      },
    },
    [extensions],
  );

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    if (lastRevisionRef.current === contentRevision) return;
    lastRevisionRef.current = contentRevision;
    const next = isDiscussion
      ? content || "<p></p>"
      : wrapProposalMergeFieldsAsMentions(content || "<p></p>");
    editor.commands.setContent(next, { emitUpdate: false });
  }, [contentRevision, content, editor, isDiscussion]);

  useEffect(() => {
    if (!editor || isDiscussion) return;
    if (contentRevision > 0 && lastRevisionRef.current === contentRevision) return;
    const current = editor.getHTML();
    const nextRaw = content || "<p></p>";
    if (!nextRaw || nextRaw === current) return;
    const next = wrapProposalMergeFieldsAsMentions(nextRaw);
    if (next === current) return;
    const plainCurrent = current
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const plainNext = nextRaw
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (plainCurrent === plainNext && editor.isFocused) return;
    if (plainCurrent.length > 0 && editor.isFocused) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [content, contentRevision, editor, isDiscussion]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly && !disabled && mode === "edit");
  }, [editor, readOnly, disabled, mode]);

  useEffect(() => {
    if (!editor || !insertPayload) return;
    if (lastInsertKeyRef.current === insertPayload.key) return;
    lastInsertKeyRef.current = insertPayload.key;
    const text = insertPayload.text;
    const m = text.match(/^\{\{([a-zA-Z0-9_.]+)\}\}$/);
    if (m) {
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "mention", attrs: { id: m[1], label: m[1] } },
          { type: "text", text: " " },
        ])
        .run();
    } else {
      editor.chain().focus().insertContent(text).run();
    }
  }, [editor, insertPayload]);

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [focusMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "f") return;
      if (mode !== "edit" || readOnly || disabled) return;
      const t = e.target as Node | null;
      if (!shellRef.current || !t || !shellRef.current.contains(t)) return;
      e.preventDefault();
      setFindOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, readOnly, disabled]);

  const mergeValues = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of variables) map[v.key] = v.value;
    return map;
  }, [variables]);

  const previewHtml = useMemo(() => {
    if (mode !== "preview") return "";
    const raw = editor?.getHTML() ?? content ?? "";
    if (isDiscussion) return raw;
    return resolveProposalMergePreview(raw, mergeValues);
  }, [mode, editor, content, mergeValues, isDiscussion]);

  if (!editor) {
    return (
      <div
        className={`min-h-[12rem] animate-pulse rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] ${className ?? ""}`}
      />
    );
  }

  const hint = isDiscussion ? (
    <>
      <kbd className="rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 font-mono">
        /
      </kbd>{" "}
      blocks ·{" "}
      <kbd className="rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 font-mono">
        @
      </kbd>{" "}
      mention
    </>
  ) : (
    <>
      <kbd className="rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 font-mono">
        /
      </kbd>{" "}
      blocks ·{" "}
      <kbd className="rounded border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1 font-mono">
        #
      </kbd>{" "}
      fields · drag images
    </>
  );

  return (
    <>
      {focusMode ? (
        <button
          type="button"
          aria-label="Close focus mode"
          className="fixed inset-x-0 bottom-0 top-[var(--enterprise-topbar-offset)] z-[79] bg-[color-mix(in_srgb,var(--enterprise-text)_28%,transparent)] backdrop-blur-[1px]"
          onClick={() => setFocusMode(false)}
        />
      ) : null}
      <div
        ref={shellRef}
        className={`proposal-cover-editor flex flex-col overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] shadow-[var(--enterprise-shadow-xs)] ${
          focusMode
            ? "proposal-cover-editor--focus fixed bottom-2 left-2 right-2 z-[80] rounded-xl shadow-[var(--enterprise-shadow-floating)] sm:bottom-4 sm:left-4 sm:right-4 top-[calc(var(--enterprise-topbar-offset)+0.5rem)]"
            : ""
        } ${isDiscussion ? "proposal-cover-editor--discussion" : ""} ${className ?? ""}`}
      >
        {!readOnly && !isDiscussion && (
          <div className="flex items-center justify-between gap-2 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1">
            <div className="flex rounded-lg border border-[var(--enterprise-border)] p-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  mode === "edit"
                    ? "bg-[var(--enterprise-primary)] text-white"
                    : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
                }`}
              >
                <Pencil className="h-3 w-3" aria-hidden />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  mode === "preview"
                    ? "bg-[var(--enterprise-primary)] text-white"
                    : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
                }`}
              >
                <Eye className="h-3 w-3" aria-hidden />
                Preview
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {!focusMode ? (
                <p className="hidden text-[11px] text-[var(--enterprise-text-muted)] lg:block">
                  {hint}
                </p>
              ) : null}
              {focusMode ? (
                <button
                  type="button"
                  title="Close focus mode"
                  aria-label="Close focus mode"
                  onClick={() => setFocusMode(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)] max-lg:min-h-11"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Close
                </button>
              ) : (
                <button
                  type="button"
                  title="Focus mode"
                  aria-label="Open focus mode"
                  onClick={() => setFocusMode(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                  Focus
                </button>
              )}
            </div>
          </div>
        )}
        {!readOnly && isDiscussion ? (
          <div className="flex items-center justify-end gap-1 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)] px-1.5 py-0.5">
            {focusMode ? (
              <button
                type="button"
                title="Close focus mode"
                aria-label="Close focus mode"
                onClick={() => setFocusMode(false)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--enterprise-border)] px-2 text-[11px] font-semibold text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
              >
                <X className="h-3 w-3" aria-hidden />
                Close
              </button>
            ) : (
              <button
                type="button"
                title="Expand editor"
                aria-label="Open focus mode"
                onClick={() => setFocusMode(true)}
                className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
              >
                <Maximize2 className="h-3 w-3" aria-hidden />
                Expand
              </button>
            )}
          </div>
        ) : null}

        {!readOnly && mode === "edit" && (
          <>
            <ProposalCoverToolbar
              editor={editor}
              variables={isDiscussion ? [] : variables}
              onOpenFind={() => setFindOpen(true)}
              onInsertImageUrl={() => onRequestImageUrlRef.current()}
            />
            <ProposalCoverFindReplace
              editor={editor}
              open={findOpen}
              onClose={() => setFindOpen(false)}
            />
            <ProposalCoverBubbleMenu editor={editor} />
          </>
        )}

        <div
          className={`enterprise-scrollbar flex-1 overflow-y-auto bg-[var(--enterprise-bg)] ${
            isDiscussion
              ? focusMode
                ? "px-2 py-2 sm:px-3 sm:py-3"
                : "px-1.5 py-1.5"
              : "px-3 py-4 sm:px-6 sm:py-6"
          }`}
        >
          {mode === "preview" ? (
            <div className={isDiscussion ? "" : "proposal-cover-page"}>
              <div
                className={`${isDiscussion ? "rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2" : "proposal-cover-page-inner"} tiptap [&_.proposal-merge-missing]:rounded [&_.proposal-merge-missing]:bg-[var(--enterprise-semantic-warning-bg)] [&_.proposal-merge-missing]:px-1 [&_.proposal-merge-missing]:font-mono [&_.proposal-merge-missing]:text-[var(--enterprise-semantic-warning-text)]`}
                dangerouslySetInnerHTML={{ __html: previewHtml || "<p></p>" }}
              />
            </div>
          ) : (
            <div className={isDiscussion ? "" : "proposal-cover-page"}>
              <div
                className={
                  isDiscussion
                    ? "rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
                    : "proposal-cover-page-inner"
                }
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          )}
        </div>

        {!readOnly &&
          (isDiscussion && onSubmit ? (
            <DiscussionComposerFooter
              editor={editor}
              disabled={disabled}
              isPending={isPending}
              onSubmit={onSubmit}
            />
          ) : (
            <div className="flex items-center justify-between border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-[11px] text-[var(--enterprise-text-muted)]">
              <span>
                {mode === "preview"
                  ? "Preview shows current field values — missing fields stay highlighted."
                  : "Find · selection toolbar · / insert · indent · paste cleanup · focus mode"}
              </span>
              <EditorStats editor={editor} />
            </div>
          ))}
      </div>
    </>
  );
}

function DiscussionComposerFooter({
  editor,
  disabled,
  isPending,
  onSubmit,
}: {
  editor: Editor;
  disabled: boolean;
  isPending: boolean;
  onSubmit: (html: string) => void;
}) {
  const submitEnabled = useEditorState({
    editor,
    selector: (snap) => canSubmitHtml(snap.editor),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5">
      <span className="text-[10px] text-[var(--enterprise-text-muted)]">
        <EditorStats editor={editor} />
      </span>
      <button
        type="button"
        disabled={disabled || isPending || !submitEnabled}
        onClick={() => {
          if (disabled || isPending || !canSubmitHtml(editor)) return;
          onSubmit(editor.getHTML());
        }}
        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50 max-lg:min-h-11"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Send className="h-3.5 w-3.5" aria-hidden />
        )}
        {isPending ? "Posting…" : "Post reply"}
      </button>
    </div>
  );
}
