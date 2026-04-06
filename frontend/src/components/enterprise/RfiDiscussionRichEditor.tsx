"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, ReactRenderer, useEditor, useEditorState } from "@tiptap/react";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import {
  Baseline,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { RfiMentionList, type RfiMentionItem } from "@/components/enterprise/RfiMentionList";

/** Matches `--enterprise-text` — used when no inline color is set. */
const DEFAULT_TEXT_COLOR = "#0f172a";

/**
 * Curated for the enterprise shell: one slate ramp, one brand accent, semantic text hues.
 * (Avoids competing blues and neon primaries that clash with the rest of the app.)
 */
const PRESET_TEXT_COLORS: { hex: string; label: string }[] = [
  { hex: DEFAULT_TEXT_COLOR, label: "Default" },
  { hex: "#475569", label: "Secondary" },
  { hex: "#64748b", label: "Muted" },
  { hex: "#2563eb", label: "Accent" },
  { hex: "#065f46", label: "Success" },
  { hex: "#92400e", label: "Warning" },
  { hex: "#991b1b", label: "Danger" },
];

/** Normalize editor / preset colors to `#rrggbb` for comparison. */
function colorToHex(raw: string | undefined | null): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim().toLowerCase();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 6 && /^[0-9a-f]+$/.test(h)) return `#${h}`;
    return s;
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = Math.min(255, Number(m[1])).toString(16).padStart(2, "0");
    const g = Math.min(255, Number(m[2])).toString(16).padStart(2, "0");
    const b = Math.min(255, Number(m[3])).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return s;
}

function isPresetActive(hex: string, editorColor: string | undefined): boolean {
  const preset = colorToHex(hex);
  const current = colorToHex(editorColor ?? undefined);
  if (hex === DEFAULT_TEXT_COLOR) {
    return current == null || current === preset;
  }
  return current != null && preset != null && current === preset;
}

function TextColorSwatch({
  editor,
  disabled,
  hex,
  label,
}: {
  editor: Editor;
  disabled: boolean;
  hex: string;
  label: string;
}) {
  const { active } = useEditorState({
    editor,
    selector: (snap) => ({
      active: isPresetActive(
        hex,
        snap.editor.getAttributes("textStyle").color as string | undefined,
      ),
    }),
  });

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label} (${hex})`}
      aria-pressed={active}
      data-hint={`${label} · ${hex}`}
      onClick={() => editor.chain().focus().extendMarkRange("textStyle").setColor(hex).run()}
      className={`enterprise-hint-tip flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-[var(--enterprise-surface)] p-0.5 shadow-[var(--enterprise-shadow-xs)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35 disabled:opacity-40 ${
        active
          ? "border-[var(--enterprise-primary)] ring-2 ring-[var(--enterprise-primary)]/25"
          : "border-[var(--enterprise-border)] hover:border-[var(--enterprise-primary)]/35"
      }`}
    >
      <span
        className="h-5 w-5 rounded-full"
        style={{
          backgroundColor: hex,
          boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.08)",
        }}
      />
    </button>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      disabled={disabled}
      data-hint={title}
      onClick={onClick}
      className={`enterprise-hint-tip rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30 disabled:opacity-40 ${
        active
          ? "bg-[var(--enterprise-primary)]/15 text-[var(--enterprise-primary)]"
          : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const setLink = useCallback(() => {
    if (disabled) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    const t = url.trim();
    if (t === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: t }).run();
  }, [editor, disabled]);

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-2 py-1.5 sm:flex-nowrap"
      role="toolbar"
      aria-label="Formatting"
    >
      <ToolbarButton
        title="Bold"
        disabled={disabled}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        disabled={disabled}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        disabled={disabled}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        disabled={disabled}
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      <span className="mx-1 hidden h-5 w-px bg-[var(--enterprise-border)] sm:block" aria-hidden />
      <ToolbarButton
        title="Bullet list"
        disabled={disabled}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        disabled={disabled}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      <ToolbarButton
        title="Link"
        disabled={disabled}
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <Link2 className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      <span className="mx-1 hidden h-5 w-px bg-[var(--enterprise-border)] sm:block" aria-hidden />
      <div className="inline-flex max-w-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden rounded-[10px] bg-[var(--enterprise-hover-surface)]/70 px-1.5 py-1 ring-1 ring-[var(--enterprise-border)]/90 sm:flex-initial">
        <span
          className="enterprise-hint-tip inline-flex shrink-0 rounded-md p-1 text-[var(--enterprise-text-muted)]"
          data-hint="Text color"
        >
          <Baseline className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex items-center gap-1">
          {PRESET_TEXT_COLORS.map(({ hex, label }) => (
            <TextColorSwatch
              key={hex}
              editor={editor}
              disabled={disabled}
              hex={hex}
              label={label}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-label="Reset text color"
          data-hint="Use default body color"
          onClick={() => editor.chain().focus().extendMarkRange("textStyle").unsetColor().run()}
          className="enterprise-hint-tip ml-0.5 shrink-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/25 hover:bg-[var(--enterprise-bg)] hover:text-[var(--enterprise-text)] disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function EditorFooter({
  editor,
  disabled,
  isPending,
  onSubmit,
}: {
  editor: Editor;
  disabled: boolean;
  isPending: boolean;
  onSubmit: () => void;
}) {
  const { canSubmit, htmlLen } = useEditorState({
    editor,
    selector: (snap) => ({
      canSubmit: snap.editor.getText().trim().length > 0,
      htmlLen: snap.editor.getHTML().length,
    }),
  });

  const maxHint = 120_000;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--enterprise-border)] px-3 py-2">
      <span className="text-[11px] text-[var(--enterprise-text-muted)]">
        {htmlLen.toLocaleString()} / {maxHint.toLocaleString()} characters (HTML) · type @ to
        mention
      </span>
      <button
        type="button"
        disabled={disabled || isPending || !canSubmit}
        onClick={onSubmit}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {isPending ? "Posting…" : "Post reply"}
      </button>
    </div>
  );
}

