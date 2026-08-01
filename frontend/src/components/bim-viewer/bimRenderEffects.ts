import {
  BimAdaptiveQualityController,
  bimQualityPixelRatio,
  type BimGpuProfile,
  type BimQualityState,
} from "@/lib/bim/renderQuality";
import { BIM_PALETTE } from "@/lib/bim/bimPalette";
import type { BimEdgeMode, BimViewportAppearance } from "@/lib/bim/viewportAppearance";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

type BimPostWorld = OBC.SimpleWorld<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>;

function deviceMemoryGb(): number | null {
  if (typeof navigator === "undefined") return null;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === "number" && Number.isFinite(memory) ? memory : null;
}

function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function styleFor(ao: boolean, edges: BimEdgeMode): OBF.PostproductionAspect {
  if (ao && edges !== "off") return OBF.PostproductionAspect.COLOR_PEN_SHADOWS;
  if (ao) return OBF.PostproductionAspect.COLOR_SHADOWS;
  if (edges !== "off") return OBF.PostproductionAspect.COLOR_PEN;
  return OBF.PostproductionAspect.COLOR;
}

export class BimRenderEffects {
  private readonly renderer: OBF.PostproductionRenderer;
  private readonly components: OBC.Components;
  private readonly world: BimPostWorld;
  private readonly onQualityChanged?: (state: BimQualityState) => void;
  private appearance: BimViewportAppearance;
  private adaptive: BimAdaptiveQualityController;
  private fxaaPass: ShaderPass | null = null;
  private fxaaRestoreTimer: number | null = null;
  private frameStartedAt = 0;
  private modelCount = 0;
  private interacting = false;

  constructor(
    components: OBC.Components,
    world: BimPostWorld,
    appearance: BimViewportAppearance,
    onQualityChanged?: (state: BimQualityState) => void,
  ) {
    this.components = components;
    this.world = world;
    this.renderer = world.renderer!;
    this.appearance = appearance;
    this.onQualityChanged = onQualityChanged;
    this.adaptive = new BimAdaptiveQualityController(
      appearance.qualityPreset,
      this.readGpuProfile(),
    );

    this.renderer.postproduction.enabled = true;
    this.renderer.turnOffOnManualMode = true;
    this.renderer.manualModeDelay = 90;
    this.renderer.postproduction.outlinesEnabled = true;
    this.renderer.onBeforeUpdate.add(this.onBeforeRender);
    this.renderer.onAfterUpdate.add(this.onAfterRender);
    this.applyQuality(this.adaptive.current);
  }

  setModelCount(count: number): void {
    this.modelCount = Math.max(0, count);
    this.updateAppearance(this.appearance);
  }

  isolateMaterial(material: THREE.Material): void {
    const isolated = this.renderer.postproduction.basePass.isolatedMaterials;
    if (!isolated.includes(material)) isolated.push(material);
  }

  updateAppearance(appearance: BimViewportAppearance): void {
    this.appearance = appearance;
    const state = this.adaptive.updatePreference(appearance.qualityPreset, this.readGpuProfile());
    this.applyQuality(state);
  }

  beginInteraction(): void {
    this.interacting = true;
  }

  endInteraction(): void {
    this.interacting = false;
    const restored = this.adaptive.restoreAfterInteraction();
    if (restored) this.applyQuality(restored);
  }

  async setSelection(map: OBC.ModelIdMap | null): Promise<void> {
    const outliner = this.components.get(OBF.Outliner);
    outliner.world = this.world;
    outliner.enabled = true;
    outliner.create("selection", {
      color: new THREE.Color(BIM_PALETTE.interaction.selectedOutline),
      fillColor: new THREE.Color(BIM_PALETTE.interaction.selectedOutline),
      fillOpacity: 0.05,
      thickness: 1.25,
      priority: 2,
    });
    outliner.clean("selection");
    if (map) await outliner.addItems(map, "selection");
  }

  resize(): void {
    this.applyPixelRatio(this.adaptive.current.effective);
    this.updateFxaaResolution();
  }

  updateCamera(): void {
    this.renderer.postproduction.updateCamera();
  }

  dispose(): void {
    this.renderer.onBeforeUpdate.remove(this.onBeforeRender);
    this.renderer.onAfterUpdate.remove(this.onAfterRender);
    this.components.get(OBF.Outliner).clean("selection");
    if (this.fxaaRestoreTimer != null) window.clearTimeout(this.fxaaRestoreTimer);
    this.fxaaPass?.dispose();
    this.fxaaPass = null;
  }

