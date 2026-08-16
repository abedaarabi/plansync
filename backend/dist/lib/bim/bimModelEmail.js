import { buildTransactionalEmailHtml, escapeHtml } from "../transactionalEmailLayout.js";
export function buildBimModelReadyEmailHtml(env, input) {
    if (input.failed) {
        return buildTransactionalEmailHtml(env, {
            eyebrow: "BIM model",
            title: `Processing failed — ${input.fileName}`,
            bodyLines: [
                `Project: ${input.projectName}`,
                input.errorMessage ?? "The conversion job did not complete successfully.",
                "You can retry from the project files page without re-uploading the IFC.",
            ],
            primaryAction: input.publishUrl
                ? { url: input.publishUrl, label: "Open project files" }
                : { url: input.viewerUrl, label: "Open project" },
            fallbackUrl: input.publishUrl ?? input.viewerUrl,
        });
    }
    const lines = [
        `Project: ${input.projectName}`,
        `Version: ${input.versionNumber}`,
        `${input.elementCount.toLocaleString()} elements indexed`,
    ];
    if (input.loqLine)
        lines.push(input.loqLine);
    return buildTransactionalEmailHtml(env, {
        eyebrow: "BIM model",
        title: `${input.fileName} is ready`,
        bodyLines: lines,
        primaryAction: { url: input.viewerUrl, label: "Open in BIM viewer" },
        fallbackUrl: input.viewerUrl,
        extraHtml: input.publishUrl
            ? `<p style="margin:16px 0 0;font-size:14px;color:#64748b"><a href="${escapeHtml(input.publishUrl)}" style="color:#2563eb">Continue publish setup</a></p>`
            : undefined,
    });
}
export function buildBimModelReadyEmailText(input) {
    if (input.failed) {
        return `Model processing failed — ${input.fileName}

Project: ${input.projectName}
${input.errorMessage ?? "Conversion failed."}

${input.publishUrl ?? input.viewerUrl}
`;
    }
    return `${input.fileName} is ready on PlanSync

Project: ${input.projectName}
Version: ${input.versionNumber}
Elements: ${input.elementCount}
${input.loqLine ?? ""}

Open in BIM viewer:
${input.viewerUrl}
`;
}
export function buildBimViewerUrl(env, params) {
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const q = new URLSearchParams({
        projectId: params.projectId,
        fileId: params.fileId,
        fileVersionId: params.fileVersionId,
        name: params.fileName,
    });
    return `${base}/bim-viewer?${q.toString()}`;
}
export function buildProjectFilesUrl(env, projectId) {
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    return `${base}/projects/${encodeURIComponent(projectId)}/files`;
}
export function buildPublishWizardPath(projectId, fileVersionId) {
    return `/projects/${encodeURIComponent(projectId)}/files?publishBim=${encodeURIComponent(fileVersionId)}`;
}
