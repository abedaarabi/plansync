import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/**
 * Surface-first sectioning: choose a model face, then pull its cut plane
 * through the model along the face normal.
 */
export class SectionBoxController {
  private bounds: THREE.Box3 | null = null;
  private plane: OBC.SimplePlane | null = null;
  private cutNormal: THREE.Vector3 | null = null;
  private cutGuide: THREE.Group | null = null;
  private previewGuide: THREE.Group | null = null;
  private initialPoint: THREE.Vector3 | null = null;
  private depthLabel: HTMLDivElement | null = null;
  private drag: { startOrigin: THREE.Vector3; startPlaneT: number; startPointerT: number } | null =
    null;

  constructor(
    private readonly getWorld: () => OBC.SimpleWorld<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBF.RendererWith2D
    > | null,
    private readonly getClipper: () => OBC.Clipper,
    private readonly getCamera: () => THREE.Camera | null,
    private readonly onRender: () => void,
    private readonly formatDistance: (distance: number) => string,
  ) {}

  /** Enter surface-pick mode. The first face click creates the cut plane. */
  activate(bounds: THREE.Box3): void {
    this.deactivate();
    this.bounds = bounds.clone();
  }

  hasSurface(): boolean {
    return this.plane != null;
  }

  /** Create a cut plane that moves inward from the selected face. */
  selectSurface(point: THREE.Vector3, surfaceNormal: THREE.Vector3): boolean {
    const world = this.getWorld();
    if (!world?.renderer || !this.bounds || surfaceNormal.lengthSq() < 1e-8) return false;

    // A click without dragging re-picks the cutting face instead of accumulating planes.
    if (this.plane) {
      const bounds = this.bounds.clone();
      this.deactivate();
      this.bounds = bounds;
    }
    const normal = this.snapNormal(surfaceNormal).negate();
    const id = this.getClipper().createFromNormalAndCoplanarPoint(world, normal, point);
    const plane = this.getClipper().list.get(id);
    if (!plane) return false;

    plane.type = "surface-section";
    plane.enabled = true;
    hideClipPlaneFace(plane);
    this.plane = plane;
    this.cutNormal = normal;
    this.initialPoint = point.clone();
    this.disposePreviewGuide();
    this.buildCutGuide(point, normal);
    world.renderer.updateClippingPlanes();
    this.onRender();
    return true;
  }

  deactivate(): void {
    this.endDrag();
    this.disposeCutGuide();
    this.disposePreviewGuide();
    this.plane = null;
    this.cutNormal = null;
    this.bounds = null;
    this.initialPoint = null;
    // Scrub any orphaned CSS2D label nodes left by earlier previews.
    document.querySelectorAll(".bim-section-depth-label").forEach((el) => el.remove());
    const clipper = this.getClipper();
    for (const [, plane] of clipper.list) {
      plane.controls.detach();
      plane.controls.enabled = false;
    }
    clipper.deleteAll();
  }

  beginDrag(pointerT: number): void {
    const plane = this.plane;
    if (!plane) return;
    this.drag = {
      startOrigin: plane.origin.clone(),
      startPlaneT: this.scalar(plane.origin),
      startPointerT: pointerT,
    };
  }

