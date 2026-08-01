export function confidenceFromScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score <= 1) return Math.round(Math.max(0, Math.min(1, score)) * 100);
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function disciplineFromFileName(name: string): string[] {
  const n = name.toLowerCase().replace(/\.ifc(zip)?$/i, "");
  const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
  const has = (...keys: string[]) => keys.some((k) => tokens.includes(k) || n.includes(k));
  const out: string[] = [];
  if (has("arch", "architectural", "architecture") || /(?:^|[_\-.])a(?:[_\-.]|$)/.test(n)) {
    out.push("Architecture");
  }
  if (has("struct", "structural", "steel", "concrete") || /(?:^|[_\-.])s(?:[_\-.]|$)/.test(n)) {
    out.push("Structure");
  }
  if (has("hvac", "mech", "mechanical", "mep") || /(?:^|[_\-.])m(?:[_\-.]|$)/.test(n)) {
    out.push("HVAC");
  }
  if (has("plumb", "plumbing", "sanitary") || /(?:^|[_\-.])p(?:[_\-.]|$)/.test(n)) {
    out.push("Plumbing");
  }
  if (has("elec", "electrical", "power") || /(?:^|[_\-.])e(?:[_\-.]|$)/.test(n)) {
    out.push("Electrical");
  }
  if (has("fire", "sprinkler")) out.push("Fire Protection");
  return [...new Set(out)];
}

export function estimateGpuMb(fileSizeBytes: number, elementEstimate: number | null): number {
  const fromSize = (fileSizeBytes / (1024 * 1024)) * 2.4;
  const fromElements = elementEstimate != null ? elementEstimate * 0.0028 : 0;
  return Math.max(24, Math.round(Math.max(fromSize, fromElements)));
}
