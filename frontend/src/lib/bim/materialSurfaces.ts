import * as THREE from "three";

export type BimSurfaceKind =
  | "concrete"
  | "metal"
  | "aluminum"
  | "wood"
  | "glass"
  | "plastic"
  | "default";

/** Shared procedural maps — IFC rarely ships image textures; these add subtle surface break-up. */
let roughnessMap: THREE.CanvasTexture | null = null;
let normalMap: THREE.CanvasTexture | null = null;

const MAP_SIZE = 128;
const MAP_REPEAT = 3.5;

const NORMAL_SCALE: Record<Exclude<BimSurfaceKind, "glass">, number> = {
  metal: 0.22,
  aluminum: 0.16,
  wood: 0.32,
  plastic: 0.16,
  concrete: 0.38,
  default: 0.28,
};

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  return { canvas, ctx: canvas.getContext("2d") };
}

function finalizeCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(MAP_REPEAT, MAP_REPEAT);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function writeRgba(data: Uint8ClampedArray, i: number, r: number, g: number, b: number): void {
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
}

function createRoughnessMap(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas();
  if (ctx) {
    const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const n =
          hash2(x * 0.11, y * 0.11) * 0.55 +
          hash2(x * 0.37, y * 0.29) * 0.3 +
          hash2(x * 0.9, y * 0.8) * 0.15;
        const v = Math.round(118 + n * 70);
        writeRgba(img.data, (y * MAP_SIZE + x) * 4, v, v, v);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  return finalizeCanvasTexture(canvas);
}

// fallow-ignore-next-line complexity
function createNormalMap(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas();
  if (ctx) {
    const height = new Float32Array(MAP_SIZE * MAP_SIZE);
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        height[y * MAP_SIZE + x] =
          hash2(x * 0.14, y * 0.14) * 0.6 + hash2(x * 0.41, y * 0.33) * 0.4;
      }
    }
    const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const x1 = height[y * MAP_SIZE + ((x + 1) % MAP_SIZE)]!;
        const x0 = height[y * MAP_SIZE + ((x + MAP_SIZE - 1) % MAP_SIZE)]!;
        const y1 = height[((y + 1) % MAP_SIZE) * MAP_SIZE + x]!;
        const y0 = height[((y + MAP_SIZE - 1) % MAP_SIZE) * MAP_SIZE + x]!;
        const dx = (x1 - x0) * 2.2;
        const dy = (y1 - y0) * 2.2;
        const invLen = 1 / Math.sqrt(dx * dx + dy * dy + 1);
        writeRgba(
          img.data,
          (y * MAP_SIZE + x) * 4,
          Math.round((dx * invLen * 0.5 + 0.5) * 255),
          Math.round((dy * invLen * 0.5 + 0.5) * 255),
          Math.round((invLen * 0.5 + 0.5) * 255),
        );
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  return finalizeCanvasTexture(canvas);
}

const SURFACE_KIND_RULES: { kind: BimSurfaceKind; re: RegExp }[] = [
  { kind: "glass", re: /window|curtain|glass|glazing|skylight|plate/ },
  { kind: "aluminum", re: /aluminium|aluminum|mullion|frame/ },
  { kind: "wood", re: /wood|timber|door|furnish/ },
  {
    kind: "metal",
    re: /column|beam|member|plate|reinfor|steel|metal|railing|pipe|duct|fitting|cable/,
  },
  { kind: "plastic", re: /furnish|plastic|equipment|flowterminal/ },
  { kind: "concrete", re: /wall|slab|roof|stair|covering|footing|foundation|pile/ },
];

export function surfaceKindFromIfcType(ifcType: string): BimSurfaceKind {
  const t = ifcType.toLowerCase();
  for (const rule of SURFACE_KIND_RULES) {
    if (rule.re.test(t)) return rule.kind;
  }
  return "default";
}

function ensureMaps(): { roughness: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  if (!roughnessMap) roughnessMap = createRoughnessMap();
  if (!normalMap) normalMap = createNormalMap();
  return { roughness: roughnessMap, normal: normalMap };
}

/** Apply subtle shared surface maps for material readability (no authored IFC textures). */
export function applyBimSurfaceMaps(mat: THREE.MeshStandardMaterial, kind: BimSurfaceKind): void {
  if (kind === "glass") {
    mat.roughnessMap = null;
    mat.normalMap = null;
    mat.normalScale.set(1, 1);
    return;
  }

  const maps = ensureMaps();
  mat.roughnessMap = maps.roughness;
  mat.normalMap = maps.normal;
  const scale = NORMAL_SCALE[kind];
  mat.normalScale.set(scale, scale);
}
