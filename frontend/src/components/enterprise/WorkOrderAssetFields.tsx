"use client";

import Link from "next/link";
import { Package, Search } from "lucide-react";
import type { OmAssetRow } from "@/lib/api-client";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
} from "@/lib/mobileFormStyles";

export function formatOmAssetLocation(a: OmAssetRow): string {
  const parts = [a.hall, a.rowLabel, a.rack, a.positionU].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  if (parts.length > 0) return parts.join(" / ");
  return a.locationLabel?.trim() || "";
}

type Props = {
  idPrefix: string;
  assets: OmAssetRow[];
  assetsPending: boolean;
  filteredAssets: OmAssetRow[];
  assetId: string;
  assetSearch: string;
  onAssetSearchChange: (value: string) => void;
  onAssetIdChange: (value: string) => void;
  assetsHref: string;
};

export function WorkOrderAssetFields({
  idPrefix,
  assets,
  assetsPending,
  filteredAssets,
  assetId,
  assetSearch,
  onAssetSearchChange,
  onAssetIdChange,
  assetsHref,
}: Props) {
  const searchId = `${idPrefix}-asset-search`;
  const selectId = `${idPrefix}-asset`;

  return (
    <>
      <div>
        <label htmlFor={searchId} className={MOBILE_FIELD_LABEL}>
          Search assets
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
            aria-hidden
          />
          <input
            id={searchId}
            value={assetSearch}
            onChange={(e) => onAssetSearchChange(e.target.value)}
            className={`${MOBILE_FIELD_INPUT} enterprise-field-input--icon`}
            placeholder="Tag, name, location…"
            autoComplete="off"
          />
        </div>
      </div>
      <div>
        <label htmlFor={selectId} className={MOBILE_FIELD_LABEL}>
          Asset (optional)
        </label>
        {assetsPending ? (
          <p className="text-sm text-[var(--enterprise-text-muted)]">Loading assets…</p>
        ) : filteredAssets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--enterprise-border)] px-3 py-4 text-center">
            <Package
              className="mx-auto h-8 w-8 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
              {assets.length === 0
                ? "No assets on this project yet."
                : "No assets match your search."}
            </p>
            {assets.length === 0 ? (
              <Link
                href={assetsHref}
                className="mt-2 inline-block text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                Add assets in O&amp;M
              </Link>
            ) : null}
          </div>
        ) : (
          <select
            id={selectId}
            value={assetId}
            onChange={(e) => onAssetIdChange(e.target.value)}
            className={MOBILE_FIELD_SELECT}
          >
            <option value="">No equipment linked</option>
            {filteredAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tag} — {a.name}
                {a.category ? ` (${a.category})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>
    </>
  );
}
