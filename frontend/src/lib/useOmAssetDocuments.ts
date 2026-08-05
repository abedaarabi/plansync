"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteOmAssetDocument,
  fetchOmAssetDocuments,
  uploadOmAssetDocumentFile,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

const MAX_ASSET_DOC_BYTES = 25 * 1024 * 1024;

export function useOmAssetDocuments(opts: {
  projectId: string;
  assetId: string;
  enabled?: boolean;
}) {
  const { projectId, assetId, enabled = true } = opts;
  const qc = useQueryClient();
  const [uploadBusy, setUploadBusy] = useState(false);

  const { data: documents = [], isPending } = useQuery({
    queryKey: qk.omAssetDocuments(projectId, assetId),
    queryFn: () => fetchOmAssetDocuments(projectId, assetId),
    enabled: enabled && Boolean(projectId && assetId),
  });

  const deleteMut = useMutation({
    mutationFn: (docId: string) => deleteOmAssetDocument(projectId, assetId, docId),
    onSuccess: async (_, docId) => {
      await qc.invalidateQueries({ queryKey: qk.omAssetDocuments(projectId, assetId) });
      qc.removeQueries({ queryKey: qk.omAssetDocumentReadUrl(projectId, assetId, docId) });
      toast.success("Document removed.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro required." : e.message);
    },
  });

  async function uploadDocument(file: File, opts?: { label?: string }) {
    if (file.size > MAX_ASSET_DOC_BYTES) {
      toast.error("File too large (max 25 MB).");
      return false;
    }
    setUploadBusy(true);
    try {
      await uploadOmAssetDocumentFile(projectId, assetId, file, opts);
      await qc.invalidateQueries({ queryKey: qk.omAssetDocuments(projectId, assetId) });
      toast.success("Document uploaded.");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
      return false;
    } finally {
      setUploadBusy(false);
    }
  }

  return { documents, isPending, uploadBusy, deleteMut, uploadDocument };
}
