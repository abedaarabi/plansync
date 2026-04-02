# S3 bucket setup (PlanSync Pro uploads)

The API uploads PDFs in two ways:

1. **Same-origin upload (default for files up to 100 MiB)** — `POST /api/v1/files/upload` (multipart) sends the file to your API, which writes to S3 with the AWS SDK. **No S3 CORS rule is required** for this path (the browser only talks to your app origin).
2. **Presigned PUT** — for files larger than the direct limit, the browser `PUT`s bytes straight to S3 using a signed URL. **S3 CORS must allow `PUT`** from your app origin for this path.

The **PDF viewer** loads files via **`GET /api/v1/files/:fileId/content`** (same origin), which streams from S3 on the server. You do **not** need S3 CORS for **GET** for viewing unless you use presigned read URLs elsewhere.

You also need:

1. An **S3 bucket** (private — no public ACLs).
2. **CORS** on the bucket so the browser can `PUT` and `GET` using signed URLs from your web origin.
3. An **IAM user** (or role) with `PutObject` / `GetObject` on that bucket; credentials go in env as `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

## 1. Create the bucket

1. AWS Console → **S3** → **Create bucket**.
2. **Bucket name**: e.g. `plansync-prod-yourcompany` (globally unique).
3. **Region**: note it — use the same value for `AWS_REGION` (e.g. `us-east-1`).
4. **Block Public Access**: keep **all four** options **on** (recommended). Presigned URLs do not require a public bucket.
5. **Bucket versioning**: optional (recommended for recovery).
6. **Default encryption**: SSE-S3 or SSE-KMS is fine.

## 2. CORS configuration (required for large files / presigned browser PUTs)

Skip this section if you only use **direct upload** under `MAX_DIRECT_UPLOAD_BYTES` (default 100 MiB). You **do** need CORS if users upload PDFs **larger** than that limit (presigned flow) or if you rely on presigned PUT for other clients.

S3 → your bucket → **Permissions** → **Cross-origin resource sharing (CORS)** → **Edit** and paste JSON like:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://YOUR-PRODUCTION-DOMAIN"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

- Replace `YOUR-PRODUCTION-DOMAIN` with your real app hostname (no trailing slash).
- Add every origin where users upload (staging, preview deploys, etc.).

Without CORS, uploads from the Next app will fail in the browser even when presign succeeds.

## 3. IAM policy for the application user

Create an IAM **user** (programmatic access) or use a role if the API runs on AWS compute. Attach an inline policy like:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PlanSyncObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

- `DeleteObject` is optional unless you add delete/version APIs later.
- Keys are stored as `ws/<workspaceId>/p/<projectId>/...` — no bucket listing is required for the current API.

Create **access key** for the user → set:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=your-bucket-name
```

Put these in **repo root** `.env` / `.env.prod` or **`backend/.env`** (same vars the Hono server reads).

## 4. Verify

With the API running and env loaded:

1. Sign in, open a Pro workspace, trigger a **presign upload** from the app (or call `POST /api/v1/files/presign-upload` with a valid body).
2. You should get `{ uploadUrl, key, ... }` — not `503` / “S3 not configured”.
3. `PUT` the file bytes to `uploadUrl` with the same `Content-Type` you sent to presign.

## 5. Costs and lifecycle (optional)

- Enable **S3 Storage Lens** or billing alerts for unexpected growth.
- Consider a **lifecycle rule** to expire noncurrent versions or incomplete multipart uploads if you enable versioning / multipart.

## Local development without AWS

Leave `AWS_*` and `S3_BUCKET` unset — the API returns `503` with a dev hint on upload routes. For local S3-compatible storage (MinIO, LocalStack), you would need extra client options (`endpoint`, path-style); that is not wired in `backend/src/lib/s3.ts` today.
