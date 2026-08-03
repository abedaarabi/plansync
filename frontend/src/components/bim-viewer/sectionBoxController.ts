import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

export type SectionHandle = "top" | "side";
type SideAxis = "x" | "z";

const HANDLES: SectionHandle[] = ["top", "side"];
const PAD_RATIO = 0.015;

type SectionPlaneSlot = {
  handle: SectionHandle;
  plane: OBC.SimplePlane;
};

/**
 * BIM-style section box: two draggable handles (top + camera-relative side),
 * invisible clip planes, world-space gizmo arrows, optional bbox outline.
 */
export class SectionBoxController {
  private bounds: THREE.Box3 | null = null;
  private sideAxis: SideAxis = "x";
  private slots = new Map<SectionHandle, SectionPlaneSlot>();
  private arrows = new Map<SectionHandle, THREE.Group>();
  private gizmoRoot: THREE.Group | null = null;
  private boxOutline: THREE.LineSegments | null = null;
  private drag: {
    handle: SectionHandle;
    startOrigin: THREE.Vector3;
    startPlaneT: number;
    startPointerT: number;
  } | null = null;

  constructor(
    private readonly getWorld: () => OBC.SimpleWorld<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBF.RendererWith2D
    > | null,
    private readonly getClipper: () => OBC.Clipper,
    private readonly getCamera: () => THREE.Camera | null,
    private readonly getRaycaster: () => OBC.SimpleRaycaster | null,
    private readonly onRender: () => void,
  ) {}

  isActive(): boolean {
    return this.slots.size > 0;
  }

  /**
   * Activate section box on model or custom bounds.
   * Default: handles sit just outside the box (no clip until drag).
   * `fitTight`: clip immediately to the given bounds (context-menu selection).
   */
  // fallow-ignore-next-line complexity
  activate(bounds: THREE.Box3, opts?: { fitTight?: boolean }): void {
    const world = this.getWorld();
    if (!world?.renderer) return;

    this.deactivate();
    this.bounds = bounds.clone();
    this.sideAxis = this.resolveSideAxis();

    const clipper = this.getClipper();
    const center = bounds.getCenter(new THREE.Vector3());
    const fitTight = opts?.fitTight === true;
    const pad = fitTight ? 0 : bounds.getSize(new THREE.Vector3()).length() * PAD_RATIO;

    for (const handle of HANDLES) {
      const normal = this.clipNormal(handle);
      const point = this.startPoint(handle, bounds, center, pad);
      const id = clipper.createFromNormalAndCoplanarPoint(world, normal, point);
      const plane = clipper.list.get(id);
      if (!plane) continue;
      plane.type = `section-${handle}`;
      plane.enabled = fitTight;
      plane.helper.visible = false;
      if (fitTight) hideClipPlaneFace(plane);
      this.slots.set(handle, { handle, plane });
    }

    this.buildGizmo();
    if (fitTight) world.renderer.updateClippingPlanes();
    this.onRender();
  }

  /** 4. Tear down planes, gizmo, and drag state. */
  deactivate(): void {
    this.endDrag();
    this.disposeGizmo();
    this.slots.clear();
    this.bounds = null;
    const clipper = this.getClipper();
    // SimplePlane.dispose() removes the helper before detaching TransformControls.
    // deleteAll → setPlane → renderer.update then throws if controls are still attached.
    for (const [, plane] of clipper.list) {
      plane.controls.detach();
      plane.controls.enabled = false;
    }
    clipper.deleteAll();
  }

