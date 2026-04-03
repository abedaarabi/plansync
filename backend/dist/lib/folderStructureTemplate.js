import { z } from "zod";
const treeNodeSchema = z.lazy(() => z.object({
    name: z.string(),
    children: z.array(treeNodeSchema).optional(),
}));
const forestSchema = z.array(treeNodeSchema);
/** Validate JSON from `FolderStructureTemplate.tree`. */
export function parseFolderTreeFromJson(value) {
    return forestSchema.parse(value);
}
