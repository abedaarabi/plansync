import type { FileVersion, Workspace } from "@prisma/client";
import type { Env } from "./env.js";
import { workspaceLogoUrlForClients } from "./workspaceLogo.js";

/** JSON-safe workspace row; `logoUrl` is a browser-loadable URL (hosted or external). Omits `logoS3Key`. */
export function workspaceJson(ws: Workspace, env?: Env) {
  const { logoS3Key, logoUrl: _rawLogo, storageUsedBytes, storageQuotaBytes, ...rest } = ws;
  const logoUrl =
    env != null
      ? workspaceLogoUrlForClients(env, { id: ws.id, logoS3Key, logoUrl: ws.logoUrl })
      : ws.logoUrl;
  return {
    ...rest,
    logoUrl,
    storageUsedBytes: storageUsedBytes.toString(),
    storageQuotaBytes: storageQuotaBytes.toString(),
  };
}

export function fileVersionJson(
  fv: FileVersion | Omit<FileVersion, "annotationBlob" | "sheetAiCache">,
) {
  return {
    ...fv,
    sizeBytes: fv.sizeBytes.toString(),
  };
}

function localBudgetToJson(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && v !== null && "toString" in v) {
    return (v as { toString: () => string }).toString();
  }
  return null;
}

/** Project list includes `files.versions` with BigInt `sizeBytes` — JSON-safe. */
export function projectTreeJson(
  project: {
    folders: unknown[];
    files: Array<
      {
        versions: (FileVersion | Omit<FileVersion, "annotationBlob" | "sheetAiCache">)[];
      } & Record<string, unknown>
    >;
    localBudget?: unknown;
  } & Record<string, unknown>,
) {
  const { localBudget, ...rest } = project;
  return {
    ...rest,
    localBudget: localBudgetToJson(localBudget),
    files: project.files.map((f) => ({
      ...f,
      versions: f.versions.map(fileVersionJson),
    })),
  };
}

/** Single project row from Prisma — JSON-safe `localBudget`. */
export function projectRowJson<T extends { localBudget?: unknown } & Record<string, unknown>>(
  row: T,
) {
  const { localBudget, ...rest } = row;
  return {
    ...rest,
    localBudget: localBudgetToJson(localBudget),
  };
}