  /** 3. Pick handle for drag. */
  // fallow-ignore-next-line complexity
  pick(ndc: THREE.Vector2): { handle: SectionHandle; plane: OBC.SimplePlane } | null {
    const world = this.getWorld();
    if (!world?.renderer || this.arrows.size === 0) return null;

    const meshes: THREE.Object3D[] = [];
    for (const [handle, arrow] of this.arrows) {
      arrow.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
          child.userData.sectionHandle = handle;
        }
      });
    }
    if (meshes.length === 0) return null;

    const caster = this.getRaycaster();
    if (!caster) return null;

    const hit = caster.castRayToObjects(meshes, ndc);
    if (!hit?.object) return null;

    const handle = hit.object.userData.sectionHandle as SectionHandle | undefined;
    if (!handle) return null;
    const slot = this.slots.get(handle);
    if (!slot) return null;
    return { handle, plane: slot.plane };
  }

  beginDrag(handle: SectionHandle, plane: OBC.SimplePlane, pointerT: number): void {
    const startPlaneT = this.scalar(handle, plane.origin);
    this.drag = {
      handle,
      startOrigin: plane.origin.clone(),
      startPlaneT,
      startPointerT: pointerT,
    };
  }

  /** 3. Incremental axis drag with clamp — clip only once plane enters bbox. */
  // fallow-ignore-next-line complexity
  dragTo(pointerT: number): void {
    const drag = this.drag;
    const bounds = this.bounds;
    if (!drag || !bounds) return;

    const slot = this.slots.get(drag.handle);
    if (!slot) return;

    const delta = pointerT - drag.startPointerT;
    const min = this.minScalar(drag.handle, bounds);
    const max = this.maxScalar(drag.handle, bounds);
    const pad = bounds.getSize(new THREE.Vector3()).length() * PAD_RATIO;
    const newT = THREE.MathUtils.clamp(drag.startPlaneT + delta, min, max + pad);
    const point = this.pointOnAxis(drag.handle, drag.startOrigin, newT);
    const clip = this.shouldClip(drag.handle, newT);

    this.applyPlane(slot.plane, point, clip);

    const arrow = this.arrows.get(drag.handle);
    if (arrow) arrow.position.copy(point);

    this.onRender();
  }

  // fallow-ignore-next-line complexity
  pointerAxisT(handle: SectionHandle, refPoint: THREE.Vector3, ndc: THREE.Vector2): number | null {
    const world = this.getWorld();
    const camera = this.getCamera();
    if (!world || !camera) return null;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);

    const axisDir = this.dragAxis(handle);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    let dragNormal = new THREE.Vector3().crossVectors(axisDir, camDir);
    if (dragNormal.lengthSq() < 1e-6) {
      dragNormal = new THREE.Vector3().crossVectors(axisDir, new THREE.Vector3(0, 1, 0));
    }
    dragNormal.normalize();

    const hit = new THREE.Vector3();
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(dragNormal, refPoint);
    if (!raycaster.ray.intersectPlane(dragPlane, hit)) return null;
    return this.scalar(handle, hit);
  }

  endDrag(): void {
    this.drag = null;
  }

  isDragging(): boolean {
    return this.drag != null;
  }

  /** Continue incremental drag from pointer position. */
  pointerMove(ndc: THREE.Vector2): void {
    const drag = this.drag;
    if (!drag) return;
    const pointerT = this.pointerAxisT(drag.handle, drag.startOrigin, ndc);
    if (pointerT == null) return;
    this.dragTo(pointerT);
  }

  // ------------------------------------------------------------------ internals

  /** 6. Side handle follows the axis most aligned with camera right (flattened to XZ). */
  private resolveSideAxis(): SideAxis {
    const camera = this.getCamera();
    if (!camera) return "x";

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    if (right.lengthSq() < 1e-8) return "x";
    right.normalize();
    return Math.abs(right.x) >= Math.abs(right.z) ? "x" : "z";
  }

  private clipNormal(handle: SectionHandle): THREE.Vector3 {
    if (handle === "top") return new THREE.Vector3(0, -1, 0);
    return this.sideAxis === "x" ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, -1);
  }

  private dragAxis(handle: SectionHandle): THREE.Vector3 {
    if (handle === "top") return new THREE.Vector3(0, 1, 0);
    return this.sideAxis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  }

  // fallow-ignore-next-line complexity
  private outwardDir(
    handle: SectionHandle,
    center: THREE.Vector3,
    point: THREE.Vector3,
  ): THREE.Vector3 {
    if (handle === "top") {
      return new THREE.Vector3(0, point.y >= center.y ? 1 : -1, 0);
    }
    if (this.sideAxis === "x") {
      return new THREE.Vector3(point.x >= center.x ? 1 : -1, 0, 0);
    }
    return new THREE.Vector3(0, 0, point.z >= center.z ? 1 : -1);
  }

  private startPoint(
    handle: SectionHandle,
    box: THREE.Box3,
    center: THREE.Vector3,
    pad: number,
  ): THREE.Vector3 {
    if (handle === "top") {
      return new THREE.Vector3(center.x, box.max.y + pad, center.z);
    }
    if (this.sideAxis === "x") {
      return new THREE.Vector3(box.max.x + pad, center.y, center.z);
    }
    return new THREE.Vector3(center.x, center.y, box.max.z + pad);
  }

  private scalar(handle: SectionHandle, point: THREE.Vector3): number {
    if (handle === "top") return point.y;
    return this.sideAxis === "x" ? point.x : point.z;
  }

  private pointOnAxis(handle: SectionHandle, ref: THREE.Vector3, value: number): THREE.Vector3 {
    const next = ref.clone();
    if (handle === "top") next.y = value;
    else if (this.sideAxis === "x") next.x = value;
    else next.z = value;
    return next;
  }

  private minScalar(handle: SectionHandle, box: THREE.Box3): number {
    if (handle === "top") return box.min.y;
    return this.sideAxis === "x" ? box.min.x : box.min.z;
  }

  private maxScalar(handle: SectionHandle, box: THREE.Box3): number {
    if (handle === "top") return box.max.y;
    return this.sideAxis === "x" ? box.max.x : box.max.z;
  }

  private shouldClip(handle: SectionHandle, t: number): boolean {
    const bounds = this.bounds;
    if (!bounds) return false;
    return t <= this.maxScalar(handle, bounds) + 1e-4;
  }

  // fallow-ignore-next-line complexity
  private applyPlane(plane: OBC.SimplePlane, point: THREE.Vector3, clip: boolean): void {
    // SimplePlane.update() reads helper.position — keep origin, helper, and three in sync.
    plane.origin.copy(point);
    plane.helper.position.copy(point);
    plane.three.setFromNormalAndCoplanarPoint(plane.normal, point);

    const clipper = this.getClipper();
    const renderer = this.getWorld()?.renderer;

    if (clip !== plane.enabled) {
      plane.enabled = clip;
      if (clip) hideClipPlaneFace(plane);
    } else if (clip && renderer) {
      renderer.setPlane(true, plane.three, clipper.localClippingPlanes);
    }

    renderer?.updateClippingPlanes();
  }

  /** 2. World-space gizmo: bbox outline + two arrows. */
  // fallow-ignore-next-line complexity
  private buildGizmo(): void {
    this.disposeGizmo();
    const world = this.getWorld();
    const bounds = this.bounds;
    if (!world || !bounds) return;

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const root = new THREE.Group();
    root.name = "section-gizmo-root";

    const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(boxGeom);
    boxGeom.dispose();
    this.boxOutline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.25,
        depthTest: false,
      }),
    );
    this.boxOutline.position.copy(center);
    this.boxOutline.renderOrder = 999;
    root.add(this.boxOutline);

    for (const handle of HANDLES) {
      const slot = this.slots.get(handle);
      if (!slot) continue;
      const outward = this.outwardDir(handle, center, slot.plane.origin);
      const arrow = this.buildArrow(handle);
      arrow.position.copy(slot.plane.origin);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
      root.add(arrow);
      this.arrows.set(handle, arrow);
    }

    world.scene.three.add(root);
    this.gizmoRoot = root;
  }

  private buildArrow(handle: SectionHandle): THREE.Group {
    const color = handle === "top" ? new THREE.Color("#22C55E") : new THREE.Color("#3B82F6");
    const mat = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.96,
    });
    const rim = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#F9FAFB"),
      depthTest: false,
      transparent: true,
      opacity: 0.35,
    });

    const arrow = new THREE.Group();
    arrow.name = "section-arrow-root";
    arrow.userData.sectionHandle = handle;
    arrow.renderOrder = 1000;

    const shaftLen = 1.6;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, shaftLen, 14), mat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.2 + shaftLen / 2;

    const shaftRim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, shaftLen, 14), rim);
    shaftRim.rotation.copy(shaft.rotation);
    shaftRim.position.copy(shaft.position);

    const headH = 0.48;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, headH, 16), mat);
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.2 + shaftLen + headH / 2;

    const headRim = new THREE.Mesh(new THREE.ConeGeometry(0.28, headH, 16), rim);
    headRim.rotation.copy(head.rotation);
    headRim.position.copy(head.position);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 18), mat);
    knob.position.z = 0.2;

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.z = 0.85;
    hit.userData.sectionHandle = handle;

    for (const part of [shaft, shaftRim, head, headRim, knob, hit]) {
      part.userData.sectionHandle = handle;
    }

    arrow.add(shaftRim, shaft, headRim, head, knob, hit);

    if (this.bounds) {
      const size = this.bounds.getSize(new THREE.Vector3());
      const scale = Math.max(size.x, size.y, size.z) * 0.045;
      arrow.scale.setScalar(THREE.MathUtils.clamp(scale, 2, 50));
    }

    return arrow;
  }

  private disposeGizmo(): void {
    if (!this.gizmoRoot) {
      this.arrows.clear();
      this.boxOutline = null;
      return;
    }
    this.gizmoRoot.removeFromParent();
    this.gizmoRoot.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        const m = child.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.gizmoRoot = null;
    this.boxOutline = null;
    this.arrows.clear();
  }
}

/** Hide SimplePlane face mesh — clipping only, no fill quad. */
// fallow-ignore-next-line complexity
export function hideClipPlaneFace(plane: OBC.SimplePlane): void {
  const mat = plane.planeMaterial;
  const hide = (m: THREE.Material) => {
    m.transparent = true;
    m.opacity = 0;
    m.visible = false;
    m.depthWrite = false;
  };
  if (Array.isArray(mat)) mat.forEach(hide);
  else hide(mat as THREE.Material);

  for (const child of plane.helper.children) {
    if (child instanceof THREE.Mesh && child.name !== "section-arrow-root") {
      child.visible = false;
    }
  }
  plane.helper.visible = false;
  // Custom section gizmos replace built-in TransformControls — detach so
  // clipper teardown / renderer.update never see an orphan attached object.
  const controls = plane.controls;
  controls.detach();
  controls.showX = false;
  controls.showY = false;
  controls.showZ = false;
  controls.enabled = false;
  controls.getHelper().visible = false;
}
