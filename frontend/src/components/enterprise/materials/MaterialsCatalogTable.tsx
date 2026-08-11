"use client";

import type { MaterialRow, MaterialTemplateField, MaterialsPagedResponse } from "@/lib/api-client";
import { MaterialsCatalogEmpty } from "./MaterialsCatalogEmpty";
import { MaterialsCatalogPagination } from "./MaterialsCatalogPagination";
import { MaterialsCatalogRow } from "./MaterialsCatalogRow";
import { MaterialsCatalogToolbar } from "./MaterialsCatalogToolbar";

type TypeOption = { id: string; name: string };

type Props = {
  materials: MaterialRow[];
  paged: MaterialsPagedResponse | undefined;
  sortedTplFields: MaterialTemplateField[];
  q: string;
  onQChange: (value: string) => void;
  debouncedQ: string;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  types: TypeOption[];
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onEdit: (m: MaterialRow) => void;
  onDelete: (m: MaterialRow) => void;
  onAdd: () => void;
  onDownloadTemplate: () => void;
  onPickImport: () => void;
};

export function MaterialsCatalogTable({
  materials,
  paged,
  sortedTplFields,
  q,
  onQChange,
  debouncedQ,
  typeFilter,
  onTypeFilterChange,
  types,
  isFetching,
  onPageChange,
  onEdit,
  onDelete,
  onAdd,
  onDownloadTemplate,
  onPickImport,
}: Props) {
  const hasFilters = Boolean(debouncedQ) || typeFilter !== "all";
  const colSpan = 7 + sortedTplFields.length;

  return (
    <section className="enterprise-card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <MaterialsCatalogToolbar
        q={q}
        onQChange={onQChange}
        typeFilter={typeFilter}
        onTypeFilterChange={onTypeFilterChange}
        types={types}
        isFetching={isFetching}
        showCustomSearchNote={sortedTplFields.length > 0}
      />

      <div className="mobile-table-wrap min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
              <th className="enterprise-type-label whitespace-nowrap px-3 py-2.5 font-semibold">
                Type
              </th>
              <th className="enterprise-type-label min-w-[8rem] px-3 py-2.5 font-semibold">
                Material
              </th>
              <th className="enterprise-type-label px-3 py-2.5 font-semibold">SKU</th>
              <th className="enterprise-type-label px-3 py-2.5 font-semibold">Unit</th>
              <th className="enterprise-type-label px-3 py-2.5 font-semibold">Price</th>
              <th className="enterprise-type-label min-w-[6rem] px-3 py-2.5 font-semibold">
                Supplier
              </th>
              {sortedTplFields.map((f) => {
                const numeric = f.type === "number" || f.type === "currency";
                return (
                  <th
                    key={f.id}
                    className={`enterprise-type-label max-w-40 truncate bg-[var(--enterprise-primary-soft)]/25 px-3 py-2.5 font-semibold text-[var(--enterprise-text)] ${
                      numeric ? "text-right" : ""
                    }`}
                    title={f.label}
                  >
                    {f.label}
                  </th>
                );
              })}
              <th className="enterprise-type-label w-28 whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {materials.length === 0 ? (
              <MaterialsCatalogEmpty
                hasFilters={hasFilters}
                colSpan={colSpan}
                onAdd={onAdd}
                onDownloadTemplate={onDownloadTemplate}
                onPickImport={onPickImport}
              />
            ) : (
              materials.map((m) => (
                <MaterialsCatalogRow
                  key={m.id}
                  material={m}
                  sortedTplFields={sortedTplFields}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <MaterialsCatalogPagination paged={paged} onPageChange={onPageChange} />
    </section>
  );
}
