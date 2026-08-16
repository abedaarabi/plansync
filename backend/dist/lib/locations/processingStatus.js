/** Map legacy BIM conversion string status to unified ProcessingStatus for UI badges. */
export function mapBimStatusToProcessingStatus(bimConversionStatus) {
    switch (bimConversionStatus) {
        case "pending":
        case "queued":
            return "PENDING";
        case "running":
        case "summary_ready":
            return "PROCESSING";
        case "ready":
            return "READY";
        case "failed":
            return "FAILED";
        default:
            return "PENDING";
    }
}
export function resolveFileVersionProcessingStatus(fv) {
    // IFC readiness is the BIM conversion pipeline — ignore stale assetProcessingStatus.
    if (fv.buildingAssetType === "IFC") {
        return mapBimStatusToProcessingStatus(fv.bimConversionStatus);
    }
    const asset = fv.assetProcessingStatus;
    if (asset === "READY" || asset === "FAILED" || asset === "PROCESSING") {
        return asset;
    }
    // PDFs use the asset processor; PENDING/null means not finished yet.
    if (fv.buildingAssetType === "PDF") {
        return asset ?? "PENDING";
    }
    if (fv.bimConversionStatus !== "pending") {
        return mapBimStatusToProcessingStatus(fv.bimConversionStatus);
    }
    return asset ?? "PENDING";
}
