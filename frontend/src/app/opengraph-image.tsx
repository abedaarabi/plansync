import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "PlanSync — Open construction plans, set scale, measure and mark up. Free, no sign-up, files stay local.";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0F172A",
        padding: "60px 72px",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── Ambient blue glow ── */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "25%",
          width: "55%",
          height: "65%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(59,130,246,0.12), transparent 70%)",
        }}
      />

      {/* ── Decorative registration mark — top right ── */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: -30,
          display: "flex",
          opacity: 0.04,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 120,
            height: 14,
            background: "#3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 14,
            height: 120,
            background: "#3b82f6",
          }}
        />
      </div>

      {/* ── Decorative registration mark — bottom left ── */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: -20,
          display: "flex",
          opacity: 0.04,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 100,
            height: 14,
            background: "#3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 14,
            height: 100,
            background: "#3b82f6",
          }}
        />
      </div>

      {/* ── Header: Logo mark + wordmark + pills ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* Logo mark */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#2563EB",
              display: "flex",
              position: "relative",
            }}
          >
            {/* L1 — top-left */}
            <div
              style={{
                position: "absolute",
                top: 9,
                left: 9,
                width: 18,
                height: 4,
                background: "white",
                borderRadius: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 9,
                left: 9,
                width: 4,
                height: 18,
                background: "white",
                borderRadius: 1,
              }}
            />
            {/* L2 — bottom-right */}
            <div
              style={{
                position: "absolute",
                bottom: 9,
                right: 9,
                width: 18,
                height: 4,
                background: "rgba(255,255,255,0.38)",
                borderRadius: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 9,
                right: 9,
                width: 4,
                height: 18,
                background: "rgba(255,255,255,0.38)",
                borderRadius: 1,
              }}
            />
          </div>

          {/* Wordmark */}
          <span
            style={{
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            <span style={{ color: "#F8FAFC" }}>Plan</span>
            <span style={{ color: "#3b82f6" }}>Sync</span>
          </span>
        </div>

        {/* Pill badges */}
        <div style={{ display: "flex", gap: 10 }}>
          {(
            [
              {
                t: "Free",
                bg: "rgba(59,130,246,0.1)",
                border: "rgba(59,130,246,0.25)",
                color: "#60a5fa",
              },
              {
                t: "No sign-up",
                bg: "rgba(59,130,246,0.1)",
                border: "rgba(59,130,246,0.25)",
                color: "#60a5fa",
              },
              {
                t: "Local only",
                bg: "rgba(59,130,246,0.15)",
                border: "rgba(59,130,246,0.35)",
                color: "#93c5fd",
              },
            ] as const
          ).map((p) => (
            <span
              key={p.t}
              style={{
                padding: "7px 16px",
                borderRadius: 9999,
                background: p.bg,
                border: `1.5px solid ${p.border}`,
                fontSize: 15,
                fontWeight: 600,
                color: p.color,
              }}
            >
              {p.t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main headline ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 6,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.1,
            color: "#F8FAFC",
            letterSpacing: "-0.03em",
          }}
        >
          Open plans. Set scale.
        </h1>
        <h1
          style={{
            margin: 0,
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.1,
            color: "#3b82f6",
            letterSpacing: "-0.03em",
          }}
        >
          Measure and mark up.
        </h1>
        <p
          style={{
            margin: 0,
            marginTop: 18,
            fontSize: 24,
            color: "#94a3b8",
            lineHeight: 1.5,
            maxWidth: 820,
          }}
        >
          The free construction PDF viewer for field and office teams. No account needed — files
          never leave your browser.
        </p>
      </div>

      {/* ── Footer: separator + domain ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background:
              "linear-gradient(90deg, rgba(148,163,184,0.2) 0%, rgba(148,163,184,0.05) 100%)",
          }}
        />
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "#64748b",
            letterSpacing: "0.04em",
          }}
        >
          plansync.app
        </span>
      </div>
    </div>,
    { ...size },
  );
}
