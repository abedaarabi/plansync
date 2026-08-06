import CharacterCount from "@tiptap/extension-character-count";
import FindAndReplace from "@tiptap/extension-find-and-replace";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";
import type { RfiMentionItem } from "@/components/enterprise/RfiMentionList";
import { CoverIndent } from "@/components/enterprise/proposals/editor/proposalCoverIndent";
import {
  createMergeFieldMention,
  createUserMention,
} from "@/components/enterprise/proposals/editor/proposalCoverMentionExtension";
import { createCoverSlashExtension } from "@/components/enterprise/proposals/editor/proposalCoverSlashExtension";
import type { CoverVariable } from "@/components/enterprise/proposals/editor/proposalCoverTypes";

type CoverEditorMentionMode = "mergeFields" | "users";

type CreateOpts = {
  placeholder: string;
  getVariables: () => CoverVariable[];
  getMentionUsers?: () => RfiMentionItem[];
  mentionMode?: CoverEditorMentionMode;
  onRequestImageUrl: () => void;
  /** Compact discussion composer (skip heavy find/replace if desired later). */
  includeFindReplace?: boolean;
};

/** Open-source TipTap kit aligned with the Simple Editor + Word-like formatting docs. */
export function createProposalCoverExtensions(opts: CreateOpts) {
  const {
    placeholder,
    getVariables,
    getMentionUsers,
    mentionMode = "mergeFields",
    onRequestImageUrl,
    includeFindReplace = true,
  } = opts;

  const mention =
    mentionMode === "users"
      ? createUserMention(() => getMentionUsers?.() ?? [])
      : createMergeFieldMention(getVariables);

  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "proposal-cover-link",
        },
      },
    }),
    TextStyleKit,
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right", "justify"],
    }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    Typography,
    CoverIndent,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({
      table: {
        resizable: false,
        HTMLAttributes: { class: "proposal-cover-table" },
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
      resize: {
        enabled: true,
        directions: ["bottom", "right", "bottom-right"],
        minWidth: 48,
        minHeight: 48,
        alwaysPreserveAspectRatio: true,
      },
      HTMLAttributes: { class: "proposal-cover-image" },
    }),
    Placeholder.configure({
      placeholder,
    }),
    CharacterCount,
    ...(includeFindReplace ? [FindAndReplace.configure({ searchDebounceMs: 150 })] : []),
    createCoverSlashExtension({
      getVariables: mentionMode === "mergeFields" ? getVariables : () => [],
      onRequestImageUrl,
    }),
    mention,
  ];
}
