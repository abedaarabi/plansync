import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable, Writable } from "node:stream";
import * as FRAGS from "@thatopen/fragments";
import * as WebIFC from "web-ifc";
import { webIfcWasmDir } from "./ifcParseUtils.js";

const TILE_MIN_BYTES = 8 * 1024 * 1024;
const MAX_STOREY_TILES = 16;

export type FragmentsTile = {
  id: string;
  buffer: Buffer;
  bounds: [number, number, number, number, number, number];
  guidCount: number;
};

export type FragmentsConvertResult = {
  monolithic: Buffer;
  tiles: FragmentsTile[];
};

function applyLod500Importer(importer: FRAGS.IfcImporter): void {
  Object.assign(importer.geometryProcessSettings, {
    threshold: 10_000,
    precision: 1e8,
    normalPrecision: 1e9,
    planePrecision: 1e6,
    faceThreshold: 0.45,
    forceTransparentSpaces: true,
    processIfcRelSpaceBoundarySecondLevel: true,
  });
  importer.doubleSidedMaterials = true;
}

function createImporter(): FRAGS.IfcImporter {
  const importer = new FRAGS.IfcImporter();
  const wasmDir = webIfcWasmDir();
  importer.wasm = { path: wasmDir, absolute: true };
  applyLod500Importer(importer);
  return importer;
}

async function convertIfcToFragments(
  ifcBytes: Uint8Array,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const importer = createImporter();
  return importer.process({
    bytes: ifcBytes,
    progressCallback: (progress) => onProgress?.(progress),
  });
}

type StoreyGroup = {
  id: string;
  name: string;
  elevation: number | null;
  expressIds: number[];
};

type SpatialNode = {
  expressID: number;
  type: string;
  children: SpatialNode[];
};

// fallow-ignore-next-line complexity
async function collectStoreyGroups(ifcBytes: Uint8Array): Promise<StoreyGroup[]> {
  const ifcApi = new WebIFC.IfcAPI();
  ifcApi.SetWasmPath(webIfcWasmDir(), true);
  await ifcApi.Init();
  const modelId = ifcApi.OpenModel(ifcBytes);

  const storeyMeta = new Map<number, { name: string; elevation: number | null }>();
  const storeyIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDINGSTOREY, true);
  for (let i = 0; i < storeyIds.size(); i++) {
    const id = storeyIds.get(i);
    try {
      const line = ifcApi.GetLine(modelId, id) as Record<string, unknown>;
      const name =
        (typeof line.Name === "object" && line.Name && "value" in line.Name
          ? String((line.Name as { value: unknown }).value)
          : null) ||
        (typeof line.LongName === "object" && line.LongName && "value" in line.LongName
          ? String((line.LongName as { value: unknown }).value)
          : null) ||
        `Level ${id}`;
      const elevRaw =
        typeof line.Elevation === "object" && line.Elevation && "value" in line.Elevation
          ? Number((line.Elevation as { value: unknown }).value)
          : typeof line.Elevation === "number"
            ? line.Elevation
            : null;
      storeyMeta.set(id, {
        name,
        elevation: elevRaw != null && Number.isFinite(elevRaw) ? elevRaw : null,
      });
    } catch {
      storeyMeta.set(id, { name: `Level ${id}`, elevation: null });
    }
  }

  const byStorey = new Map<string, StoreyGroup>();
  const ensure = (key: string, meta: { name: string; elevation: number | null }) => {
    let g = byStorey.get(key);
    if (!g) {
      g = {
        id: key,
        name: meta.name,
        elevation: meta.elevation,
        expressIds: [],
      };
      byStorey.set(key, g);
    }
    return g;
  };

  try {
    const root = (await ifcApi.properties.getSpatialStructure(modelId, false)) as SpatialNode;
    const walk = (
      node: SpatialNode,
      activeKey: string | null,
      activeMeta: {
        name: string;
        elevation: number | null;
      } | null,
    ) => {
      let key = activeKey;
      let meta = activeMeta;
      if (/BUILDINGSTOREY/i.test(node.type)) {
        meta = storeyMeta.get(node.expressID) ?? {
          name: `Level ${node.expressID}`,
          elevation: null,
        };
        key = `storey_${node.expressID}`;
        ensure(key, meta);
      }
      if (
        key &&
        meta &&
        !/PROJECT|SITE|BUILDING|BUILDINGSTOREY|SPACE|REL/i.test(node.type.replace(/^IFC/i, ""))
      ) {
        ensure(key, meta).expressIds.push(node.expressID);
      }
      for (const child of node.children) walk(child, key, meta);
    };
    walk(root, null, null);
  } catch {
    /* optional */
  }

  ifcApi.CloseModel(modelId);

  return [...byStorey.values()]
    .filter((g) => g.expressIds.length > 0)
    .sort((a, b) => {
      if (a.elevation != null && b.elevation != null && a.elevation !== b.elevation) {
        return a.elevation - b.elevation;
      }
      return a.name.localeCompare(b.name);
    });
}