  pointerAxisT(ndc: THREE.Vector2): number | null {
    const camera = this.getCamera();
    const normal = this.cutNormal;
    const point = this.plane?.origin;
    if (!camera || !normal || !point) return null;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    let dragPlaneNormal = new THREE.Vector3().crossVectors(normal, cameraDirection);
    if (dragPlaneNormal.lengthSq() < 1e-6) {
      dragPlaneNormal = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0));
    }
    dragPlaneNormal.normalize();

    const hit = new THREE.Vector3();
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(dragPlaneNormal, point);
    if (!raycaster.ray.intersectPlane(dragPlane, hit)) return null;
    return this.scalar(hit);
  }

  pointerMove(ndc: THREE.Vector2): void {
    const drag = this.drag;
    if (!drag) return;
    const pointerT = this.pointerAxisT(ndc);
    if (pointerT == null) return;
    this.dragTo(pointerT);
  }

  endDrag(): void {
    this.drag = null;
  }

  isDragging(): boolean {
    return this.drag != null;
  }

  /** Show a non-clipping preview while the user chooses a surface. */
  previewSurface(point: THREE.Vector3, surfaceNormal: THREE.Vector3): void {
    if (!this.bounds || this.plane || surfaceNormal.lengthSq() < 1e-8) return;
    const normal = this.snapNormal(surfaceNormal).negate();
    if (!this.previewGuide) {
      this.previewGuide = this.createGuide(point, normal, {
        fillOpacity: 0.16,
        withLabel: false,
      });
      return;
    }
    this.previewGuide.position.copy(point);
    this.previewGuide.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.onRender();
  }

  clearPreview(): void {
    this.disposePreviewGuide();
  }

  reset(): boolean {
    if (!this.plane || !this.initialPoint) return false;
    this.applyPlane(this.plane, this.initialPoint);
    this.cutGuide?.position.copy(this.initialPoint);
    this.updateDepthLabel();
    this.onRender();
    return true;
  }

  flip(): boolean {
    const plane = this.plane;
    const normal = this.cutNormal;
    if (!plane || !normal) return false;
    normal.negate();
    plane.normal.copy(normal);
    this.applyPlane(plane, plane.origin);
    this.cutGuide?.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.onRender();
    return true;
  }

  private dragTo(pointerT: number): void {
    const drag = this.drag;
    const bounds = this.bounds;
    const plane = this.plane;
    const normal = this.cutNormal;
    if (!drag || !bounds || !plane || !normal) return;

    const [min, max] = this.boundScalars(bounds);
    const nextT = THREE.MathUtils.clamp(drag.startPlaneT + pointerT - drag.startPointerT, min, max);
    const point = drag.startOrigin.clone().addScaledVector(normal, nextT - drag.startPlaneT);
    this.applyPlane(plane, point);
    this.cutGuide?.position.copy(point);
    this.updateDepthLabel();
    this.onRender();
  }

  private scalar(point: THREE.Vector3): number {
    return point.dot(this.cutNormal!);
  }

  private boundScalars(bounds: THREE.Box3): [number, number] {
    const values = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ].map((corner) => this.scalar(corner));
    return [Math.min(...values), Math.max(...values)];
  }

  private applyPlane(plane: OBC.SimplePlane, point: THREE.Vector3): void {
    plane.origin.copy(point);
    plane.helper.position.copy(point);
    plane.three.setFromNormalAndCoplanarPoint(plane.normal, point);
    const renderer = this.getWorld()?.renderer;
    if (renderer) renderer.setPlane(true, plane.three, this.getClipper().localClippingPlanes);
    renderer?.updateClippingPlanes();
  }

  private buildCutGuide(point: THREE.Vector3, normal: THREE.Vector3): void {
    this.disposeCutGuide();
    this.cutGuide = this.createGuide(point, normal, { fillOpacity: 0.1, withLabel: true });
    this.updateDepthLabel();
  }

  private createGuide(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    opts: { fillOpacity: number; withLabel: boolean },
  ): THREE.Group | null {
    const world = this.getWorld();
    const bounds = this.bounds;
    if (!world || !bounds) return null;
    const guide = new THREE.Group();
    guide.name = "surface-section-guide";
    const side = bounds.getSize(new THREE.Vector3()).length() * 1.35;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(side, side),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: opts.fillOpacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(side, side)),
      new THREE.LineBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    edge.renderOrder = 999;
    fill.renderOrder = 998;
    guide.add(fill, edge);
    guide.position.copy(point);
    guide.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    if (opts.withLabel) {
      const label = document.createElement("div");
      label.className = "bim-section-depth-label";
      label.style.cssText =
        "border:1px solid #3B82F6;border-radius:4px;background:rgba(15,23,42,.9);color:#BFDBFE;font:600 12px Inter,sans-serif;padding:4px 6px;white-space:nowrap;pointer-events:none";
      const labelObject = new CSS2DObject(label);
      labelObject.position.set(0, 0, 0.02);
      guide.add(labelObject);
      this.depthLabel = label;
    }
    world.scene.three.add(guide);
    return guide;
  }

  private disposeCutGuide(): void {
    this.disposeGuide(this.cutGuide);
    this.cutGuide = null;
    this.depthLabel = null;
  }

  private disposePreviewGuide(): void {
    this.disposeGuide(this.previewGuide);
    this.previewGuide = null;
  }

  private disposeGuide(guide: THREE.Group | null): void {
    if (!guide) return;
    guide.traverse((child) => {
      // CSS2D labels leave orphan DOM nodes (tiny dots) if only the Object3D is removed.
      if (child instanceof CSS2DObject) {
        child.element.remove();
      }
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
    });
    guide.removeFromParent();
  }

  private updateDepthLabel(): void {
    if (!this.depthLabel || !this.plane || !this.initialPoint) return;
    this.depthLabel.textContent = `Cut depth ${this.formatDistance(
      this.plane.origin.distanceTo(this.initialPoint),
    )}`;
  }

  private snapNormal(normal: THREE.Vector3): THREE.Vector3 {
    const normalized = normal.clone().normalize();
    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    const closest = axes.reduce((best, axis) =>
      Math.abs(normalized.dot(axis)) > Math.abs(normalized.dot(best)) ? axis : best,
    );
    return Math.abs(normalized.dot(closest)) >= 0.985
      ? closest.clone().multiplyScalar(Math.sign(normalized.dot(closest)))
      : normalized;
  }
}

/** Hide the built-in SimplePlane face; our outlined guide communicates the cut. */
export function hideClipPlaneFace(plane: OBC.SimplePlane): void {
  const hide = (material: THREE.Material) => {
    material.transparent = true;
    material.opacity = 0;
    material.visible = false;
    material.depthWrite = false;
  };
  const material = plane.planeMaterial;
  if (Array.isArray(material)) material.forEach(hide);
  else hide(material as THREE.Material);
  for (const child of plane.helper.children) {
    if (child instanceof THREE.Mesh) child.visible = false;
  }
  plane.helper.visible = false;
  plane.controls.detach();
  plane.controls.showX = false;
  plane.controls.showY = false;
  plane.controls.showZ = false;
  plane.controls.enabled = false;
  plane.controls.getHelper().visible = false;
}
