import { z } from "zod";

export type FolderTemplateNode = {
  name: string;
  children?: FolderTemplateNode[];
};

const treeNodeSchema: z.ZodType<FolderTemplateNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    children: z.array(treeNodeSchema).optional(),
  }),
);

const forestSchema = z.array(treeNodeSchema);

/** Validate JSON from `FolderStructureTemplate.tree`. */
export function parseFolderTreeFromJson(value: unknown): FolderTemplateNode[] {
  return forestSchema.parse(value);
}
