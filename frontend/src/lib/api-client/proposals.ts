/**
 * Proposals domain API endpoints and payload types.
 * Kept separate from core to keep files navigable.
 */
import { apiUrl } from "@/lib/api-url";
import { jsonHeaders, readJsonErrorBody } from "./shared";
import { ProRequiredError } from "./errors";
import { downloadAuthenticatedBlob } from "@/lib/downloadBlob";

// --- Proposals ---

export type ProposalListRow = {
  id: string;
  sequenceNumber: number;
  reference: string;
  title: string;
  status: string;
  clientName: string;
  clientEmail: string;
  sentAt: string | null;
  total: string;
  currency: string;
  createdAt: string;
  createdByName: string;
};

export type ProposalsListResponse = {
  proposals: ProposalListRow[];
  stats: {
    pipelineTotal: string;
    accepted: number;
    sent: number;
    draft: number;
    declined: number;
  };
};

export type ProposalItemRow = {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  rate: string;
  lineTotal: string;
  sortOrder: number;
  sourceTakeoffLineId: string | null;
};

export type ProposalDetail = {
  id: string;
  projectId: string;
  workspaceId: string;
  templateId: string | null;
  /** Linked takeoff sheet revisions (merge order matches this array). */
  sourceFileVersionIds?: string[];
  /** First linked revision; prefer sourceFileVersionIds */
  sourceFileVersionId: string | null;
  takeoffSources?: { fileVersionId: string; fileName: string; version: number }[];
  sequenceNumber: number;
  reference: string;
  title: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  clientPhone: string | null;
  validUntil: string;
  currency: string;
  subtotal: string;
  taxPercent: string;
  /** Percent of line subtotal added as work / labor before tax. */
  workPricePercent: string;
  workAmount: string;
  taxableSubtotal: string;
  taxAmount: string;
  discount: string;
  total: string;
  coverNote: string;
  publicToken: string | null;
  signerName: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  declineComment: string | null;
  changeRequestComment: string | null;
  changeRequestedAt: string | null;
  sentAt: string | null;
  firstViewedAt: string | null;
  items: ProposalItemRow[];
  attachments: { fileVersionId: string; fileName: string; version: number }[];
  template: { id: string; name: string; defaultsJson: unknown } | null;
  createdBy: { id: string; name: string; email: string };
  workspaceName: string;
  /** Resolved URL for &lt;img src&gt; (hosted or external) */
  workspaceLogoUrl?: string | null;
  projectName: string;
  sourceFileVersion: { id: string; version: number; fileName: string } | null;
};

export async function fetchProposalTakeoffFileVersions(projectId: string): Promise<{
  fileVersions: { id: string; label: string; fileId: string; fileName: string; version: number }[];
}> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals/takeoff-file-versions`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load takeoff versions.");
  return res.json() as Promise<{
    fileVersions: {
      id: string;
      label: string;
      fileId: string;
      fileName: string;
      version: number;
    }[];
  }>;
}

export async function fetchProposalsList(projectId: string): Promise<ProposalsListResponse> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load proposals.");
  return res.json() as Promise<ProposalsListResponse>;
}

export async function createProposal(
  projectId: string,
  body: {
    title: string;
    clientName: string;
    clientEmail: string;
    clientCompany?: string | null;
    clientPhone?: string | null;
    currency?: string;
    validUntil?: string;
    templateId?: string | null;
    sourceFileVersionId?: string | null;
  },
): Promise<ProposalDetail> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not create proposal.");
  return j as ProposalDetail;
}

export async function fetchProposalDetail(
  projectId: string,
  proposalId: string,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load proposal.");
  return res.json() as Promise<ProposalDetail>;
}

export async function patchProposal(
  projectId: string,
  proposalId: string,
  body: Record<string, unknown>,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save proposal.");
  return j as ProposalDetail;
}

export async function syncProposalFromTakeoff(
  projectId: string,
  proposalId: string,
  fileVersionIds: string[],
  mode?: "replace" | "quantities_only",
): Promise<ProposalDetail> {
  const body =
    fileVersionIds.length === 1
      ? { fileVersionId: fileVersionIds[0]!, mode }
      : { fileVersionIds, mode };
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/items/sync-from-takeoff`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not sync takeoff.");
  return j as ProposalDetail;
}

export type ProposalPreviewPayload = {
  html: string;
  takeoffTableHtml: string;
  letterMarkdown: string;
  letterHtml: string | null;
};

export async function previewProposalHtml(
  projectId: string,
  proposalId: string,
): Promise<ProposalPreviewPayload> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/preview`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not preview.");
  return res.json() as Promise<ProposalPreviewPayload>;
}

export async function fetchProposalPdfBlob(projectId: string, proposalId: string): Promise<Blob> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/pdf`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load PDF.");
  return res.blob();
}

export async function sendProposalToClient(
  projectId: string,
  proposalId: string,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/send`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not send proposal.");
  return j as ProposalDetail;
}

export async function resendProposal(projectId: string, proposalId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/resend`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not resend.");
}

