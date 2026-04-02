import {
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "./env.js";

export function s3Client(env: Env): S3Client | null {
  if (!env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export async function presignPut(
  env: Env,
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string | null> {
  const client = s3Client(env);
  const bucket = env.S3_BUCKET;
  if (!client || !bucket) return null;
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function presignGet(env: Env, key: string, expiresIn = 3600): Promise<string | null> {
  const client = s3Client(env);
  const bucket = env.S3_BUCKET;
  if (!client || !bucket) return null;
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

/** Stream object bytes (for same-origin viewer proxy — avoids S3 GET CORS in the browser). */
export async function getObjectStream(
  env: Env,
  key: string,
): Promise<
  | {
      ok: true;
      stream: ReadableStream;
      contentType: string;
      contentLength?: number;
    }
  | { ok: false; error: string }
> {
  const client = s3Client(env);
  const bucket = env.S3_BUCKET;
  if (!client || !bucket) return { ok: false, error: "S3 not configured" };
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!out.Body) return { ok: false, error: "Empty object" };
    const body = out.Body as { transformToWebStream?: () => ReadableStream };
    const stream = body.transformToWebStream?.();
    if (!stream) return { ok: false, error: "Could not stream S3 object" };
    const len = out.ContentLength;
    return {
      ok: true,
      stream,
      contentType: out.ContentType ?? "application/pdf",
      contentLength: typeof len === "number" ? len : len != null ? Number(len) : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "S3 read failed",
    };
  }
}

export async function deleteObject(
  env: Env,
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = s3Client(env);
  const bucket = env.S3_BUCKET;
  if (!client || !bucket) return { ok: false, error: "S3 not configured" };
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "S3 delete failed",
    };
  }
}

export async function putObjectBuffer(
  env: Env,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = s3Client(env);
  const bucket = env.S3_BUCKET;
  if (!client || !bucket) return { ok: false, error: "S3 not configured" };
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "S3 upload failed",
    };
  }
}
