"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Camera, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { OmAssetSummaryCard } from "@/components/enterprise/OmAssetSummaryCard";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterpriseTextarea,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import {
  completeOccupantIssueReferencePhoto,
  fetchOccupantAssetImageUrl,
  fetchOccupantMeta,
  postOccupantSubmit,
  presignOccupantIssueReferencePhoto,
} from "@/lib/api-client";

const ALLOWED_OCCUPANT_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "",
]);

type Props = { token: string; initialAssetSecret?: string };

type Phase = "form" | "done";

const occupantRequestSchema = z.object({
  description: z.string().trim().min(1, "Describe the issue."),
  floor: z.string(),
  reporterEmail: z.string().trim().email("Enter a valid email address."),
  reporterName: z.string().trim().min(1, "Enter your name."),
  room: z.string(),
});

type OccupantRequestValues = z.infer<typeof occupantRequestSchema>;

// fallow-ignore-next-line complexity
export function OccupantPortalPublicClient({ token, initialAssetSecret }: Props) {
  const assetSecret = initialAssetSecret?.trim() || undefined;

  const form = useEnterpriseForm(occupantRequestSchema, {
    description: "",
    floor: "",
    reporterEmail: "",
    reporterName: "",
    room: "",
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");

  const {
    data: meta,
    isPending,
    error,
  } = useQuery({
    queryKey: ["occupantMeta", token, assetSecret ?? ""],
    queryFn: () => fetchOccupantMeta(token, { assetSecret }),
    retry: false,
  });

  const assetImageQuery = useQuery({
    queryKey: ["occupantAssetImage", token, assetSecret ?? ""],
    queryFn: () => fetchOccupantAssetImageUrl(token, assetSecret!),
    enabled: Boolean(assetSecret && meta?.asset?.hasImage),
    staleTime: 4 * 60 * 1000,
    retry: false,
  });

  async function onSubmit(values: OccupantRequestValues) {
    setSubmitting(true);
    setUploadStep(null);
    try {
      const res = await postOccupantSubmit(token, {
        description: values.description.trim(),
        floor: values.floor.trim() || undefined,
        room: values.room.trim() || undefined,
        reporterName: values.reporterName.trim(),
        reporterEmail: values.reporterEmail.trim(),
        assetSecret,
      });

      const list = photoFiles;
      if (list.length === 0) {
        setPhase("done");
        toast.success("Your request was submitted.");
        return;
      }

      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        setUploadStep(`Uploading photo ${i + 1} of ${list.length}…`);
        const ct = (file.type || "application/octet-stream").toLowerCase();
        if (!ALLOWED_OCCUPANT_PHOTO_TYPES.has(ct)) {
          toast.error(`${file.name}: use a JPEG, PNG, WebP, GIF, or HEIC image.`);
          setUploadStep(null);
          setSubmitting(false);
          return;
        }
        const presign = await presignOccupantIssueReferencePhoto(token, res.issueId, {
          occupantPhotoToken: res.occupantPhotoToken,
          fileName: file.name,
          contentType: ct || "application/octet-stream",
          sizeBytes: file.size,
        });
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": ct || "application/octet-stream" },
        });
        if (!put.ok) {
          throw new Error(`Upload failed for ${file.name}.`);
        }
        await completeOccupantIssueReferencePhoto(token, res.issueId, {
          occupantPhotoToken: res.occupantPhotoToken,
          key: presign.key,
          fileName: file.name,
          contentType: ct || "image/jpeg",
          sizeBytes: file.size,
        });
      }
      setUploadStep(null);
      setPhase("done");
      toast.success("Your request and photos were submitted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
      setUploadStep(null);
    }
  }

  if (isPending) {
    return (
      <div className="mobile-app-page w-full min-w-0 max-w-full flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-sm text-[var(--enterprise-text-muted)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--enterprise-primary)]" aria-hidden />
        Loading…
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-[var(--enterprise-error)]">
          {error instanceof Error ? error.message : "This link is not valid."}
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 text-center sm:py-16">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-success)]">
          <Send className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-semibold text-[var(--enterprise-text)]">Thank you</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          Your request for{" "}
          <strong className="font-medium text-[var(--enterprise-text)]">{meta.projectName}</strong>{" "}
          was submitted. Check your email for a confirmation. The facilities team may follow up if
          more detail is needed.
        </p>
      </div>
    );
  }

  const title = meta.occupantHeadline?.trim() || meta.projectName || "Report an issue";

  return (
    <div className="mx-auto w-full max-w-lg min-w-0 px-4 py-8 sm:py-14">
      <div className="mb-8 flex min-w-0 items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)]">
          <Building2 className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Building — {meta.projectName}
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-[var(--enterprise-text)]">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
            Report a maintenance issue for this site. No account required. Please describe what you
            noticed and add a photo if it helps.
          </p>
        </div>
      </div>

      {meta.asset ? (
        <OmAssetSummaryCard
          className="enterprise-card mb-6 space-y-3 px-4 py-3 text-sm shadow-[var(--enterprise-shadow-xs)]"
          asset={meta.asset}
          image={
            meta.asset.hasImage
              ? {
                  mode: "url",
                  url: assetImageQuery.data,
                  loading: assetImageQuery.isPending,
                }
              : undefined
          }
        />
      ) : null}

      <EnterpriseForm form={form} onSubmit={onSubmit} className="space-y-4">
        <EnterpriseFormField<OccupantRequestValues>
          name="description"
          label="What is the issue?"
          required
        >
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseTextarea
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              rows={4}
              className="min-h-[7.5rem] max-w-full sm:min-h-[120px]"
              placeholder="Describe the problem…"
            />
          )}
        </EnterpriseFormField>
        <label className="block text-sm">
          <span className="mb-1 flex items-center gap-2 font-medium text-[var(--enterprise-text)]">
            <Camera className="h-4 w-4 text-[var(--enterprise-text-muted)]" aria-hidden />
            Photos (optional)
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
            multiple
            onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-[var(--enterprise-text)] file:mr-3 file:rounded-lg file:border file:border-[var(--enterprise-border)] file:bg-[var(--enterprise-surface)] file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <EnterpriseFormField<OccupantRequestValues> name="floor" label="Floor (optional)">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<OccupantRequestValues> name="room" label="Room (optional)">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </EnterpriseFormField>
        </div>
        <EnterpriseFormField<OccupantRequestValues> name="reporterName" label="Your name" required>
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseInput
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </EnterpriseFormField>
        <EnterpriseFormField<OccupantRequestValues> name="reporterEmail" label="Email" required>
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseInput
              {...field}
              id={id}
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </EnterpriseFormField>
        {uploadStep ? (
          <p className="flex items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {uploadStep}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-base font-semibold text-white shadow-sm disabled:opacity-50 sm:text-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {uploadStep ? "Uploading…" : "Sending…"}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit request
            </>
          )}
        </button>
      </EnterpriseForm>
    </div>
  );
}
