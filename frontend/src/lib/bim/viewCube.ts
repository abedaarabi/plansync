import * as THREE from "three";

const CANVAS_PX = 128;
const DRAG_CLICK_THRESHOLD_PX = 6;
const ROTATE_SENSITIVITY = 0.008;
const HALF = 0.42;
const EDGE_THICK = 0.06;
const EDGE_LEN = 0.84;
const CORNER_RADIUS = 0.07;
const AXIS_LEN = 0.78;

/** RGB triad — matches common CAD/BIM conventions. */
const AXIS = {
  x: "#ef4444",
  y: "#22c55e",
  z: "#3b82f6",
} as const;

type CubeFace = "posX" | "negX" | "posY" | "negY" | "posZ" | "negZ";
type PickKind = "face" | "edge" | "corner";

const FACE_NORMALS: Record<CubeFace, THREE.Vector3> = {
  posX: new THREE.Vector3(1, 0, 0),
  negX: new THREE.Vector3(-1, 0, 0),
  posY: new THREE.Vector3(0, 1, 0),
  negY: new THREE.Vector3(0, -1, 0),
  posZ: new THREE.Vector3(0, 0, 1),
  negZ: new THREE.Vector3(0, 0, -1),
};

const FACE_META: Record<CubeFace, { label: string; short: string; tint: string; edge: string }> = {
  posX: { label: "Right", short: "R", tint: "#fff5f5", edge: AXIS.x },
  negX: { label: "Left", short: "L", tint: "#fff5f5", edge: AXIS.x },
  posY: { label: "Top", short: "T", tint: "#f0fdf4", edge: AXIS.y },
  negY: { label: "Bottom", short: "B", tint: "#f0fdf4", edge: AXIS.y },
  posZ: { label: "Front", short: "F", tint: "#eff6ff", edge: AXIS.z },
  negZ: { label: "Back", short: "K", tint: "#eff6ff", edge: AXIS.z },
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function faceTexture(face: CubeFace): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const meta = FACE_META[face];
    const inset = 18;
    const radius = 28;

    ctx.clearRect(0, 0, size, size);

    // Soft fill
    roundRect(ctx, inset, inset, size - inset * 2, size - inset * 2, radius);
    const grad = ctx.createLinearGradient(inset, inset, size - inset, size - inset);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, meta.tint);
    ctx.fillStyle = grad;
    ctx.fill();

    // Inner hairline
    roundRect(
      ctx,
      inset + 3,
      inset + 3,
      size - (inset + 3) * 2,
      size - (inset + 3) * 2,
      radius - 4,
    );
    ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Accent edge (subtle axis cue)
    roundRect(ctx, inset, inset, size - inset * 2, size - inset * 2, radius);
    ctx.strokeStyle = meta.edge;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Primary short label
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 92px Inter, Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.short, size / 2, size / 2 - 10);

    // Full label under short letter
    ctx.fillStyle = "#64748b";
    ctx.font = "600 26px Inter, Segoe UI, system-ui, sans-serif";
    ctx.fillText(meta.label.toUpperCase(), size / 2, size / 2 + 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function axisLetterSprite(letter: string, color: string): THREE.Sprite {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 22, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px Inter, Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, size / 2, size / 2 + 1);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.22, 0.22, 0.22);
  sprite.renderOrder = 10;
  return sprite;
}

