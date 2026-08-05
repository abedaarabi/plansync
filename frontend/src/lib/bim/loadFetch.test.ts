import { afterEach, describe, expect, it, vi } from "vitest";
import { BimLoadAbortedError, BimLoadStallError, pollUntil, withTimeout } from "./loadFetch";

afterEach(() => {
  vi.useRealTimers();
});

describe("pollUntil", () => {
  it("returns when predicate becomes true", async () => {
    let n = 0;
    const value = await pollUntil(
      async () => {
        n += 1;
        return n;
      },
      (v) => v >= 2,
      { intervalMs: 5, timeoutMs: 500 },
    );
    expect(value).toBe(2);
  });

  it("returns last value on timeout by default", async () => {
    const value = await pollUntil(
      async () => "pending",
      () => false,
      {
        intervalMs: 5,
        timeoutMs: 20,
      },
    );
    expect(value).toBe("pending");
  });

  it("throws BimLoadStallError when throwOnTimeout is set", async () => {
    await expect(
      pollUntil(
        async () => "pending",
        () => false,
        {
          intervalMs: 5,
          timeoutMs: 20,
          throwOnTimeout: true,
          timeoutMessage: "Still processing",
        },
      ),
    ).rejects.toMatchObject({
      name: "BimLoadStallError",
      message: "Still processing",
    });
  });
});

describe("withTimeout", () => {
  it("resolves when the promise finishes in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 200)).resolves.toBe(42);
  });

  it("rejects with BimLoadStallError when the promise hangs", async () => {
    vi.useFakeTimers();
    const hang = new Promise<number>(() => undefined);
    const pending = withTimeout(hang, 50, { message: "Timed out loading" });
    const expectation = expect(pending).rejects.toBeInstanceOf(BimLoadStallError);
    await vi.advanceTimersByTimeAsync(60);
    await expectation;
  });

  it("rejects with BimLoadAbortedError when signal aborts", async () => {
    const controller = new AbortController();
    const hang = new Promise<number>(() => undefined);
    const pending = withTimeout(hang, 5_000, { signal: controller.signal });
    const expectation = expect(pending).rejects.toBeInstanceOf(BimLoadAbortedError);
    controller.abort();
    await expectation;
  });
});
