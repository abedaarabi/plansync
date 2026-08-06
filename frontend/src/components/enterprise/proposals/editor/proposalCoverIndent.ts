import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    coverIndent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

const MAX_INDENT = 8;
const STEP_EM = 1.5;

/** Word-like indent for paragraphs/headings + Tab sink/lift for list items. */
export const CoverIndent = Extension.create({
  name: "coverIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-indent");
              if (raw != null) {
                const n = Number(raw);
                return Number.isFinite(n) ? Math.min(MAX_INDENT, Math.max(0, n)) : 0;
              }
              const ml = element.style.marginLeft;
              if (!ml) return 0;
              const em = parseFloat(ml);
              if (!Number.isFinite(em)) return 0;
              return Math.min(MAX_INDENT, Math.max(0, Math.round(em / STEP_EM)));
            },
            renderHTML: (attributes) => {
              const level = Number(attributes.indent) || 0;
              if (level <= 0) return {};
              return {
                "data-indent": String(level),
                style: `margin-left: ${level * STEP_EM}em`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ editor, chain }) => {
          if (editor.isActive("taskItem")) {
            return chain().sinkListItem("taskItem").run();
          }
          if (editor.isActive("listItem")) {
            return chain().sinkListItem("listItem").run();
          }
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          const indent = (editor.getAttributes(type).indent as number | undefined) ?? 0;
          return chain()
            .updateAttributes(type, { indent: Math.min(MAX_INDENT, indent + 1) })
            .run();
        },
      outdent:
        () =>
        ({ editor, chain }) => {
          if (editor.isActive("taskItem")) {
            return chain().liftListItem("taskItem").run();
          }
          if (editor.isActive("listItem")) {
            return chain().liftListItem("listItem").run();
          }
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          const indent = (editor.getAttributes(type).indent as number | undefined) ?? 0;
          return chain()
            .updateAttributes(type, { indent: Math.max(0, indent - 1) })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});