function buildAxisTriad(): THREE.Group {
  const group = new THREE.Group();
  const axes: { color: string; letter: string; dir: THREE.Vector3 }[] = [
    { color: AXIS.x, letter: "X", dir: new THREE.Vector3(1, 0, 0) },
    { color: AXIS.y, letter: "Y", dir: new THREE.Vector3(0, 1, 0) },
    { color: AXIS.z, letter: "Z", dir: new THREE.Vector3(0, 0, 1) },
  ];

  for (const axis of axes) {
    const shaftGeo = new THREE.CylinderGeometry(0.018, 0.018, AXIS_LEN * 0.72, 10);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: axis.color,
      roughness: 0.35,
      metalness: 0.15,
      toneMapped: false,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.dir);
    shaft.position.copy(axis.dir.clone().multiplyScalar((AXIS_LEN * 0.72) / 2));
    group.add(shaft);

    const tipGeo = new THREE.ConeGeometry(0.045, 0.12, 12);
    const tip = new THREE.Mesh(tipGeo, shaftMat.clone());
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.dir);
    tip.position.copy(axis.dir.clone().multiplyScalar(AXIS_LEN * 0.72 + 0.05));
    group.add(tip);

    const badge = axisLetterSprite(axis.letter, axis.color);
    badge.position.copy(axis.dir.clone().multiplyScalar(AXIS_LEN * 0.72 + 0.2));
    group.add(badge);
  }

  // Origin node
  const origin = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 12),
    new THREE.MeshStandardMaterial({
      color: "#0f172a",
      roughness: 0.4,
      metalness: 0.2,
      toneMapped: false,
    }),
  );
  group.add(origin);
  group.position.set(-0.02, -0.02, -0.02);
  return group;
}

function pickPriority(kind: PickKind): number {
  if (kind === "corner") return 0;
  if (kind === "edge") return 1;
  return 2;
}

