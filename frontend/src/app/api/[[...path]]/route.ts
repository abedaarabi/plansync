import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function backendBase(): string {
  return (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787").replace(/\/$/, "");
}

function publicAppUrl(): string | undefined {
  return process.env.PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
}

/** So Better Auth behind internal `http://backend:8787` still sees the browser’s public HTTPS host. */
function forwardedProto(req: NextRequest): "http" | "https" {
  const raw = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (raw === "http" || raw === "https") return raw;
  const app = publicAppUrl();
  if (app?.startsWith("https://")) return "https";
  return req.nextUrl.protocol === "https:" ? "https" : "http";
}

function forwardedHost(req: NextRequest): string | undefined {
  const app = publicAppUrl();
  if (process.env.NODE_ENV === "production" && app) {
    try {
      return new URL(app).host;
    } catch {
      /* fall through */
    }
  }
  return (
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.split(",")[0]?.trim() ||
    undefined
  );
}

type Params = { path?: string[] };

/**
 * Some runtimes/proxies expose multiple Set-Cookie headers as one comma-joined string.
 * Split safely so each cookie is appended as its own header.
 */
function splitSetCookieHeader(raw: string): string[] {
  const out: string[] = [];
  let start = 0;
  let inExpires = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (!inExpires && raw.slice(i, i + 8).toLowerCase() === "expires=") {
      inExpires = true;
      i += 7;
      continue;
    }
    if (inExpires && ch === ";") {
      inExpires = false;
      continue;
    }
    if (ch === "," && !inExpires) {
      const part = raw.slice(start, i).trim();
      if (part) out.push(part);
      start = i + 1;
    }
  }
  const tail = raw.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

async function proxy(req: NextRequest, params: Params): Promise<Response> {
  const sub = params.path?.length ? params.path.join("/") : "";
  const path = sub ? `/api/${sub}` : "/api";
  const target = `${backendBase()}${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const kl = key.toLowerCase();
    if (kl === "host" || HOP_BY_HOP.has(kl)) return;
    headers.set(key, value);
  });

  headers.set("x-forwarded-proto", forwardedProto(req));
  const xfHost = forwardedHost(req);
  if (xfHost) headers.set("x-forwarded-host", xfHost);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength) init.body = buf;
  }

  const res = await fetch(target, init);

  const out = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
  });

  const hdrs = res.headers as unknown as { getSetCookie?: () => string[] };
  const cookies = typeof hdrs.getSetCookie === "function" ? hdrs.getSetCookie() : [];
  if (cookies.length) {
    for (const c of cookies) out.headers.append("set-cookie", c);
  } else {
    const one = res.headers.get("set-cookie");
    if (one) {
      for (const c of splitSetCookieHeader(one)) out.headers.append("set-cookie", c);
    }
  }

  res.headers.forEach((value, key) => {
    const kl = key.toLowerCase();
    if (kl === "set-cookie") return;
    if (HOP_BY_HOP.has(kl)) return;
    if (kl === "content-encoding" || kl === "transfer-encoding") return;
    try {
      out.headers.set(key, value);
    } catch {
      /* ignore */
    }
  });

  return out;
}

async function handle(req: NextRequest, ctx: { params: Promise<Params> }) {
  return proxy(req, await ctx.params);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
