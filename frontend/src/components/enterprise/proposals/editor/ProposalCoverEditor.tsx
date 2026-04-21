"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type TemplateVariable = {
  key: string; // e.g. "client.name"
  label: string; // e.g. "Client name"
  value: string; // current resolved value for preview
};

type Props = {
  content: string;
  onChange: (html: string, json: Record<string, unknown>) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  variables?: TemplateVariable[];
};

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
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active
          ? "bg-[var(--enterprise-primary)] text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-slate-200" />;
}

export function ProposalCoverEditor({
  content,
  onChange,
  placeholder,
  readOnly,
  className,
  variables = [],
}: Props) {
  const [varMenuOpen, setVarMenuOpen] = useState(false);
  const varMenuRef = useRef<HTMLDivElement>(null);

  // Close var menu on outside click
  useEffect(() => {
    if (!varMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (varMenuRef.current && !varMenuRef.current.contains(e.target as Node)) {
        setVarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [varMenuOpen]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        // Link and Underline are bundled in StarterKit v3 — configure here to avoid duplicates
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Write your cover letter here…" }),
      TextStyle,
      Color,
    ],
    content: content || "<p></p>",
    immediatelyRender: false,
    editable: !readOnly,
    onUpdate({ editor }) {
      onChange(editor.getHTML(), editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose max-w-none min-h-[280px] px-8 py-6 focus:outline-none font-sans leading-relaxed",
      },
    },
  });

  // Sync content when it changes externally (e.g. template load or AI draft)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (content && content !== currentHtml && content !== "<p></p>") {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL:", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const charCount = editor.getText().length;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className ?? ""}`}
    >
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5">
          {/* Undo / Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Inline marks */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="Inline code"
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists / blocks */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Alignment (via paragraph marks; no TextAlign ext) */}
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().updateAttributes("paragraph", { textAlign: "left" }).run()
            }
            title="Align left"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().updateAttributes("paragraph", { textAlign: "center" }).run()
            }
            title="Align center"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().updateAttributes("paragraph", { textAlign: "right" }).run()
            }
            title="Align right"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Link */}
          <ToolbarButton
            onClick={setLink}
            active={editor.isActive("link")}
            title="Insert / edit link"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </ToolbarButton>

          {/* Insert variable */}
          {variables.length > 0 && (
            <>
              <ToolbarDivider />
              <div className="relative" ref={varMenuRef}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setVarMenuOpen((v) => !v);
                  }}
                  title="Insert a smart field (variable)"
                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {"{ }"}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {varMenuOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Smart fields
                    </div>
                    {variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          editor.chain().focus().insertContent(`{{${v.key}}}`).run();
                          setVarMenuOpen(false);
                        }}
                        className="flex w-full flex-col px-3 py-1.5 text-left transition hover:bg-slate-50"
                      >
                        <span className="text-sm font-medium text-slate-800">{v.label}</span>
                        <span className="text-xs text-slate-400">{v.value || "—"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>

      {!readOnly && (
        <div className="flex items-center justify-end border-t border-slate-100 px-3 py-1 text-[11px] text-slate-400">
          {charCount} characters
        </div>
      )}
    </div>
  );
}
