"use client";

import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  editor: Editor;
};

function Btn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
        active
          ? "bg-[var(--enterprise-primary)] text-white"
          : "text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
      }`}
    >
      {children}
    </button>
  );
}

export function ProposalCoverBubbleMenu({ editor }: Props) {
  const state = useEditorState({
    editor,
    selector: (snap) => ({
      bold: snap.editor.isActive("bold"),
      italic: snap.editor.isActive("italic"),
      underline: snap.editor.isActive("underline"),
      strike: snap.editor.isActive("strike"),
      link: snap.editor.isActive("link"),
    }),
  });

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: ed, state: st }) => {
        const { empty } = st.selection;
        if (empty || !ed.isEditable) return false;
        if (ed.isActive("image") || ed.isActive("table")) return false;
        return true;
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-1 shadow-[var(--enterprise-shadow-md)]">
        <Btn
          title="Bold"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          title="Italic"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          title="Underline"
          active={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          title="Strike"
          active={state.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </Btn>
        <Btn
          title="Link"
          active={state.link}
          onClick={() => {
            const prev = (editor.getAttributes("link").href as string) || "";
            const url = window.prompt("Link URL", prev || "https://");
            if (url === null) return;
            if (!url.trim()) {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Btn>
      </div>
    </BubbleMenu>
  );
}