function nodeIfcSplitterIO(): FRAGS.IfcSplitterIO {
  return {
    async readableStream(path: string): Promise<ReadableStream<string>> {
      const nodeStream = createReadStream(path, { encoding: "utf8" });
      let buffer = "";
      const transformed = new Readable({
        objectMode: true,
        read() {},
      });
      nodeStream.on("data", (chunk: string | Buffer) => {
        buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        let idx: number;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx + 1);
          buffer = buffer.slice(idx + 1);
          transformed.push(line);
        }
      });
      nodeStream.on("end", () => {
        if (buffer) transformed.push(buffer);
        transformed.push(null);
      });
      nodeStream.on("error", (err) => transformed.destroy(err));
      return Readable.toWeb(transformed) as ReadableStream<string>;
    },
    async writableStream(path: string): Promise<WritableStream<string>> {
      const nodeStream = createWriteStream(path, { encoding: "utf8" });
      return Writable.toWeb(nodeStream) as WritableStream<string>;
    },
  };
}

function elevationBounds(
  elevation: number | null,
): [number, number, number, number, number, number] {
  const z = elevation ?? 0;
  return [0, 0, z, 1, 1, z + 3];
}

/**
 * Convert IFC → Fragments; for large multi-storey models also produce storey tiles
 * via IfcSplitter.extract + per-storey IfcImporter.
 */
// fallow-ignore-next-line complexity
export async function convertIfcToFragmentsWithTiles(
  ifcBytes: Uint8Array,
  onProgress?: (fraction: number, phase: "fragments" | "tiles") => void,
): Promise<FragmentsConvertResult> {
  onProgress?.(0.02, "fragments");
  const fragBytes = await convertIfcToFragments(ifcBytes, (f) =>
    onProgress?.(0.02 + f * 0.7, "fragments"),
  );
  const monolithic = Buffer.from(fragBytes);

  const storeys = await collectStoreyGroups(ifcBytes);
  if (storeys.length < 2 || monolithic.byteLength < TILE_MIN_BYTES) {
    onProgress?.(1, "fragments");
    return {
      monolithic,
      tiles: [
        {
          id: "0_0_0",
          buffer: monolithic,
          bounds: [0, 0, 0, 0, 0, 0],
          guidCount: 0,
        },
      ],
    };
  }

  const limited = storeys.slice(0, MAX_STOREY_TILES);
  const dir = await mkdtemp(join(tmpdir(), "plansync-bim-tiles-"));
  const inputPath = join(dir, "source.ifc");
  await writeFile(inputPath, ifcBytes);

  const tiles: FragmentsTile[] = [];
  try {
    const splitter = new FRAGS.IfcSplitter(nodeIfcSplitterIO());
    for (let i = 0; i < limited.length; i++) {
      const storey = limited[i]!;
      const outPath = join(dir, `storey_${i}.ifc`);
      try {
        await splitter.extract(inputPath, storey.expressIds, outPath);
        const subset = await readFile(outPath);
        const tileFrag = await convertIfcToFragments(new Uint8Array(subset));
        tiles.push({
          id: storey.id,
          buffer: Buffer.from(tileFrag),
          bounds: elevationBounds(storey.elevation),
          guidCount: storey.expressIds.length,
        });
      } catch (err) {
        console.warn("[bim.fragments] storey tile skipped", storey.name, err);
      }
      onProgress?.(0.72 + ((i + 1) / limited.length) * 0.28, "tiles");
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  if (tiles.length < 2) {
    return {
      monolithic,
      tiles: [
        {
          id: "0_0_0",
          buffer: monolithic,
          bounds: [0, 0, 0, 0, 0, 0],
          guidCount: 0,
        },
      ],
    };
  }

  onProgress?.(1, "tiles");
  return { monolithic, tiles };
}
