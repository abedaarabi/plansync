"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  ChevronDown,
  Eraser,
  Highlighter,
  ImageIcon,
  Indent,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Quote,
  Redo,
  Search,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CoverVariable } from "@/components/enterprise/proposals/editor/proposalCoverTypes";

const FONTS = [
  { label: "Default", value: "" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
] as const;

const FONT_SIZES = [
  "10px",
  "11px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
];

const LINE_HEIGHTS = [
  { label: "1.0", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "1.75", value: "1.75" },
  { label: "2.0", value: "2" },
];

const TEXT_COLORS = [
  { hex: "", label: "Default" },
  { hex: "#0f172a", label: "Ink" },
  { hex: "#475569", label: "Slate" },
  { hex: "#2563eb", label: "Blue" },
  { hex: "#065f46", label: "Green" },
  { hex: "#92400e", label: "Amber" },
  { hex: "#991b1b", label: "Red" },
];

const HIGHLIGHT_COLORS = [
  { hex: "#fef08a", label: "Yellow" },
  { hex: "#bbf7d0", label: "Green" },
  { hex: "#bfdbfe", label: "Blue" },
  { hex: "#fecaca", label: "Red" },
  { hex: "#e9d5ff", label: "Purple" },
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
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-[var(--enterprise-primary)]/15 text-[var(--enterprise-primary)]"
          : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-[var(--enterprise-border)]" />;
}

function SelectControl({
  value,
  onChange,
  title,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      title={title}
      aria-label={title}
      value={value}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 text-xs text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none ${className ?? ""}`}
    >
      {children}
    </select>
  );
}

type Props = {
  editor: Editor;
  variables: CoverVariable[];
  onOpenFind?: () => void;
  onInsertImageUrl?: () => void;
};

export function ProposalCoverToolbar({ editor, variables, onOpenFind, onInsertImageUrl }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: (snap) => ({
      bold: snap.editor.isActive("bold"),
      italic: snap.editor.isActive("italic"),
      underline: snap.editor.isActive("underline"),
      strike: snap.editor.isActive("strike"),
      sub: snap.editor.isActive("subscript"),
      sup: snap.editor.isActive("superscript"),
      h1: snap.editor.isActive("heading", { level: 1 }),
      h2: snap.editor.isActive("heading", { level: 2 }),
      h3: snap.editor.isActive("heading", { level: 3 }),
      bullet: snap.editor.isActive("bulletList"),
      ordered: snap.editor.isActive("orderedList"),
      task: snap.editor.isActive("taskList"),
      quote: snap.editor.isActive("blockquote"),
      alignLeft: snap.editor.isActive({ textAlign: "left" }),
      alignCenter: snap.editor.isActive({ textAlign: "center" }),
      alignRight: snap.editor.isActive({ textAlign: "right" }),
      alignJustify: snap.editor.isActive({ textAlign: "justify" }),
      link: snap.editor.isActive("link"),
      table: snap.editor.isActive("table"),
      canUndo: snap.editor.can().undo(),
      canRedo: snap.editor.can().redo(),
      fontFamily: (snap.editor.getAttributes("textStyle").fontFamily as string) || "",
      fontSize: (snap.editor.getAttributes("textStyle").fontSize as string) || "",
      lineHeight: (snap.editor.getAttributes("textStyle").lineHeight as string) || "",
      color: (snap.editor.getAttributes("textStyle").color as string) || "",
      headingLevel: snap.editor.isActive("heading", { level: 1 })
        ? "1"
        : snap.editor.isActive("heading", { level: 2 })
          ? "2"
          : snap.editor.isActive("heading", { level: 3 })
            ? "3"
            : snap.editor.isActive("heading", { level: 4 })
              ? "4"
              : "p",
    }),
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (linkRef.current && !linkRef.current.contains(t)) setLinkOpen(false);
      if (fieldsRef.current && !fieldsRef.current.contains(t)) setFieldsOpen(false);
      if (highlightRef.current && !highlightRef.current.contains(t)) setHighlightOpen(false);
      if (imageMenuRef.current && !imageMenuRef.current.contains(t)) setImageMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  const insertImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  };

  const insertMerge = (key: string, label: string) => {
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "mention", attrs: { id: key, label } },
        { type: "text", text: " " },
      ])
      .run();
    setFieldsOpen(false);
  };

  return (
    <div className="proposal-cover-toolbar sticky top-0 z-20 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/95 backdrop-blur-sm">
      <div
        className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
        role="toolbar"
        aria-label="Document formatting"
      >
        <ToolbarButton
          title="Undo"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <SelectControl
          title="Font"
          value={state.fontFamily}
          className="max-w-[8.5rem]"
          onChange={(v) => {
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </SelectControl>

        <SelectControl
          title="Font size"
          value={state.fontSize}
          className="w-[4.5rem]"
          onChange={(v) => {
            if (!v) editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace("px", "")}
            </option>
          ))}
        </SelectControl>

        <SelectControl
          title="Paragraph style"
          value={state.headingLevel}
          className="w-[6.5rem]"
          onChange={(v) => {
            if (v === "p") editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .toggleHeading({ level: Number(v) as 1 | 2 | 3 | 4 })
                .run();
          }}
        >
          <option value="p">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          <option value="4">Heading 4</option>
        </SelectControl>

        <Divider />

        <ToolbarButton
          title="Bold"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={state.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Subscript"
          active={state.sub}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          <Subscript className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Superscript"
          active={state.sup}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          <Superscript className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <div className="flex items-center gap-0.5 px-0.5" title="Text color">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              title={c.label}
              aria-label={c.label}
              onMouseDown={(e) => {
                e.preventDefault();
                if (!c.hex) editor.chain().focus().unsetColor().run();
                else editor.chain().focus().setColor(c.hex).run();
              }}
              className={`h-5 w-5 rounded-full border ${
                (c.hex && state.color?.toLowerCase() === c.hex) || (!c.hex && !state.color)
                  ? "border-[var(--enterprise-primary)] ring-2 ring-[var(--enterprise-primary)]/25"
                  : "border-[var(--enterprise-border)]"
              }`}
              style={{ backgroundColor: c.hex || "#ffffff" }}
            />
          ))}
        </div>

        <div className="relative" ref={highlightRef}>
          <ToolbarButton
            title="Highlight"
            active={editor.isActive("highlight")}
            onClick={() => setHighlightOpen((v) => !v)}
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          {highlightOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 flex gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2 shadow-[var(--enterprise-shadow-md)]">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().toggleHighlight({ color: c.hex }).run();
                    setHighlightOpen(false);
                  }}
                  className="h-6 w-6 rounded border border-[var(--enterprise-border)]"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <button
                type="button"
                title="Remove highlight"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetHighlight().run();
                  setHighlightOpen(false);
                }}
                className="px-1 text-[10px] font-semibold text-[var(--enterprise-text-muted)]"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <Divider />

        <ToolbarButton
          title="Align left"
          active={state.alignLeft}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          active={state.alignCenter}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          active={state.alignRight}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Justify"
          active={state.alignJustify}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <SelectControl
          title="Line spacing"
          value={state.lineHeight}
          className="w-[4.25rem]"
          onChange={(v) => {
            if (!v) editor.chain().focus().unsetLineHeight().run();
            else editor.chain().focus().setLineHeight(v).run();
          }}
        >
          <option value="">Line</option>
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh.value} value={lh.value}>
              {lh.label}
            </option>
          ))}
        </SelectControl>

        <ToolbarButton
          title="Decrease indent"
          onClick={() => editor.chain().focus().outdent().run()}
        >
          <Outdent className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Increase indent"
          onClick={() => editor.chain().focus().indent().run()}
        >
          <Indent className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Bullet list"
          active={state.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={state.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Checklist"
          active={state.task}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <CheckSquare className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={state.quote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <div className="relative" ref={linkRef}>
          <ToolbarButton
            title="Link"
            active={state.link}
            onClick={() => {
              const prev = (editor.getAttributes("link").href as string) || "https://";
              setLinkUrl(prev === "https://" ? "https://" : prev);
              setLinkOpen((v) => !v);
            }}
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          {linkOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 flex w-[16rem] items-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2 shadow-[var(--enterprise-shadow-md)]">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://"
                className="min-w-0 flex-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 text-xs focus:border-[var(--enterprise-primary)] focus:outline-none"
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyLink();
                }}
                className="rounded-md bg-[var(--enterprise-primary)] px-2 py-1 text-xs font-semibold text-white"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={imageMenuRef}>
          <ToolbarButton title="Insert image" onClick={() => setImageMenuOpen((v) => !v)}>
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          {imageMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-[var(--enterprise-shadow-md)]">
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-[var(--enterprise-hover-surface)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setImageMenuOpen(false);
                  imageInputRef.current?.click();
                }}
              >
                Upload file…
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-[var(--enterprise-hover-surface)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setImageMenuOpen(false);
                  onInsertImageUrl?.();
                }}
              >
                From URL…
              </button>
            </div>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) insertImageFromFile(file);
            e.target.value = "";
          }}
        />

        <ToolbarButton
          title="Insert table"
          active={state.table}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Find and replace (Ctrl/⌘F)" onClick={() => onOpenFind?.()}>
          <Search className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <Eraser className="h-4 w-4" />
        </ToolbarButton>

        {variables.length > 0 && (
          <>
            <Divider />
            <div className="relative" ref={fieldsRef}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFieldsOpen((v) => !v);
                }}
                title="Insert merge field (or type #)"
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary)]/10"
              >
                # Fields
                <ChevronDown className="h-3 w-3" />
              </button>
              {fieldsOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[220px] overflow-y-auto rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-[var(--enterprise-shadow-md)]">
                  {variables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMerge(v.key, v.label);
                      }}
                      className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-[var(--enterprise-hover-surface)]"
                    >
                      <span className="text-sm font-medium text-[var(--enterprise-text)]">
                        {v.label}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--enterprise-text-muted)]">
                        {`{{${v.key}}}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {state.table && (
        <div className="flex flex-wrap items-center gap-1 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/50 px-2 py-1 text-xs">
          <span className="mr-1 font-medium text-[var(--enterprise-text-muted)]">Table</span>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-[var(--enterprise-surface)]"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().addColumnAfter().run();
            }}
          >
            + Col
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-[var(--enterprise-surface)]"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().addRowAfter().run();
            }}
          >
            + Row
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-[var(--enterprise-surface)]"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().deleteColumn().run();
            }}
          >
            Del col
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-[var(--enterprise-surface)]"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().deleteRow().run();
            }}
          >
            Del row
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-[var(--enterprise-surface)]"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().mergeCells().run();
            }}
          >
            Merge
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[var(--enterprise-semantic-danger-text)] hover:bg-[var(--enterprise-surface)]"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().deleteTable().run();
            }}
          >
            Delete table
          </button>
        </div>
      )}
    </div>
  );
}
