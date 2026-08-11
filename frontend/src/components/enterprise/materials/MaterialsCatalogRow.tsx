"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { MaterialRow, MaterialTemplateField } from "@/lib/api-client";
import { formatCustomCell, formatMaterialMoney } from "./materialsUtils";

type Props = {
  material: MaterialRow;
  sortedTplFields: MaterialTemplateField[];
  onEdit: (m: MaterialRow) => void;
  onDelete: (m: MaterialRow) => void;
};

export function MaterialsCatalogRow({ material: m, sortedTplFields, onEdit, onDelete }: Props) {
  return (
    <tr className="border-b border-[var(--enterprise-border)]/60 transition-colors hover:bg-[var(--enterprise-hover-surface)]">
      <td className="px-3 py-2.5 align-middle">
        <span className="enterprise-badge-info inline-flex max-w-full truncate rounded px-2 py-0.5 text-xs font-semibold">
          {m.category.name}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="min-w-0 truncate font-medium text-[var(--enterprise-text)]">{m.name}</div>
          <button
            type="button"
            aria-label="Copy material name"
            title="Copy material name"
            onClick={() => {
              void navigator.clipboard
                .writeText(m.name)
                .then(() => toast.success("Material name copied"))
                .catch(() => toast.error("Could not copy material name"));
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)]"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {m.specification ? (
          <div className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">
            {m.specification}
          </div>
        ) : null}
      </td>
      <td className="truncate px-3 py-2.5 align-middle text-[var(--enterprise-text-muted)]">
        {m.sku || "—"}
      </td>
      <td className="truncate px-3 py-2.5 align-middle text-[var(--enterprise-text)]">{m.unit}</td>
      <td className="truncate px-3 py-2.5 align-middle tabular-nums font-medium text-[var(--enterprise-text)]">
        {formatMaterialMoney(m.unitPrice, m.currency)}
      </td>
      <td className="truncate px-3 py-2.5 align-middle text-[var(--enterprise-text-muted)]">
        {m.supplier || "—"}
      </td>
      {sortedTplFields.map((f) => {
        const cell = formatCustomCell(m, f);
        const numeric = f.type === "number" || f.type === "currency";
        return (
          <td
            key={f.id}
            className={`max-w-40 truncate bg-[var(--enterprise-primary-soft)]/[0.1] px-3 py-2.5 align-middle text-[var(--enterprise-text)] ${
              numeric ? "text-right tabular-nums" : ""
            }`}
            title={cell}
          >
            {cell}
          </td>
        );
      })}
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
        <button
          type="button"
          onClick={() => onEdit(m)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-primary)]"
          aria-label={`Edit ${m.name}`}
        >
          <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(m)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-error)]"
          aria-label={`Delete ${m.name}`}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </td>
    </tr>
  );
}
