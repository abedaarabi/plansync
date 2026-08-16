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
function applyLod500Importer(importer) {
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
function createImporter() {
    const importer = new FRAGS.IfcImporter();
    const wasmDir = webIfcWasmDir();
    importer.wasm = { path: wasmDir, absolute: true };
    applyLod500Importer(importer);
    return importer;
}
async function convertIfcToFragments(ifcBytes, onProgress) {
    const importer = createImporter();
    return importer.process({
        bytes: ifcBytes,
        progressCallback: (progress) => onProgress?.(progress),
    });
}
// fallow-ignore-next-line complexity
async function collectStoreyGroups(ifcBytes) {
    const ifcApi = new WebIFC.IfcAPI();
    ifcApi.SetWasmPath(webIfcWasmDir(), true);
    await ifcApi.Init();
    const modelId = ifcApi.OpenModel(ifcBytes);
    const storeyMeta = new Map();
    const storeyIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDINGSTOREY, true);
    for (let i = 0; i < storeyIds.size(); i++) {
        const id = storeyIds.get(i);
        try {
            const line = ifcApi.GetLine(modelId, id);
            const name = (typeof line.Name === "object" && line.Name && "value" in line.Name
                ? String(line.Name.value)
                : null) ||
                (typeof line.LongName === "object" && line.LongName && "value" in line.LongName
                    ? String(line.LongName.value)
                    : null) ||
                `Level ${id}`;
            const elevRaw = typeof line.Elevation === "object" && line.Elevation && "value" in line.Elevation
                ? Number(line.Elevation.value)
                : typeof line.Elevation === "number"
                    ? line.Elevation
                    : null;
            storeyMeta.set(id, {
                name,
                elevation: elevRaw != null && Number.isFinite(elevRaw) ? elevRaw : null,
            });
        }
        catch {
            storeyMeta.set(id, { name: `Level ${id}`, elevation: null });
        }
    }
    const byStorey = new Map();
    const ensure = (key, meta) => {
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
        const root = (await ifcApi.properties.getSpatialStructure(modelId, false));
        const walk = (node, activeKey, activeMeta) => {
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
            if (key &&
                meta &&
                !/PROJECT|SITE|BUILDING|BUILDINGSTOREY|SPACE|REL/i.test(node.type.replace(/^IFC/i, ""))) {
                ensure(key, meta).expressIds.push(node.expressID);
            }
            for (const child of node.children)
                walk(child, key, meta);
        };
        walk(root, null, null);
    }
    catch {
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
function nodeIfcSplitterIO() {
    return {
        async readableStream(path) {
            const nodeStream = createReadStream(path, { encoding: "utf8" });
            let buffer = "";
            const transformed = new Readable({
                objectMode: true,
                read() { },
            });
            nodeStream.on("data", (chunk) => {
                buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
                let idx;
                while ((idx = buffer.indexOf("\n")) >= 0) {
                    const line = buffer.slice(0, idx + 1);
                    buffer = buffer.slice(idx + 1);
                    transformed.push(line);
                }
            });
            nodeStream.on("end", () => {
                if (buffer)
                    transformed.push(buffer);
                transformed.push(null);
            });
            nodeStream.on("error", (err) => transformed.destroy(err));
            return Readable.toWeb(transformed);
        },
        async writableStream(path) {
            const nodeStream = createWriteStream(path, { encoding: "utf8" });
            return Writable.toWeb(nodeStream);
        },
    };
}
function elevationBounds(elevation) {
    const z = elevation ?? 0;
    return [0, 0, z, 1, 1, z + 3];
}
function monolithicOnly(monolithic) {
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
function chunkGroupCount(monolithicBytes) {
    return Math.min(MAX_STOREY_TILES, Math.max(2, Math.ceil(monolithicBytes / TILE_MIN_BYTES)));
}
async function convertSubsetFile(path) {
    const subset = await readFile(path);
    const tileFrag = await convertIfcToFragments(new Uint8Array(subset));
    return Buffer.from(tileFrag);
}
async function buildStoreyTiles(dir, inputPath, storeys, onProgress) {
    const limited = storeys.slice(0, MAX_STOREY_TILES);
    const splitter = new FRAGS.IfcSplitter(nodeIfcSplitterIO());
    const tiles = [];
    for (let i = 0; i < limited.length; i++) {
        const storey = limited[i];
        const outPath = join(dir, `storey_${i}.ifc`);
        try {
            await splitter.extract(inputPath, storey.expressIds, outPath);
            const buffer = await convertSubsetFile(outPath);
            tiles.push({
                id: storey.id,
                buffer,
                bounds: elevationBounds(storey.elevation),
                guidCount: storey.expressIds.length,
            });
        }
        catch (err) {
            console.warn("[bim.fragments] storey tile skipped", storey.name, err);
        }
        onProgress?.((i + 1) / limited.length);
    }
    return tiles;
}
/**
 * Split a large IFC into roughly equal element groups when storey tiling is
 * unavailable (single-storey warehouses, plant models, infrastructure, etc.).
 */
async function buildChunkTiles(dir, inputPath, numGroups, onProgress) {
    const splitter = new FRAGS.IfcSplitter(nodeIfcSplitterIO());
    const groups = await splitter.split(inputPath, numGroups, (groupId) => join(dir, `chunk_${groupId}.ifc`));
    const entries = [...groups.entries()].sort((a, b) => a[0] - b[0]);
    const tiles = [];
    for (let i = 0; i < entries.length; i++) {
        const [groupId, data] = entries[i];
        try {
            const buffer = await convertSubsetFile(data.path);
            tiles.push({
                id: `chunk_${groupId}`,
                buffer,
                bounds: [0, 0, i, 1, 1, i + 1],
                guidCount: data.ids.size,
            });
        }
        catch (err) {
            console.warn("[bim.fragments] chunk tile skipped", groupId, err);
        }
        onProgress?.((i + 1) / Math.max(1, entries.length));
    }
    return tiles;
}
/**
 * Convert IFC → Fragments; for large models also produce tiles via storey
 * extract when possible, otherwise equal element-group splits.
 */
// fallow-ignore-next-line complexity
export async function convertIfcToFragmentsWithTiles(ifcBytes, onProgress) {
    onProgress?.(0.02, "fragments");
    const fragBytes = await convertIfcToFragments(ifcBytes, (f) => onProgress?.(0.02 + f * 0.7, "fragments"));
    const monolithic = Buffer.from(fragBytes);
    if (monolithic.byteLength < TILE_MIN_BYTES) {
        onProgress?.(1, "fragments");
        return monolithicOnly(monolithic);
    }
    const storeys = await collectStoreyGroups(ifcBytes);
    const dir = await mkdtemp(join(tmpdir(), "plansync-bim-tiles-"));
    const inputPath = join(dir, "source.ifc");
    await writeFile(inputPath, ifcBytes);
    let tiles = [];
    try {
        if (storeys.length >= 2) {
            tiles = await buildStoreyTiles(dir, inputPath, storeys, (f) => onProgress?.(0.72 + f * 0.28, "tiles"));
        }
        // Large single/few-storey models still need progressive load tiles.
        if (tiles.length < 2) {
            tiles = await buildChunkTiles(dir, inputPath, chunkGroupCount(monolithic.byteLength), (f) => onProgress?.(0.72 + f * 0.28, "tiles"));
        }
    }
    finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    if (tiles.length < 2) {
        return monolithicOnly(monolithic);
    }
    onProgress?.(1, "tiles");
    return { monolithic, tiles };
}
