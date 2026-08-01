import type { ComponentType, SVGProps } from "react";
import { FileIcon, FileText, Image as ImageIcon } from "lucide-react";
import { IfcFileIcon } from "@/components/icons/IfcFileIcon";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import type { BuildingAssetType } from "@/lib/api-client/locations";

export type FileKind = "ifc" | "pdf" | "image" | "other";

export type FileKindIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function kindFromName(name: string): FileKind {
  const n = name.toLowerCase();
  if (n.endsWith(".ifc") || n.endsWith(".ifczip")) return "ifc";
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n)) return "image";
  return "other";
}

export function assetTypeFromKind(kind: FileKind): BuildingAssetType {
  if (kind === "ifc") return "IFC";
  if (kind === "pdf") return "PDF";
  return "OTHER";
}

export function iconForKind(kind: FileKind): FileKindIcon {
  if (kind === "ifc") return IfcFileIcon;
  if (kind === "pdf") return PdfFileIcon;
  if (kind === "image") return ImageIcon;
  return FileIcon;
}

/** Lucide fallbacks use enterprise blue; branded badges keep their tile colors. */
export function iconClassForKind(kind: FileKind, size = "h-6 w-6"): string {
  const base = `${size} shrink-0`;
  if (kind === "ifc" || kind === "pdf") return base;
  return `${base} text-[var(--enterprise-primary)]`;
}

export function kindLabel(kind: FileKind): string {
  if (kind === "ifc") return "IFC model";
  if (kind === "pdf") return "PDF drawing";
  if (kind === "image") return "Image";
  return "File";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Rough client-side ceiling before the server rejects the upload. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
