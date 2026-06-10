"use client";

import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import {
  MaterialTemplateEditorBody,
  MaterialTemplateEditorFooter,
  MaterialTemplateEditorHeader,
} from "./materialTemplateEditorParts";
import { useMaterialTemplateEditor } from "./useMaterialTemplateEditor";

export function MaterialTemplateEditor({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const editor = useMaterialTemplateEditor(workspaceId, open, onClose);

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="material-template-title"
      panelMaxWidthClass="max-w-2xl"
      bodyClassName="px-5 py-6"
      header={<MaterialTemplateEditorHeader />}
      footer={
        <MaterialTemplateEditorFooter
          onClose={onClose}
          saveMutation={editor.saveMutation}
          isPending={editor.isPending}
        />
      }
    >
      <div className="space-y-6">
        <MaterialTemplateEditorBody
          showLoading={editor.showLoading}
          draft={editor.draft}
          onAddField={editor.addField}
          onMove={editor.moveField}
          onRemove={editor.removeField}
          onChange={editor.updateField}
        />
      </div>
    </EnterpriseSlideOver>
  );
}
