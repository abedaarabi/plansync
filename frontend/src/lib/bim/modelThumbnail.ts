import {
  fetchBimFragmentsBuffer,
  fetchBimStatus,
  triggerBimConversion,
} from "@/lib/api-client/bim-viewer";
import {
  buildThumbnailCacheKey,
  readCachedThumbnail,
  writeCachedThumbnail,
} from "@/lib/bim/bimThumbnailCache";
import { getViewportColors } from "@/lib/bim/renderingProfile";
import { buildFragmentsCacheKey, readCachedFragments } from "@/lib/bimFragmentsCache";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

const FRAGMENTS_WORKER_URL = "/bim/fragments-worker.mjs";
const THUMB_W = 320;
const THUMB_H = 240;

type ThumbWorld = OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.RendererWith2D>;

class ModelThumbnailService {
  private container: HTMLDivElement | null = null;
  private components: OBC.Components | null = null;
  private world: ThumbWorld | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly memory = new Map<string, string>();
  private generation = 0;

  request(fileVersionId: string, fileId: string): Promise<string | null> {
    const cached = this.memory.get(fileVersionId);
    if (cached) return Promise.resolve(cached);

    const task = this.chain.then(() => this.render(fileVersionId, fileId));
    this.chain = task.catch(() => undefined);
    return task;
  }

  /**
   * Releases the offscreen WebGL + fragments worker. Must run before the BIM
   * viewer starts — the singleton otherwise survives SPA navigations and can
   * block `BimEngine.init` until a full page refresh.
   */
  // fallow-ignore-next-line complexity
  dispose(): void {
    this.generation += 1;
    this.chain = Promise.resolve();
    if (this.components) {
      try {
        this.components.dispose();
      } catch {
        /* ignore */
      }
      this.components = null;
    }
    this.world = null;
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  // fallow-ignore-next-line complexity
  private async render(fileVersionId: string, fileId: string): Promise<string | null> {
    const gen = this.generation;
    const mem = this.memory.get(fileVersionId);
    if (mem) return mem;

    const cacheKey = buildThumbnailCacheKey(fileVersionId);
    const stored = await readCachedThumbnail(cacheKey);
    if (gen !== this.generation) return null;
    if (stored) {
      this.memory.set(fileVersionId, stored);
      return stored;
    }

    const fragKey = buildFragmentsCacheKey(fileId, fileVersionId);
    const status = await fetchBimStatus(fileVersionId).catch(() => null);
    let buffer = await readCachedFragments(fragKey);
    if (!buffer?.byteLength && status?.fragmentsReady) {
      buffer = await fetchBimFragmentsBuffer(fileVersionId).catch(() => null);
    }
    if (gen !== this.generation) return null;

    if (!buffer?.byteLength) {
      void triggerBimConversion(fileVersionId).catch(() => undefined);
      return null;
    }

    await this.ensureWorld();
    if (gen !== this.generation || !this.world || !this.components) return null;
    const world = this.world;
    const fragments = this.components.get(OBC.FragmentsManager);
    const modelId = `thumb:${fileVersionId}`;

    for (const [id] of fragments.list) {
      if (id.startsWith("thumb:")) fragments.list.delete(id);
    }

    const model = await fragments.core.load(buffer, { modelId });
    if (gen !== this.generation) {
      try {
        await model.dispose();
      } catch {
        /* ignore */
      }
      return null;
    }
    if (!world.scene.three.children.includes(model.object)) {
      world.scene.three.add(model.object);
    }
    model.useCamera(world.camera.three as THREE.PerspectiveCamera);
    await fragments.core.update(true);

    const sphere = new THREE.Sphere();
    model.box.getBoundingSphere(sphere);
    if (sphere.radius > 0 && Number.isFinite(sphere.radius)) {
      const fit = sphere.clone();
      fit.radius *= 0.84;
      await world.camera.controls.fitToSphere(fit, false);
      world.camera.controls.setOrbitPoint(sphere.center.x, sphere.center.y, sphere.center.z);
    }

    await fragments.core.update(true);
    this.renderFrame(world);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        this.renderFrame(world);
        requestAnimationFrame(() => resolve());
      });
    });
    if (gen !== this.generation) return null;

    const dataUrl = world.renderer!.three.domElement.toDataURL("image/jpeg", 0.74);

    try {
      await model.dispose();
    } catch {
      /* ignore */
    }
    fragments.list.delete(modelId);

    this.memory.set(fileVersionId, dataUrl);
    void writeCachedThumbnail(cacheKey, dataUrl);
    return dataUrl;
  }

  private renderFrame(world: ThumbWorld): void {
    const renderer = world.renderer as OBF.RendererWith2D & { update?: () => void };
    renderer.update?.();
  }

  private async ensureWorld(): Promise<void> {
    if (this.world && this.components) return;

    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    Object.assign(container.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: `${THUMB_W}px`,
      height: `${THUMB_H}px`,
      overflow: "hidden",
      pointerEvents: "none",
      opacity: "0",
    });
    document.body.appendChild(container);
    this.container = container;

    const components = new OBC.Components();
    this.components = components;
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBF.RendererWith2D>();
    this.world = world;

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBF.RendererWith2D(components, container);
    world.renderer.showLogo = false;
    world.camera = new OBC.OrthoPerspectiveCamera(components);
    components.init();

    const sky = getViewportColors("cinematic");
    world.scene.setup({
      backgroundColor: new THREE.Color(sky.bgHaze),
      directionalLight: {
        color: new THREE.Color(sky.sun),
        intensity: sky.sunIntensity * 1.05,
        position: new THREE.Vector3(48, 88, 42),
      },
      ambientLight: {
        color: new THREE.Color(sky.ambient),
        intensity: Math.min(0.55, sky.ambientIntensity + 0.12),
      },
    });

    const renderer = world.renderer.three;
    renderer.setSize(THUMB_W, THUMB_H, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = sky.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const fragments = components.get(OBC.FragmentsManager);
    fragments.init(FRAGMENTS_WORKER_URL);
  }
}

const service = new ModelThumbnailService();

export function requestModelThumbnail(
  fileVersionId: string,
  fileId: string,
): Promise<string | null> {
  return service.request(fileVersionId, fileId);
}

/** Free thumbnail WebGL/worker before opening the full BIM viewer. */
export function disposeModelThumbnailService(): void {
  service.dispose();
}
