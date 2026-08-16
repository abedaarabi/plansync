"use client";

import { userInitials } from "@/lib/user-initials";

type Props = {
  name: string;
  email?: string | null;
  image?: string | null;
  /** Tailwind size + text size, e.g. "h-7 w-7 text-[10px]" */
  className?: string;
  /** `circle` for pills / presence dots; default matches sheet rows. */
  shape?: "rounded" | "circle";
};

/** Small avatar or initials for the PDF viewer (matches sheet / issue UI). */
export function ViewerUserThumb({
  name,
  email,
  image,
  className = "h-7 w-7 text-[10px]",
  shape = "rounded",
}: Props) {
  const photo = image?.trim() || null;
  const initials = userInitials(name, email);
  const radius = shape === "circle" ? "rounded-full" : "rounded-md";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${radius} border border-slate-200 bg-white font-semibold tabular-nums text-slate-500 ${className}`}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- OAuth / profile URL from auth
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
