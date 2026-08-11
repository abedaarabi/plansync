"use client";

import { Download, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";

type Props = {
  hasFilters: boolean;
  colSpan: number;
  onAdd: () => void;
  onDownloadTemplate: () => void;
  onPickImport: () => void;
};

export function MaterialsCatalogEmpty({
  hasFilters,
  colSpan,
  onAdd,
  onDownloadTemplate,
  onPickImport,
}: Props) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
            <FileSpreadsheet className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="mt-3 text-base font-semibold text-[var(--enterprise-text)]">
            {hasFilters ? "No matching materials" : "No materials yet"}
          </p>
          <p className="enterprise-type-subtitle mt-1">
            {hasFilters
              ? "Try a different search term or clear filters."
              : "Add a row manually, or download the Excel template and import your catalog."}
          </p>
          {!hasFilters ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <EnterpriseButton size="sm" variant="secondary" onClick={onDownloadTemplate}>
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Template
              </EnterpriseButton>
              <EnterpriseButton size="sm" variant="secondary" onClick={onPickImport}>
                <Upload className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Import
              </EnterpriseButton>
              <EnterpriseButton size="sm" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Add material
              </EnterpriseButton>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
