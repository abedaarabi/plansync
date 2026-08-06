type OmAssetSearchable = {
  tag: string;
  name: string;
  category?: string | null;
  locationLabel?: string | null;
  manufacturer?: string | null;
  model?: string | null;
};

export function filterOmAssetsBySearch<T extends OmAssetSearchable>(
  assets: T[],
  search: string,
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return assets;
  return assets.filter((a) => {
    const hay = [a.tag, a.name, a.category, a.locationLabel, a.manufacturer, a.model]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