/** Corner view cube — faces, edges, corners, drag orbit. */
export class ViewCubeOverlay {
  private wrap: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private cubeRoot: THREE.Group;
  private pickables: THREE.Object3D[] = [];
  private faceMaterials: THREE.MeshStandardMaterial[] = [];
  private highlightTarget: THREE.Object3D | null = null;
  private highlightMaterial: THREE.MeshStandardMaterial | null = null;
  private faceHoverMaterials: THREE.MeshStandardMaterial[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private disposed = false;
  private dragging = false;
  private dragTotal = 0;
  private lastPointer = { x: 0, y: 0 };
  private onFaceSelect: (normal: THREE.Vector3) => void;
  private onDrag: (dx: number, dy: number) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onPointerLeave: (e: PointerEvent) => void;

  constructor(
    container: HTMLElement,
    opts: {
      onFaceSelect: (normal: THREE.Vector3) => void;
      onDrag: (dx: number, dy: number) => void;
    },
  ) {
    this.onFaceSelect = opts.onFaceSelect;
    this.onDrag = opts.onDrag;

    this.wrap = document.createElement("div");
    this.wrap.className = "bim-view-cube";
    this.wrap.title = "Drag to orbit · Click a face, edge, or corner";
    this.wrap.setAttribute("role", "group");
    this.wrap.setAttribute("aria-label", "View orientation cube");

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "bim-view-cube__canvas-wrap";

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_PX;
    canvas.height = CANVAS_PX;
    canvas.className = "bim-view-cube__canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvasWrap.appendChild(canvas);
    this.wrap.appendChild(canvasWrap);
    container.appendChild(this.wrap);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(CANVAS_PX, CANVAS_PX, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.88));
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(2.2, 3.6, 2.8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdbeafe, 0.28);
    fill.position.set(-2, 1.5, -1.5);
    this.scene.add(fill);

    this.camera = new THREE.OrthographicCamera(-1.15, 1.15, 1.15, -1.15, 0.1, 20);
    this.camera.position.set(0, 0, 4.5);
    this.camera.lookAt(0, 0, 0);

    this.cubeRoot = new THREE.Group();
    this.scene.add(this.cubeRoot);

    const geometry = new THREE.BoxGeometry(0.84, 0.84, 0.84);
    const faces: CubeFace[] = ["posX", "negX", "posY", "negY", "posZ", "negZ"];
    this.faceMaterials = faces.map((face) => {
      const mat = new THREE.MeshStandardMaterial({
        map: faceTexture(face),
        transparent: true,
        opacity: 0.97,
        roughness: 0.32,
        metalness: 0.02,
        toneMapped: false,
      });
      mat.userData = { kind: "face" as PickKind, direction: FACE_NORMALS[face].clone() };
      return mat;
    });

    const cube = new THREE.Mesh(geometry, this.faceMaterials);
    cube.userData = { kind: "face" };
    this.cubeRoot.add(cube);
    this.pickables.push(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: "#94a3b8",
        transparent: true,
        opacity: 0.45,
        toneMapped: false,
      }),
    );
    cube.add(edges);

    this.cubeRoot.add(buildAxisTriad());
    this.addEdgePickers();
    this.addCornerPickers();

    this.onPointerDown = (e: PointerEvent) => {
      if (this.disposed || e.button !== 0) return;
      e.stopPropagation();
      this.dragging = true;
      this.dragTotal = 0;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("is-dragging");
      this.wrap.classList.add("is-active");
      this.clearHighlight();
    };

    this.onPointerMove = (e: PointerEvent) => {
      if (this.disposed) return;
      e.stopPropagation();
      if (this.dragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.dragTotal += Math.hypot(dx, dy);
        this.lastPointer = { x: e.clientX, y: e.clientY };
        if (this.dragTotal > DRAG_CLICK_THRESHOLD_PX) this.onDrag(dx, dy);
        return;
      }
      this.updateHover(e);
    };

    // fallow-ignore-next-line complexity
    this.onPointerUp = (e: PointerEvent) => {
      if (this.disposed || e.button !== 0) return;
      e.stopPropagation();
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.classList.remove("is-dragging");
      this.wrap.classList.remove("is-active");
      const wasClick = this.dragging && this.dragTotal < DRAG_CLICK_THRESHOLD_PX;
      this.dragging = false;
      if (wasClick) {
        const dir = this.pickDirection(e);
        if (dir) this.onFaceSelect(dir);
      } else {
        this.updateHover(e);
      }
    };

    this.onPointerLeave = () => {
      if (!this.dragging) {
        this.clearHighlight();
        this.wrap.classList.remove("is-active");
      }
    };

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.sync(new THREE.Quaternion());
  }

  // fallow-ignore-next-line complexity
  private addEdgePickers(): void {
    const mat = () =>
      new THREE.MeshStandardMaterial({
        color: "#3B82F6",
        transparent: true,
        opacity: 0,
        roughness: 0.45,
        metalness: 0.05,
        toneMapped: false,
      });

    for (const sy of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        this.addPicker(
          new THREE.Vector3(1, sy, sz).normalize(),
          "edge",
          new THREE.Vector3(0, sy * HALF, sz * HALF),
          new THREE.Vector3(EDGE_LEN, EDGE_THICK, EDGE_THICK),
          mat(),
        );
      }
    }
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        this.addPicker(
          new THREE.Vector3(sx, 1, sz).normalize(),
          "edge",
          new THREE.Vector3(sx * HALF, 0, sz * HALF),
          new THREE.Vector3(EDGE_THICK, EDGE_LEN, EDGE_THICK),
          mat(),
        );
      }
    }
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        this.addPicker(
          new THREE.Vector3(sx, sy, 1).normalize(),
          "edge",
          new THREE.Vector3(sx * HALF, sy * HALF, 0),
          new THREE.Vector3(EDGE_THICK, EDGE_THICK, EDGE_LEN),
          mat(),
        );
      }
    }
  }

  private addCornerPickers(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: "#3B82F6",
      transparent: true,
      opacity: 0,
      roughness: 0.4,
      metalness: 0.08,
      toneMapped: false,
    });

    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const dir = new THREE.Vector3(sx, sy, sz).normalize();
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(CORNER_RADIUS, 12, 12), mat.clone());
          mesh.position.set(sx * HALF, sy * HALF, sz * HALF);
          mesh.userData = { kind: "corner" as PickKind, direction: dir };
          this.cubeRoot.add(mesh);
          this.pickables.push(mesh);
        }
      }
    }
  }

  private addPicker(
    direction: THREE.Vector3,
    kind: PickKind,
    position: THREE.Vector3,
    scale: THREE.Vector3,
    material: THREE.MeshStandardMaterial,
  ): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.position.copy(position);
    mesh.scale.copy(scale);
    mesh.userData = { kind, direction };
    this.cubeRoot.add(mesh);
    this.pickables.push(mesh);
  }

  // fallow-ignore-next-line complexity
  private pickDirection(e: PointerEvent): THREE.Vector3 | null {
    this.setPointerFromEvent(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length === 0) return null;

    hits.sort((a, b) => {
      const ka = (a.object.userData.kind as PickKind) ?? "face";
      const kb = (b.object.userData.kind as PickKind) ?? "face";
      const pa = pickPriority(ka);
      const pb = pickPriority(kb);
      if (pa !== pb) return pa - pb;
      return a.distance - b.distance;
    });

    const hit = hits[0];
    const dir = hit.object.userData.direction as THREE.Vector3 | undefined;
    if (dir) return dir.clone().normalize();

    if (hit.face == null) return null;
    const index = hit.face.materialIndex ?? 0;
    const faces: CubeFace[] = ["posX", "negX", "posY", "negY", "posZ", "negZ"];
    const face = faces[index];
    return face ? FACE_NORMALS[face].clone() : null;
  }

  // fallow-ignore-next-line complexity
  private updateHover(e: PointerEvent): void {
    this.setPointerFromEvent(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length === 0) {
      this.clearHighlight();
      return;
    }

    hits.sort((a, b) => {
      const ka = (a.object.userData.kind as PickKind) ?? "face";
      const kb = (b.object.userData.kind as PickKind) ?? "face";
      return pickPriority(ka) - pickPriority(kb);
    });

    const target = hits[0].object;
    if (target === this.highlightTarget) return;
    this.clearHighlight();

    if (target instanceof THREE.Mesh) {
      const mat = target.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        this.highlightTarget = target;
        this.highlightMaterial = mat;
        mat.opacity = target.userData.kind === "corner" ? 0.88 : 0.72;
        mat.emissive.set("#3B82F6");
        mat.emissiveIntensity = 0.42;
        mat.needsUpdate = true;
        this.renderer.domElement.classList.add("is-hover");
        this.wrap.classList.add("is-hover");
      } else if (Array.isArray(target.material)) {
        this.faceHoverMaterials = [];
        const index = hits[0].face?.materialIndex ?? 0;
        const faceMat = target.material[index];
        if (faceMat instanceof THREE.MeshStandardMaterial) {
          faceMat.emissive.set("#3B82F6");
          faceMat.emissiveIntensity = 0.22;
          this.faceHoverMaterials.push(faceMat);
        }
        this.highlightTarget = target;
        this.renderer.domElement.classList.add("is-hover");
        this.wrap.classList.add("is-hover");
      }
    }
    this.renderCube();
  }

  // fallow-ignore-next-line complexity
  private clearHighlight(): void {
    if (this.highlightMaterial) {
      this.highlightMaterial.opacity = 0;
      this.highlightMaterial.emissive.set("#000000");
      this.highlightMaterial.emissiveIntensity = 0;
      this.highlightMaterial.needsUpdate = true;
    }
    if (
      this.highlightTarget instanceof THREE.Mesh &&
      Array.isArray(this.highlightTarget.material)
    ) {
      for (const m of this.faceHoverMaterials) {
        m.emissive.set("#000000");
        m.emissiveIntensity = 0;
      }
    }
    this.faceHoverMaterials = [];
    this.highlightTarget = null;
    this.highlightMaterial = null;
    this.renderer.domElement.classList.remove("is-hover");
    this.wrap.classList.remove("is-hover");
  }

  private setPointerFromEvent(e: PointerEvent): void {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  sync(cameraQuaternion: THREE.Quaternion): void {
    if (this.disposed || this.wrap.style.display === "none") return;
    this.cubeRoot.quaternion.copy(cameraQuaternion).invert();
    this.renderCube();
  }

  private renderCube(): void {
    this.renderer.render(this.scene, this.camera);
  }

  setVisible(visible: boolean): void {
    this.wrap.style.display = visible ? "" : "none";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.wrap.remove();

    // fallow-ignore-next-line complexity
    this.cubeRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.map?.dispose();
          }
          mat.dispose();
        }
      }
      if (child instanceof THREE.Sprite) {
        const mat = child.material;
        mat.map?.dispose();
        mat.dispose();
      }
      if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
  }
}
