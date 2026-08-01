import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });
config({ path: resolve(__dirname, "../../../../.env.prod") });
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../../../../.env.local"), override: true });

import { loadEnv } from "../env.js";
import { processBimConversion } from "./runBimConversion.js";

const fileVersionId = process.argv[2];
const jobRunId = process.argv[3];

if (!fileVersionId) {
  console.error("[bim.convert] missing fileVersionId");
  process.exit(1);
}

try {
  await processBimConversion(loadEnv(), fileVersionId, jobRunId);
} catch (err) {
  console.error("[bim.convert] failed", fileVersionId, err instanceof Error ? err.message : err);
  process.exit(1);
}
