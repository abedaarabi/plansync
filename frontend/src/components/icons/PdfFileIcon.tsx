import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/**
 * PDF document badge (red tile + “PDF”). Matches `public/icons/pdf.svg`.
 */
export function PdfFileIcon({ className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...rest}
    >
      <rect width="24" height="24" rx="4" fill="#E53935" />
      <path fill="#fff" fillOpacity={0.22} d="M14 2v6h6L14 2z" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#fff"
        style={{
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 7,
          fontWeight: 700,
        }}
      >
        PDF
      </text>
    </svg>
  );
}
