import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

type Params = { path?: string[] };

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
    if (one) out.headers.append("set-cookie", one);
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
