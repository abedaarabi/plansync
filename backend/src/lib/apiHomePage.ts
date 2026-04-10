import type { Env } from "./env.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildApiHomePageHtml(opts: { env: Env; host: string }): string {
  const { env, host } = opts;
  const appUrl = env.PUBLIC_APP_URL.trim();
  const publicApi = env.PUBLIC_API_URL?.trim();
  const healthPath = "/api/v1/health";
  const healthUrl = publicApi ? `${publicApi.replace(/\/$/, "")}${healthPath}` : healthPath;

  const appHref = escapeHtml(appUrl);
  const healthHref = escapeHtml(healthUrl);
  const hostSafe = escapeHtml(host);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>PlanSync API</title>
  <style>
    :root {
      --bg: #0b1220;
      --bg-elevated: #111827;
      --border: rgba(148, 163, 184, 0.12);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --primary: #2563eb;
      --primary-soft: rgba(37, 99, 235, 0.15);
      --glow: rgba(59, 130, 246, 0.35);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
    }
    .noise {
      pointer-events: none;
      position: fixed;
      inset: 0;
      opacity: 0.04;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .gradient {
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37, 99, 235, 0.25), transparent),
        radial-gradient(ellipse 60% 40% at 100% 0%, rgba(59, 130, 246, 0.12), transparent),
        radial-gradient(ellipse 50% 30% at 0% 100%, rgba(30, 64, 175, 0.15), transparent);
    }
    .wrap {
      position: relative;
      max-width: 52rem;
      margin: 0 auto;
      padding: clamp(2rem, 6vw, 4rem) 1.5rem 3rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      color: var(--muted);
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.7);
    }
    h1 {
      margin: 1.25rem 0 0.5rem;
      font-size: clamp(2rem, 5vw, 2.75rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    h1 span {
      background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .lead {
      margin: 0 0 2rem;
      font-size: 1.05rem;
      line-height: 1.6;
      color: var(--muted);
      max-width: 36rem;
    }
    .host {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.8rem;
      color: var(--muted);
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--border);
      display: inline-block;
      margin-bottom: 2rem;
    }
    .cards {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    a.card {
      display: block;
      padding: 1.25rem 1.35rem;
      border-radius: 1rem;
      text-decoration: none;
      color: inherit;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    }
    a.card:hover {
      border-color: rgba(37, 99, 235, 0.45);
      box-shadow: 0 0 0 1px var(--primary-soft), 0 12px 40px -12px var(--glow);
      transform: translateY(-2px);
    }
    a.card:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .card-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--primary);
      margin-bottom: 0.35rem;
    }
    .card-title {
      font-size: 1.05rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
    }
    .card-desc {
      font-size: 0.875rem;
      color: var(--muted);
      line-height: 1.45;
    }
    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--muted);
    }
    footer code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.75rem;
      color: #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="gradient" aria-hidden="true"></div>
  <div class="noise" aria-hidden="true"></div>
  <main class="wrap">
    <div class="badge"><span class="badge-dot" aria-hidden="true"></span> API online</div>
    <h1><span>PlanSync</span> API</h1>
    <p class="lead">This host serves the PlanSync REST API, authentication, and webhooks. Open the web app to use the product, or hit the health endpoint for a quick JSON check.</p>
    <p class="host">${hostSafe}</p>
    <div class="cards">
      <a class="card" href="${appHref}">
        <div class="card-label">Product</div>
        <div class="card-title">Open web app</div>
        <div class="card-desc">Continue in the PlanSync workspace in your browser.</div>
      </a>
      <a class="card" href="${healthHref}">
        <div class="card-label">Status</div>
        <div class="card-title">Health check</div>
        <div class="card-desc">GET <code style="color:#cbd5e1">/api/v1/health</code> — returns <code style="color:#cbd5e1">{ "ok": true }</code>.</div>
      </a>
    </div>
    <footer>
      <p style="margin:0 0 0.5rem">Routes include <code>/api/v1/*</code>, <code>/api/auth/*</code>, and <code>/api/stripe/*</code>.</p>
    </footer>
  </main>
</body>
</html>`;
}
