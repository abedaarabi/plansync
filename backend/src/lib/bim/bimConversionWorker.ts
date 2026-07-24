import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });
config({ path: resolve(__dirname, "../../../../.env.prod") });
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../../../../.env.local"), override: true });

import { loadEnv } from "../env.js";
import { processBimConversion } from "./runBimConversion.js";

const payload = workerData as { fileVersionId: string; jobRunId?: string };

try {
  await processBimConversion(loadEnv(), payload.fileVersionId, payload.jobRunId);
  parentPort?.postMessage({ ok: true as const });
} catch (err) {
  parentPort?.postMessage({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  });
}
