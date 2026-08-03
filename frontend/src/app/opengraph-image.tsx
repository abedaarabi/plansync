import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "PlanSync — construction platform for drawings, issues, RFIs, takeoff, BIM, and facilities ops.";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function Image() {
  const screenshot = await readFile(join(process.cwd(), "public/images/3dviewer-og.jpg"));
  const screenshotSrc = `data:image/jpeg;base64,${screenshot.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        background: "#0B1220",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Ambient glows */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-8%",
          width: "55%",
          height: "80%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.22), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-25%",
          right: "-5%",
          width: "50%",
          height: "70%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(14,165,233,0.12), transparent 70%)",
        }}
      />

      {/* Left copy column */}
      <div
        style={{
          width: "48%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 40px 48px 56px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#2563EB",
              display: "flex",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 9,
                left: 9,
                width: 16,
                height: 3.5,
                background: "white",
                borderRadius: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 9,
                left: 9,
                width: 3.5,
                height: 16,
                background: "white",
                borderRadius: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 9,
                right: 9,
                width: 16,
                height: 3.5,
                background: "rgba(255,255,255,0.4)",
                borderRadius: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 9,
                right: 9,
                width: 3.5,
                height: 16,
                background: "rgba(255,255,255,0.4)",
                borderRadius: 1,
              }}
            />
          </div>
          <span
            style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", display: "flex" }}
          >
            <span style={{ color: "#F8FAFC" }}>Plan</span>
            <span style={{ color: "#60A5FA" }}>Sync</span>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              alignSelf: "flex-start",
              padding: "6px 12px",
              borderRadius: 9999,
              background: "rgba(37,99,235,0.16)",
              border: "1px solid rgba(96,165,250,0.35)",
              color: "#93C5FD",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Construction + FM platform
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.12,
              color: "#F8FAFC",
              letterSpacing: "-0.03em",
            }}
          >
            Plans, issues & ops — one source of truth
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 20,
              color: "#94A3B8",
              lineHeight: 1.45,
              maxWidth: 460,
            }}
          >
            Measure PDFs free in your browser. Collaborate on RFIs, takeoff, BIM, and facilities
            when your team is ready.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["PDF viewer", "Issues", "RFIs", "Takeoff", "BIM", "FM"].map((label) => (
            <span
              key={label}
              style={{
                padding: "7px 14px",
                borderRadius: 9999,
                background: "rgba(148,163,184,0.08)",
                border: "1px solid rgba(148,163,184,0.22)",
                fontSize: 14,
                fontWeight: 600,
                color: "#CBD5E1",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Right product screenshot */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "40px 0 40px 0",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 640,
            height: 540,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(148,163,184,0.22)",
            background: "#020617",
            boxShadow: "0 28px 80px rgba(0,0,0,0.45)",
            marginRight: -24,
          }}
        >
          {/* Window chrome */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 16px",
              background: "#111827",
              borderBottom: "1px solid rgba(148,163,184,0.12)",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 9999, background: "#F87171" }} />
            <div style={{ width: 10, height: 10, borderRadius: 9999, background: "#FBBF24" }} />
            <div style={{ width: 10, height: 10, borderRadius: 9999, background: "#34D399" }} />
            <span
              style={{
                marginLeft: 10,
                fontSize: 13,
                fontWeight: 600,
                color: "#64748B",
                letterSpacing: "0.02em",
              }}
            >
              plansync.app
            </span>
          </div>
          <img
            src={screenshotSrc}
            alt=""
            width={640}
            height={492}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        </div>
      </div>
    </div>,
    { ...size },
  );
}