  private readGpuProfile(): BimGpuProfile {
    const gl = this.renderer.three;
    return {
      deviceMemoryGb: deviceMemoryGb(),
      coarsePointer: isCoarsePointer(),
      maxSamples: gl.capabilities.maxSamples,
      maxTextureSize: gl.capabilities.maxTextureSize,
      modelCount: this.modelCount,
    };
  }

  // fallow-ignore-next-line complexity
  private applyQuality(state: BimQualityState): void {
    const post = this.renderer.postproduction;
    const quality = state.effective;
    const ao = this.appearance.ssaoEnabled && quality !== "low";
    const transparent = this.appearance.backgroundTheme === "transparent";

    post.enabled = !transparent;
    if (transparent) {
      this.configureFxaa(false);
      this.applyPixelRatio(quality);
      this.onQualityChanged?.({
        ...state,
        reason: "Post-processing paused for transparent output",
      });
      this.renderer.needsUpdate = true;
      this.renderer.update();
      return;
    }

    post.style = styleFor(ao, this.appearance.edgeMode);
    post.edgesPass.mode =
      this.appearance.edgeMode === "engineering"
        ? OBF.EdgeDetectionPassMode.DEFAULT
        : OBF.EdgeDetectionPassMode.GLOBAL;
    post.edgesPass.width = this.appearance.edgeMode === "engineering" ? 1.35 : 0.8;
    post.edgesPass.color.set(
      this.appearance.backgroundTheme === "professional_light" ||
        this.appearance.backgroundTheme === "white"
        ? BIM_PALETTE.ui.disabled
        : BIM_PALETTE.ui.border,
    );
    post.edgesPass.xray = this.appearance.edgeMode === "engineering";
    post.smaaEnabled = quality === "high" || quality === "ultra";

    if (ao) {
      const samples = quality === "ultra" ? 24 : quality === "high" ? 16 : 8;
      post.aoPass.updateGtaoMaterial({
        ...post.defaultAoParameters,
        radius: quality === "medium" ? 0.2 : 0.25,
        thickness: quality === "ultra" ? 12 : 9,
        samples,
      });
    }

    this.configureFxaa(quality === "medium");
    this.renderer.manualDefaultStyle = post.style;
    this.applyPixelRatio(quality);
    this.onQualityChanged?.(state);
    this.renderer.needsUpdate = true;
    this.renderer.update();
  }

  private configureFxaa(enabled: boolean): void {
    if (this.fxaaPass) {
      this.renderer.postproduction.composer?.removePass(this.fxaaPass);
    }
    if (!enabled) return;
    if (!this.fxaaPass) this.fxaaPass = new ShaderPass(FXAAShader);
    const composer = this.renderer.postproduction.composer;
    if (!composer) return;
    composer.insertPass(this.fxaaPass, Math.max(0, composer.passes.length - 1));
    this.updateFxaaResolution();
  }

  private scheduleFxaaRestore(): void {
    if (this.adaptive.current.effective !== "medium") return;
    if (this.fxaaRestoreTimer != null) window.clearTimeout(this.fxaaRestoreTimer);
    this.fxaaRestoreTimer = window.setTimeout(() => {
      this.fxaaRestoreTimer = null;
      this.configureFxaa(true);
      if (this.renderer.postproduction.enabled) this.renderer.postproduction.update();
    }, this.renderer.manualModeDelay + 20);
  }

  private updateFxaaResolution(): void {
    if (!this.fxaaPass) return;
    const canvas = this.renderer.three.domElement;
    const resolution = this.fxaaPass.material.uniforms.resolution?.value as
      | THREE.Vector2
      | undefined;
    resolution?.set(1 / Math.max(1, canvas.width), 1 / Math.max(1, canvas.height));
  }

  private applyPixelRatio(quality: BimQualityState["effective"]): void {
    const ratio = bimQualityPixelRatio(quality, window.devicePixelRatio || 1);
    const canvas = this.renderer.three.domElement;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    this.renderer.three.setPixelRatio(ratio);
    this.renderer.postproduction.composer?.setPixelRatio(ratio);
    this.renderer.postproduction.setSize(width, height);
  }

  private readonly onBeforeRender = (): void => {
    this.frameStartedAt = performance.now();
  };

  private readonly onAfterRender = (): void => {
    this.scheduleFxaaRestore();
    if (!this.interacting || this.frameStartedAt <= 0) return;
    const changed = this.adaptive.observeInteractionFrame(performance.now() - this.frameStartedAt);
    if (changed) this.applyQuality(changed);
  };
}
