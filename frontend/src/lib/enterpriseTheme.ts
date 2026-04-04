import type { CSSProperties } from "react";

export const DEFAULT_ENTERPRISE_PRIMARY_HEX = "#2563EB";

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const ch = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Valid 6-digit #hex or default. */
export function normalizeWorkspacePrimaryHex(input: string | null | undefined): string {
  const t = (input ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  return DEFAULT_ENTERPRISE_PRIMARY_HEX;
}

/** True if string matches API/workspace primary color format. */
export function isValidWorkspacePrimaryHex(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s.trim());
}

/**
 * CSS custom properties for the enterprise shell, derived from workspace primaryColor.
 * Sets --enterprise-primary, -deep, -soft, -glow, -accent-line, and focus ring tone.
 */
export function workspaceEnterpriseCssVars(primaryHex: string | null | undefined): CSSProperties {
  const hex = normalizeWorkspacePrimaryHex(primaryHex);
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return workspaceEnterpriseCssVars(DEFAULT_ENTERPRISE_PRIMARY_HEX);
  }
  const black: Rgb = { r: 0, g: 0, b: 0 };
  const deep = mixRgb(rgb, black, 0.2);
  const accent = mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.12);
  const soft = `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`;
  const glow = `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`;
  const ringFocus = `0 0 0 2px var(--enterprise-surface), 0 0 0 4px ${glow}`;

  return {
    "--enterprise-primary": hex,
    "--enterprise-primary-deep": rgbToHex(deep),
    "--enterprise-primary-soft": soft,
    "--enterprise-primary-glow": glow,
    "--enterprise-accent-line": rgbToHex(accent),
    "--enterprise-ring-focus": ringFocus,
  } as CSSProperties;
}
