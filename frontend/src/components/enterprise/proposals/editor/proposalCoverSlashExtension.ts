import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  ProposalCoverSlashList,
  type CoverSlashItem,
} from "@/components/enterprise/proposals/editor/ProposalCoverSlashList";
import type { CoverVariable } from "@/components/enterprise/proposals/editor/proposalCoverTypes";

type SlashOpts = {
  getVariables: () => CoverVariable[];
  onRequestImageUrl: () => void;
};

function buildSlashItems(
  editor: SuggestionProps["editor"],
  query: string,
  opts: SlashOpts,
): CoverSlashItem[] {
  const all: CoverSlashItem[] = [
    {
      id: "h1",
      label: "Heading 1",
      description: "Large section title",
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "h2",
      label: "Heading 2",
      description: "Subsection title",
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "bullet",
      label: "Bullet list",
      description: "Unordered list",
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "ordered",
      label: "Numbered list",
      description: "Ordered list",
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: "task",
      label: "Checklist",
      description: "Task list with checkboxes",
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: "quote",
      label: "Quote",
      description: "Block quotation",
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "table",
      label: "Table",
      description: "3×3 table with header",
      run: () =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: "image",
      label: "Image",
      description: "Insert from URL",
      run: () => opts.onRequestImageUrl(),
    },
    {
      id: "hr",
      label: "Divider",
      description: "Horizontal rule",
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
  ];

  for (const v of opts.getVariables().slice(0, 8)) {
    all.push({
      id: `field-${v.key}`,
      label: v.label,
      description: `Merge field {{${v.key}}}`,
      run: () =>
        editor
          .chain()
          .focus()
          .insertContent([
            { type: "mention", attrs: { id: v.key, label: v.label } },
            { type: "text", text: " " },
          ])
          .run(),
    });
  }

  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (i) =>
      i.label.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.id.includes(q),
  );
}

export function createCoverSlashExtension(opts: SlashOpts) {
  return Extension.create({
    name: "coverSlashCommands",

    addOptions() {
      return {
        suggestion: {
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          items: ({ query, editor }: { query: string; editor: SuggestionProps["editor"] }) =>
            buildSlashItems(editor, query, opts),
          command: ({
            editor,
            range,
            props,
          }: {
            editor: SuggestionProps["editor"];
            range: { from: number; to: number };
            props: CoverSlashItem;
          }) => {
            editor.chain().focus().deleteRange(range).run();
            props.run();
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: TippyInstance | null = null;

            return {
              onStart: (props: SuggestionProps<CoverSlashItem>) => {
                component = new ReactRenderer(ProposalCoverSlashList, {
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
                  zIndex: 250,
                  theme: "plansync-mention",
                });
              },
              onUpdate(props: SuggestionProps<CoverSlashItem>) {
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
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
