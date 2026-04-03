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

const PRESET_COLORS = [
  "#0f172a",
  "#b91c1c",
  "#c2410c",
  "#a16207",
  "#15803d",
  "#1d4ed8",
  "#6d28d9",
  "#be185d",
];

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
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30 disabled:opacity-40 ${
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
      <span
        className="inline-flex max-w-full min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden py-0.5 pl-1 sm:flex-initial"
        title="Text color"
      >
        <Baseline
          className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
          strokeWidth={1.75}
        />
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            title={`Color ${c}`}
            onClick={() => editor.chain().focus().extendMarkRange("textStyle").setColor(c).run()}
            className="h-6 w-6 shrink-0 rounded-md border border-[var(--enterprise-border)]/80 shadow-sm transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40 disabled:opacity-40"
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          disabled={disabled}
          title="Reset color"
          onClick={() => editor.chain().focus().extendMarkRange("textStyle").unsetColor().run()}
          className="ml-0.5 shrink-0 rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-[10px] font-medium text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-40"
        >
          Reset
        </button>
      </span>
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