export async function duplicateProposal(
  projectId: string,
  proposalId: string,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/duplicate`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not duplicate.");
  return res.json() as Promise<ProposalDetail>;
}

export async function deleteProposal(projectId: string, proposalId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete proposal.");
}

export async function proposalAiDraft(
  projectId: string,
  proposalId: string,
  body: { userPrompt?: string; section?: "cover" | "executive_summary" },
): Promise<{ text: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/ai-draft`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string; text?: string };
  if (res.status === 503) throw new Error(j.error ?? "AI not configured.");
  if (!res.ok) throw new Error(j.error ?? "AI draft failed.");
  return { text: j.text ?? "" };
}

export type ProposalTemplateRow = {
  id: string;
  name: string;
  body: string;
  defaultsJson: unknown;
  updatedAt: string;
};

export async function fetchProposalTemplates(workspaceId: string): Promise<{
  templates: ProposalTemplateRow[];
}> {
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates`),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load templates.");
  return res.json() as Promise<{ templates: ProposalTemplateRow[] }>;
}

export async function createProposalTemplate(
  workspaceId: string,
  body: { name: string; body: string; defaultsJson?: Record<string, unknown> | null },
): Promise<{ id: string }> {
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error("Could not create template.");
  return res.json() as Promise<{ id: string }>;
}

export async function patchProposalTemplate(
  workspaceId: string,
  templateId: string,
  body: Partial<{ name: string; body: string; defaultsJson: Record<string, unknown> | null }>,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates/${encodeURIComponent(templateId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error("Could not save template.");
}

export async function deleteProposalTemplate(
  workspaceId: string,
  templateId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates/${encodeURIComponent(templateId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not delete template.");
}

export type PublicProposalPayload = {
  reference: string;
  title: string;
  status: string;
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  clientName: string;
  validUntil: string;
  currency: string;
  coverHtml: string;
  subtotal: string;
  taxPercent: string;
  workPricePercent: string;
  workAmount: string;
  taxableSubtotal: string;
  taxAmount: string;
  discount: string;
  total: string;
  items: ProposalItemRow[];
  attachments: {
    fileVersionId: string;
    fileName: string;
    version: number;
    readUrl: string | null;
  }[];
  expired: boolean;
};

export type LandingMarketingChatMessage = { role: "user" | "model"; content: string };

export async function fetchLandingMarketingChat(body: {
  locale: string;
  messages: LandingMarketingChatMessage[];
}): Promise<{ reply: string }> {
  const res = await fetch(apiUrl("/api/v1/public/marketing/chat"), {
    method: "POST",
    credentials: "omit",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = readJsonErrorBody(
      (await res.json().catch(() => ({}))) as Record<string, unknown>,
      res,
      "Could not reach assistant.",
    );
    if (res.status === 429) {
      msg = "Too many requests. Please try again shortly.";
    } else if (res.status === 503) {
      msg = "Assistant is temporarily unavailable.";
    }
    const err = new Error(msg) as Error & { httpStatus: number };
    err.httpStatus = res.status;
    throw err;
  }
  const data = (await res.json()) as { reply?: string };
  if (typeof data.reply !== "string" || !data.reply.trim()) {
    throw new Error("Invalid assistant response.");
  }
  return { reply: data.reply.trim() };
}

export async function fetchPublicProposal(token: string): Promise<PublicProposalPayload> {
  const res = await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}`), {
    credentials: "omit",
  });
  if (!res.ok) throw new Error("Proposal not found.");
  return res.json() as Promise<PublicProposalPayload>;
}

export async function postPublicProposalView(token: string): Promise<void> {
  await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/view`), {
    method: "POST",
    credentials: "omit",
    headers: jsonHeaders,
    body: "{}",
  });
}

export async function postPublicProposalAccept(
  token: string,
  body: { signerName: string; signatureData: string },
): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/accept`), {
    method: "POST",
    credentials: "omit",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not accept.");
}

export async function postPublicProposalDecline(
  token: string,
  body: { reason: string; comment?: string | null },
): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/decline`), {
    method: "POST",
    credentials: "omit",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not decline.");
}

export async function postPublicProposalRequestChanges(
  token: string,
  comment: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/request-changes`),
    {
      method: "POST",
      credentials: "omit",
      headers: jsonHeaders,
      body: JSON.stringify({ comment }),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not submit.");
}

export async function fetchPublicProposalMessages(
  token: string,
): Promise<{ messages: { id: string; body: string; isFromClient: boolean; createdAt: string }[] }> {
  const res = await fetch(
    apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/messages`),
    {
      credentials: "omit",
    },
  );
  if (!res.ok) throw new Error("Could not load messages.");
  return res.json() as Promise<{
    messages: { id: string; body: string; isFromClient: boolean; createdAt: string }[];
  }>;
}

export async function postPublicProposalMessage(token: string, body: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/messages`),
    {
      method: "POST",
      credentials: "omit",
      headers: jsonHeaders,
      body: JSON.stringify({ body }),
    },
  );
  if (!res.ok) throw new Error("Could not send message.");
}

