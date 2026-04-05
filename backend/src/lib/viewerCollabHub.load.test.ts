import { afterEach, describe, expect, it } from "vitest";
import {
  broadcastViewerState,
  registerSseConnection,
  unregisterSseConnection,
} from "./viewerCollabHub.js";

function mockController() {
  const controller = {
    enqueue: (_u: Uint8Array) => {
      /* no-op */
    },
    close: () => {
      /* no-op */
    },
    error: () => {
      /* no-op */
    },
  };
  return controller as unknown as ReadableStreamDefaultController<Uint8Array>;
}

/** Manual / CI sanity check: fan-out stays fast with many SSE subscribers in one room. */
describe("viewerCollabHub load-ish fan-out", () => {
  const fv = `load-test-room-${Math.random().toString(36).slice(2)}`;
  const ids: string[] = [];

  afterEach(() => {
    while (ids.length > 0) {
      const id = ids.pop();
      if (id) unregisterSseConnection(fv, id);
    }
  });

  it("broadcasts viewer_state to many subscribers within a reasonable time", () => {
    const n = 250;
    for (let i = 0; i < n; i++) {
      ids.push(registerSseConnection(fv, `user-${i}`, mockController(), false));
    }
    const t0 = performance.now();
    broadcastViewerState(fv, 99, "actor");
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(800);
  });
});
