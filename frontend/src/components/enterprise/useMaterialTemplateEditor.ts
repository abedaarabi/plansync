"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchMaterialTemplate,
  patchMaterialTemplate,
  type MaterialCustomFieldType,
  type MaterialTemplate,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { slugifyMaterialFieldKey } from "@plansync/shared/materialFieldKey";
import { MAX_CUSTOM_MATERIAL_FIELDS, type DraftField } from "./materialTemplateEditorParts";

function sortDraftFields(fields: DraftField[]): DraftField[] {
  return [...fields].sort(
    (a, b) =>
      a.order - b.order || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

function moveDraftField(rows: DraftField[], index: number, dir: -1 | 1): DraftField[] {
  const next = index + dir;
  if (next < 0 || next >= rows.length) return rows;
  const copy = [...rows];
  const [moved] = copy.splice(index, 1);
  if (moved) copy.splice(next, 0, moved);
  return copy;
}

export function useMaterialTemplateEditor(workspaceId: string, open: boolean, onClose: () => void) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: qk.materialTemplate(workspaceId),
    queryFn: () => fetchMaterialTemplate(workspaceId),
    enabled: open && Boolean(workspaceId),
  });

  const [draft, setDraft] = useState<DraftField[]>([]);

  useEffect(() => {
    if (!open || !data) return;
    setDraft(sortDraftFields(data.fields));
  }, [open, data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fields = draft.map((f, i) => ({ ...f, order: i }));
      const template: MaterialTemplate = {
        version: data?.version ?? 1,
        fields,
      };
      return patchMaterialTemplate(workspaceId, template);
    },
    onSuccess: () => {
      toast.success("Catalog fields saved");
      void queryClient.invalidateQueries({ queryKey: qk.materialTemplate(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: qk.materials(workspaceId) });
      void queryClient.invalidateQueries({
        queryKey: ["materialsPaged", workspaceId],
        exact: false,
      });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateField = useCallback((index: number, patch: Partial<DraftField>) => {
    setDraft((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  const addField = useCallback(() => {
    setDraft((current) => {
      if (current.length >= MAX_CUSTOM_MATERIAL_FIELDS) {
        toast.message(`Maximum ${MAX_CUSTOM_MATERIAL_FIELDS} custom fields`);
        return current;
      }
      const label = `New field ${current.length + 1}`;
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          key: slugifyMaterialFieldKey(label),
          label,
          type: "text" as MaterialCustomFieldType,
          required: false,
          order: current.length,
        },
      ];
    });
  }, []);

  const moveField = useCallback((index: number, dir: -1 | 1) => {
    setDraft((rows) => moveDraftField(rows, index, dir));
  }, []);

  const removeField = useCallback((index: number) => {
    setDraft((rows) => {
      const f = rows[index];
      if (
        !f ||
        !confirm(
          `Remove “${f.label}”? Existing materials may still store values for key “${f.key}”; they stay in the database but won’t show until you add a field with the same key again.`,
        )
      ) {
        return rows;
      }
      return rows.filter((_, i) => i !== index);
    });
  }, []);

  return {
    draft,
    isPending,
    showLoading: open && isPending && !data,
    saveMutation,
    updateField,
    addField,
    moveField,
    removeField,
  };
}