export type ProposalAnalyticsSummary = {
  totalProposals: number;
  accepted: number;
  declined: number;
  sent: number;
  winRate: number | null;
};

export async function fetchProposalAnalyticsSummary(
  projectId: string,
): Promise<ProposalAnalyticsSummary> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals/analytics/summary`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load analytics.");
  return res.json() as Promise<ProposalAnalyticsSummary>;
}

export type ProposalRevisionRow = {
  id: string;
  sentAt: string;
  snapshot: {
    reference?: string;
    title?: string;
    total?: string;
    subtotal?: string;
    taxPercent?: string;
    discount?: string;
    sentAt?: string;
  };
};

export async function fetchProposalRevisions(
  projectId: string,
  proposalId: string,
): Promise<{ revisions: ProposalRevisionRow[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/revisions`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load revisions.");
  return res.json() as Promise<{ revisions: ProposalRevisionRow[] }>;
}

export type ProposalPortalMessageRow = {
  id: string;
  body: string;
  isFromClient: boolean;
  createdAt: string;
};

export async function fetchProposalPortalMessages(
  projectId: string,
  proposalId: string,
): Promise<{ messages: ProposalPortalMessageRow[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/portal-messages`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load messages.");
  return res.json() as Promise<{ messages: ProposalPortalMessageRow[] }>;
}

export async function postProposalPortalMessageStaff(
  projectId: string,
  proposalId: string,
  messageBody: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/portal-messages`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ body: messageBody }),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not send message.");
}

export async function downloadProposalCsvExport(
  projectId: string,
  proposalId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/export-csv`,
    ),
    { credentials: "include" },
  );
  await downloadAuthenticatedBlob(res, `proposal-${proposalId}-lines.csv`, "Could not export CSV.");
}

export type ProposalRateHint = {
  itemName: string;
  avgRate: number;
  sampleSize: number;
  currency: string;
};

export async function fetchWorkspaceProposalRateHints(
  workspaceId: string,
  q: string,
): Promise<{ hints: ProposalRateHint[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposals/rate-hints?q=${encodeURIComponent(q)}`,
    ),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load rate hints.");
  return res.json() as Promise<{ hints: ProposalRateHint[] }>;
}

export async function postProposalExternalSignExport(
  projectId: string,
  proposalId: string,
): Promise<{ configured: boolean; message?: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/external-sign-export`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders },
  );
  const j = (await res.json().catch(() => ({}))) as {
    configured?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(j.error ?? "Request failed.");
  return { configured: Boolean(j.configured), message: j.message };
}

// --- Proposal Document Versions ---

export type ProposalDocumentVersionRow = {
  id: string;
  versionNumber: number;
  contentJson: Record<string, unknown>;
  contentHtml: string;
  changeSummary: string;
  createdBy: { id: string; name: string; email: string } | null;
  createdAt: string;
};

export async function fetchProposalDocumentVersions(
  projectId: string,
  proposalId: string,
): Promise<{ versions: ProposalDocumentVersionRow[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/document-versions`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load document versions.");
  return res.json() as Promise<{ versions: ProposalDocumentVersionRow[] }>;
}

export async function saveProposalDocumentVersion(
  projectId: string,
  proposalId: string,
  payload: { contentJson: Record<string, unknown>; contentHtml: string; changeSummary?: string },
): Promise<ProposalDocumentVersionRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/document-versions`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: JSON.stringify(payload) },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Could not save version.");
  }
  return res.json() as Promise<ProposalDocumentVersionRow>;
}

export async function restoreProposalDocumentVersion(
  projectId: string,
  proposalId: string,
  versionId: string,
): Promise<ProposalDocumentVersionRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/document-versions/${encodeURIComponent(versionId)}/restore`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Could not restore version.");
  }
  return res.json() as Promise<ProposalDocumentVersionRow>;
}

// --- Proposal Internal Comments ---

export type ProposalCommentRow = {
  id: string;
  body: string;
  resolvedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; email: string };
};

export async function fetchProposalComments(
  projectId: string,
  proposalId: string,
): Promise<{ comments: ProposalCommentRow[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/comments`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load comments.");
  return res.json() as Promise<{ comments: ProposalCommentRow[] }>;
}

export async function postProposalComment(
  projectId: string,
  proposalId: string,
  body: string,
): Promise<ProposalCommentRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/comments`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ body }),
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Could not post comment.");
  }
  return res.json() as Promise<ProposalCommentRow>;
}

export async function patchProposalComment(
  projectId: string,
  proposalId: string,
  commentId: string,
  patch: { body?: string; resolved?: boolean },
): Promise<ProposalCommentRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/comments/${encodeURIComponent(commentId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Could not update comment.");
  }
  return res.json() as Promise<ProposalCommentRow>;
}

export async function deleteProposalComment(
  projectId: string,
  proposalId: string,
  commentId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/comments/${encodeURIComponent(commentId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Could not delete comment.");
  }
}
