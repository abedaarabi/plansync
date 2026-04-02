import type { PDFDocumentProxy } from "pdfjs-dist";

export type FlatOutlineItem = {
  title: string;
  depth: number;
  pageNumber: number | null;
};

type OutlineNode = {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
};

async function resolveDestToPageNumber(
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> {
  if (!dest) return null;
  try {
    let explicit: unknown[] | null = null;
    if (typeof dest === "string") {
      explicit = await doc.getDestination(dest);
    } else if (Array.isArray(dest)) {
      explicit = dest as unknown[];
    }
    if (!explicit?.length) return null;
    const first = explicit[0];
    if (typeof first === "object" && first !== null && "num" in first) {
      const idx = await doc.getPageIndex(first as never);
      return idx + 1;
    }
    if (typeof first === "number") {
      return first + 1;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getFlatOutline(doc: PDFDocumentProxy): Promise<FlatOutlineItem[]> {
  const tree = (await doc.getOutline()) as OutlineNode[] | null;
  if (!tree?.length) return [];
  const out: FlatOutlineItem[] = [];

  async function walk(nodes: OutlineNode[], depth: number) {
    for (const node of nodes) {
      const pageNumber = await resolveDestToPageNumber(doc, node.dest);
      out.push({ title: node.title || "(untitled)", depth, pageNumber });
      if (node.items?.length) await walk(node.items, depth + 1);
    }
  }

  await walk(tree, 0);
  return out;
}
