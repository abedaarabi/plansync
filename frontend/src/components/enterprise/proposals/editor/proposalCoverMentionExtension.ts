import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  ProposalMergeFieldList,
  type ProposalMergeFieldItem,
} from "@/components/enterprise/proposals/editor/ProposalMergeFieldList";
import type { CoverVariable } from "@/components/enterprise/proposals/editor/proposalCoverTypes";
import { RfiMentionList, type RfiMentionItem } from "@/components/enterprise/RfiMentionList";

function tippySuggestionRender<TItem>(List: typeof ProposalMergeFieldList | typeof RfiMentionList) {
  return () => {
    let component: ReactRenderer | null = null;
    let popup: TippyInstance | null = null;

    return {
      onStart: (props: SuggestionProps<TItem>) => {
        component = new ReactRenderer(List, {
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
        });
      },
      onUpdate(props: SuggestionProps<TItem>) {
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
  };
}

/** Merge-field mentions for proposal cover letters (`#`). */
export function createMergeFieldMention(getVariables: () => CoverVariable[]) {
  return Mention.configure({
    HTMLAttributes: {
      class: "proposal-merge-chip",
    },
    renderText({ node }) {
      return `{{${node.attrs.id}}}`;
    },
    renderHTML({ options, node }) {
      return [
        "span",
        {
          ...options.HTMLAttributes,
          "data-type": "mention",
          "data-id": node.attrs.id,
          "data-label": node.attrs.label ?? node.attrs.id,
        },
        `{{${node.attrs.id}}}`,
      ];
    },
    suggestion: {
      char: "#",
      allowSpaces: false,
      items: ({ query }) => {
        const q = query.trim().toLowerCase();
        const all: ProposalMergeFieldItem[] = getVariables().map((v) => ({
          id: v.key,
          label: v.label,
          value: v.value,
        }));
        if (!q) return all.slice(0, 14);
        return all
          .filter((v) => v.id.toLowerCase().includes(q) || v.label.toLowerCase().includes(q))
          .slice(0, 14);
      },
      command: ({ editor, range, props }) => {
        const item = props as ProposalMergeFieldItem;
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: "mention", attrs: { id: item.id, label: item.label } },
            { type: "text", text: " " },
          ])
          .run();
      },
      render: tippySuggestionRender<ProposalMergeFieldItem>(ProposalMergeFieldList),
    },
  });
}

/** User @-mentions for RFI / discussion threads. */
export function createUserMention(getUsers: () => RfiMentionItem[]) {
  return Mention.configure({
    HTMLAttributes: {
      class:
        "rounded bg-[var(--enterprise-primary)]/12 px-1 font-medium text-[var(--enterprise-primary)]",
    },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    renderHTML({ options, node }) {
      const label = String(node.attrs.label ?? node.attrs.id);
      return [
        "span",
        {
          ...options.HTMLAttributes,
          "data-type": "mention",
          "data-id": node.attrs.id,
          "data-label": label,
          "data-mention-suggestion-char": "@",
        },
        `@${label}`,
      ];
    },
    suggestion: {
      char: "@",
      allowSpaces: true,
      items: ({ query }) => {
        const q = query.trim().toLowerCase();
        const all = getUsers();
        const matches = (u: RfiMentionItem) => {
          if (!q) return true;
          if (u.label.toLowerCase().includes(q)) return true;
          const em = u.email?.trim().toLowerCase();
          return Boolean(em && em.includes(q));
        };
        return all.filter(matches).slice(0, 12);
      },
      command: ({ editor, range, props }) => {
        const item = props as RfiMentionItem;
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: "mention", attrs: { id: item.id, label: item.label } },
            { type: "text", text: " " },
          ])
          .run();
      },
      render: tippySuggestionRender<RfiMentionItem>(RfiMentionList),
    },
  });
}
