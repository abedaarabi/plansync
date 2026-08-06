/**
 * Clean HTML pasted from Word / Google Docs / Outlook into TipTap.
 * Strips Office namespaces, conditional comments, and junk wrappers while
 * keeping semantic structure TipTap can parse.
 */
export function cleanPastedCoverHtml(html: string): string {
  let out = html;

  // Office conditional comments and XML leftovers
  out = out.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "");
  out = out.replace(/<\/?(?:xml|o:|v:|w:)[^>]*>/gi, "");
  out = out.replace(/<\/?([a-z0-9]+):[^>]*>/gi, "");

  // Empty spans / fonts that Word wraps around every run
  out = out.replace(/<\/?(?:font|meta|link|style|script|title)[^>]*>/gi, "");
  out = out.replace(/<span[^>]*>\s*<\/span>/gi, "");

  // Drop class/id noise from Word; keep style for text-align / color when useful
  out = out.replace(/\s(?:class|id|lang|dir|face|size)="[^"]*"/gi, "");
  out = out.replace(/\s(?:class|id|lang|dir|face|size)='[^']*'/gi, "");

  // Mso-* styles
  out = out.replace(/mso-[a-z-]+\s*:[^;"']+;?/gi, "");
  out = out.replace(/style="\s*"/gi, "");
  out = out.replace(/style='\s*'/gi, "");

  // Word's &nbsp;-only paragraphs → real breaks later; collapse excessive nbsp
  out = out.replace(/(&nbsp;){2,}/gi, " ");

  // Prefer semantic tags TipTap understands
  out = out.replace(/<\/?b\b/gi, (m) => m.replace(/b/i, "strong"));
  out = out.replace(/<\/?i\b/gi, (m) => m.replace(/i/i, "em"));

  return out.trim();
}

export function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt?.files?.length) return [];
  return Array.from(dt.files).filter((f) => f.type.startsWith("image/"));
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}
