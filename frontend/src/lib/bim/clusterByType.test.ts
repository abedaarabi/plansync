import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  computeClusterCameraPose,
  computeTightClusterOffsets,
  formatClusterTypeTitle,
  shouldClusterType,
  type ClusterCategoryPack,
  type ClusterPackUnit,
} from "./clusterByType";

function unit(
  modelId: string,
  transformLocalId: number,
  min: [number, number, number],
  max: [number, number, number],
) {
  return {
    modelId,
    transformLocalId,
    box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)),
  };
}

function mapPlacedUnits<T>(
  packs: ClusterCategoryPack[],
  map: (unit: ClusterPackUnit, delta: THREE.Vector3) => T,
): T[] {
  const { offsets } = computeTightClusterOffsets(packs);
  const out: T[] = [];
  for (const pack of packs) {
    for (const u of pack.units) {
      const delta = offsets.get(u.modelId)?.get(u.transformLocalId);
      if (!delta) continue;
      out.push(map(u, delta));
    }
  }
  return out;
}

function placedCenters(packs: ClusterCategoryPack[]) {
  return mapPlacedUnits(packs, (u, delta) => u.box.getCenter(new THREE.Vector3()).add(delta));
}

/** Axis-aligned boxes after applying the same deltas used for transforms. */
function placedBoxes(packs: ClusterCategoryPack[]) {
  return mapPlacedUnits(packs, (u, delta) => u.box.clone().translate(delta));
}

function expectNoAabbOverlap(boxes: THREE.Box3[]) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(boxes[i]!.intersectsBox(boxes[j]!)).toBe(false);
    }
  }
}

describe("formatClusterTypeTitle", () => {
  it("strips Ifc and spaces camel case", () => {
    expect(formatClusterTypeTitle("IfcWallStandardCase")).toBe("Wall Standard Case");
  });
});

describe("shouldClusterType", () => {
  it("skips spatial containers", () => {
    expect(shouldClusterType("IfcWall")).toBe(true);
    expect(shouldClusterType("IfcSite")).toBe(false);
    expect(shouldClusterType("IfcSpace")).toBe(false);
  });
});

describe("computeTightClusterOffsets", () => {
  it("returns empty result for no categories", () => {
    const result = computeTightClusterOffsets([]);
    expect(result.offsets.size).toBe(0);
    expect(result.labels).toHaveLength(0);
  });

  it("places walls next to each other without overlapping AABBs", () => {
    const packs: ClusterCategoryPack[] = [
      {
        name: "IfcWall",
        units: [
          unit("m", 1, [0, 0, 0], [4, 3, 0.2]),
          unit("m", 2, [20, 0, 0], [24, 3, 0.2]),
          unit("m", 3, [40, 0, 0], [44, 3, 0.2]),
        ],
      },
    ];
    const boxes = placedBoxes(packs);
    expect(boxes).toHaveLength(3);
    expectNoAabbOverlap(boxes);
    const centers = placedCenters(packs);
    const ys = centers.map((c) => c.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.2);
  });

  it("stacks walls on top of each other across layers", () => {
    const units = Array.from({ length: 8 }, (_, i) =>
      unit("m", i + 1, [i * 5, 0, 0], [i * 5 + 2, 3, 0.25]),
    );
    const packs: ClusterCategoryPack[] = [{ name: "IfcWall", units }];
    const centers = placedCenters(packs);
    const ys = centers.map((c) => c.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2.5);
    expectNoAabbOverlap(placedBoxes(packs));
  });

  it("skips IfcSite and still labels real types", () => {
    const packs: ClusterCategoryPack[] = [
      {
        name: "IfcSite",
        units: [unit("m", 99, [0, 0, 0], [100, 1, 100])],
      },
      {
        name: "IfcDoor",
        units: [unit("m", 1, [0, 0, 0], [1, 2, 0.1])],
      },
    ];
    const { labels, offsets } = computeTightClusterOffsets(packs);
    expect(labels.map((l) => l.title)).toEqual(["Door"]);
    expect(offsets.get("m")?.has(1)).toBe(true);
    expect(offsets.get("m")?.has(99)).toBeFalsy();
  });
});

describe("computeClusterCameraPose", () => {
  it("places the eye above and aside the cluster center", () => {
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20));
    const { eye, target, sphere } = computeClusterCameraPose(box);
    expect(eye.y).toBeGreaterThan(target.y);
    expect(eye.distanceTo(target)).toBeGreaterThan(sphere.radius);
  });
});