export type RfiDiscussionRichEditorProps = {
  disabled?: boolean;
  isPending: boolean;
  onSubmit: (html: string) => void;
  /** Project members available for @ mentions (user id + display label). */
  mentionUsers: RfiMentionItem[];
};

export function RfiDiscussionRichEditor({
  disabled,
  isPending,
  onSubmit,
  mentionUsers,
}: RfiDiscussionRichEditorProps) {
  const [mounted, setMounted] = useState(false);
  const mentionUsersRef = useRef(mentionUsers);
  mentionUsersRef.current = mentionUsers;

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: "Add a reply… @mention someone if needed.",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "underline decoration-[var(--enterprise-primary)]/80",
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class:
            "rounded bg-[var(--enterprise-primary)]/12 px-1 font-medium text-[var(--enterprise-primary)]",
        },
        suggestion: {
          char: "@",
          allowSpaces: true,
          items: ({ query }) => {
            const q = query.trim().toLowerCase();
            const all = mentionUsersRef.current;
            const matches = (u: RfiMentionItem) => {
              if (!q) return true;
              if (u.label.toLowerCase().includes(q)) return true;
              const em = u.email?.trim().toLowerCase();
              return Boolean(em && em.includes(q));
            };
            return all.filter(matches).slice(0, 12);
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: TippyInstance | null = null;

            return {
              onStart: (props: SuggestionProps<RfiMentionItem>) => {
                component = new ReactRenderer(RfiMentionList, {
                  editor: props.editor,
                  props,
                });
                popup = tippy(document.body, {
                  getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0),
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  arrow: false,
                  maxWidth: "none",
                  offset: [0, 6],
                  zIndex: 240,
                  theme: "plansync-mention",
                  moveTransition: "transform 0.12s ease-out",
                });
              },
              onUpdate(props: SuggestionProps<RfiMentionItem>) {
                component?.updateProps(props);
                popup?.setProps({
                  getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0),
                });
              },
              onExit() {
                popup?.destroy();
                component?.destroy();
                popup = null;
                component = null;
              },
              onKeyDown(props: SuggestionKeyDownProps) {
                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }
                const listRef = component?.ref as {
                  onKeyDown?: (p: SuggestionKeyDownProps) => boolean;
                } | null;
                return listRef?.onKeyDown?.(props) ?? false;
              },
            };
          },
        },
      }),
    ],
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: "",
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none px-3 py-2.5 text-[var(--enterprise-text)] focus:outline-none dark:prose-invert prose-strong:text-[var(--enterprise-text)] [&_span[style*='color']_strong]:text-inherit [&_span[style*='color']_em]:text-inherit [&_span[style*='color']_s]:text-inherit [&_span[style*='color']_u]:text-inherit",
        },
      },
    },
    [extensions],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!editor || disabled || isPending) return;
    if (!editor.getText().trim()) return;
    onSubmit(editor.getHTML());
  }, [editor, disabled, isPending, onSubmit]);

  if (!mounted || !editor) {
    return (
      <div className="min-h-[12rem] animate-pulse rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]" />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
      <EditorToolbar editor={editor} disabled={Boolean(disabled || isPending)} />
      <div className="[&_.ProseMirror]:min-h-[7.5rem] [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5">
        <EditorContent editor={editor} />
      </div>
      <EditorFooter
        editor={editor}
        disabled={Boolean(disabled)}
        isPending={isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
