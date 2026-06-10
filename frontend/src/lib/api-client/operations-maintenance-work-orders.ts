/**
 * Work orders, vendors, parts inventory, and maintenance reports.
 */
import { apiUrl } from "@/lib/api-url";
import { jsonHeaders, readJsonErrorBody, readJsonOrEmpty } from "./shared";
import { ProRequiredError } from "./errors";

export type WorkOrderChecklistItem = {
  id: string;
  label: string;
  type: "checkbox" | "passfail" | "text" | "photo";
  required?: boolean;
};

export type WorkOrderChecklistResult = {
  itemId: string;
  outcome: "pass" | "fail" | "na" | "done" | null;
  note?: string;
};

export type WorkOrderPartUsed = {
  partName: string;
  qty: number;
  unitCost?: number;
  inventoryItemId?: string;
};

type WorkOrderTypeApi = "CORRECTIVE" | "PREVENTIVE" | "INSPECTION_FOLLOWUP" | "TENANT" | "OCCUPANT";

export type OmVendorRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trade: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OmPartsInventoryRow = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  reorderLevel: number;
  unitCost: number | null;
  location: string | null;
  notes: string | null;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OmMaintenanceReportWeekBucket = {
  weekStart: string;
  count: number;
  laborHours: number;
  partsCost: number;
};

export type OmMaintenanceReport = {
  mttrHours: number | null;
  totalLaborHours: number;
  totalPartsCost: number;
  pmCompliancePct: number;
  pmCompletionsOnTime: number;
  pmCompletionsLate: number;
  completedByWeek: OmMaintenanceReportWeekBucket[];
  backlogByPriority: { priority: string; count: number }[];
  topAssetsByCost: { tag: string; name: string; count: number; cost: number }[];
  backlog: {
    id: string;
    title: string;
    ageDays: number;
    dueDate: string | null;
    priority: string;
    overdue: boolean;
  }[];
  recentCompleted: {
    id: string;
    title: string;
    assetTag: string | null;
    resolvedAt: string | null;
    laborMinutes: number | null;
  }[];
};

export type AssetMeterTypeApi = "RUN_HOURS" | "CYCLES" | "PRESSURE" | "TEMPERATURE" | "CUSTOM";

export type OmAssetMeterReadingRow = {
  id: string;
  meterType: AssetMeterTypeApi;
  label: string | null;
  value: number;
  unit: string | null;
  recordedAt: string;
};

export async function fetchOmAssetMeterReadings(
  projectId: string,
  assetId: string,
): Promise<OmAssetMeterReadingRow[]> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/meter-readings`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load meter readings.");
  return res.json() as Promise<OmAssetMeterReadingRow[]>;
}

export async function postOmAssetMeterReading(
  projectId: string,
  assetId: string,
  body: {
    meterType: AssetMeterTypeApi;
    value: number;
    label?: string;
    unit?: string;
  },
): Promise<{
  id: string;
  meterType: AssetMeterTypeApi;
  value: number;
  recordedAt: string;
  triggeredSchedules: { scheduleId: string; workOrderId: string; created: boolean }[];
  workOrdersCreated: number;
}> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/meter-readings`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not record meter reading."));
  return j as {
    id: string;
    meterType: AssetMeterTypeApi;
    value: number;
    recordedAt: string;
    triggeredSchedules: { scheduleId: string; workOrderId: string; created: boolean }[];
    workOrdersCreated: number;
  };
}

export const ASSET_METER_TYPE_LABEL: Record<AssetMeterTypeApi, string> = {
  RUN_HOURS: "Run hours",
  CYCLES: "Cycles",
  PRESSURE: "Pressure",
  TEMPERATURE: "Temperature",
  CUSTOM: "Custom",
};

export type WorkOrderAiTroubleshoot = {
  summary: string;
  suggestedSteps: string[];
  safetyNotes: string[];
};

export async function fetchOmVendors(projectId: string): Promise<OmVendorRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/vendors`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load vendors.");
  return res.json() as Promise<OmVendorRow[]>;
}

export async function postOmVendor(
  projectId: string,
  body: {
    name: string;
    email?: string;
    phone?: string;
    trade?: string;
    notes?: string;
  },
): Promise<OmVendorRow> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/vendors`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not create vendor."));
  return j as OmVendorRow;
}

export async function patchOmVendor(
  projectId: string,
  vendorId: string,
  body: Partial<{
    name: string;
    email: string | null;
    phone: string | null;
    trade: string | null;
    notes: string | null;
  }>,
): Promise<OmVendorRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/vendors/${encodeURIComponent(vendorId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not update vendor."));
  return j as OmVendorRow;
}

export async function deleteOmVendor(projectId: string, vendorId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/vendors/${encodeURIComponent(vendorId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not delete vendor.");
}

export async function postWorkOrderFromOccupant(
  projectId: string,
  occupantIssueId: string,
  body?: {
    title?: string;
    assigneeId?: string;
    vendorId?: string;
    dueDate?: string;
  },
): Promise<{ id: string; title: string; sourceOccupantIssueId: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/work-orders/from-occupant/${encodeURIComponent(occupantIssueId)}`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body ?? {}),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    id?: string;
    title?: string;
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not create work order.");
  }
  if (!j.id || !j.title) throw new Error("Invalid response.");
  return j as { id: string; title: string; sourceOccupantIssueId: string };
}

export async function postWorkOrderComplete(
  projectId: string,
  issueId: string,
  body: {
    procedureResultJson?: WorkOrderChecklistResult[];
    laborMinutes?: number;
    partsUsedJson?: WorkOrderPartUsed[];
    completionNotes?: string;
  },
): Promise<{ id: string; status: string; resolvedAt: string | null }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/work-orders/${encodeURIComponent(issueId)}/complete`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not complete work order."));
  return j as { id: string; status: string; resolvedAt: string | null };
}

export async function postWorkOrderVendorLink(
  projectId: string,
  issueId: string,
): Promise<{ ok: boolean; link: string; emailed: boolean; expiresAt: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/work-orders/${encodeURIComponent(issueId)}/vendor-link`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not send vendor link."));
  return j as { ok: boolean; link: string; emailed: boolean; expiresAt: string };
}

export async function postWorkOrderAiTroubleshoot(
  projectId: string,
  issueId: string,
): Promise<WorkOrderAiTroubleshoot> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/work-orders/${encodeURIComponent(issueId)}/ai-troubleshoot`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "AI troubleshoot failed."));
  return j as WorkOrderAiTroubleshoot;
}

export async function fetchOmPartsInventory(projectId: string): Promise<OmPartsInventoryRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/parts-inventory`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load parts inventory.");
  return res.json() as Promise<OmPartsInventoryRow[]>;
}

export async function postOmPartsInventoryItem(
  projectId: string,
  body: {
    name: string;
    sku?: string;
    quantity?: number;
    reorderLevel?: number;
    unitCost?: number;
    location?: string;
    notes?: string;
  },
): Promise<OmPartsInventoryRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/parts-inventory`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not add part."));
  return j as OmPartsInventoryRow;
}

async function patchOmPartsInventoryItem(
  projectId: string,
  itemId: string,
  body: Partial<{
    name: string;
    sku: string | null;
    quantity: number;
    reorderLevel: number;
    unitCost: number | null;
    location: string | null;
    notes: string | null;
  }>,
): Promise<OmPartsInventoryRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/parts-inventory/${encodeURIComponent(itemId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not update part."));
  return j as OmPartsInventoryRow;
}

export async function deleteOmPartsInventoryItem(projectId: string, itemId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/parts-inventory/${encodeURIComponent(itemId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not delete part.");
}

export async function fetchOmMaintenanceReport(projectId: string): Promise<OmMaintenanceReport> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/reports/maintenance`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load maintenance report.");
  const data = (await res.json()) as OmMaintenanceReport;
  return {
    ...data,
    completedByWeek: data.completedByWeek ?? [],
    backlogByPriority: data.backlogByPriority ?? [],
  };
}

export async function fetchVendorWorkOrderMeta(token: string): Promise<{
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  location: string | null;
  projectName: string;
  asset: { tag: string; name: string; locationLabel: string | null } | null;
  procedureJson: WorkOrderChecklistItem[];
}> {
  const res = await fetch(apiUrl(`/api/v1/vendor-work-order/${encodeURIComponent(token)}/meta`));
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Invalid link."));
  return j as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    location: string | null;
    projectName: string;
    asset: { tag: string; name: string; locationLabel: string | null } | null;
    procedureJson: WorkOrderChecklistItem[];
  };
}

export async function patchVendorWorkOrder(
  token: string,
  body: {
    status?: "IN_PROGRESS" | "RESOLVED";
    completionNotes?: string;
    procedureResultJson?: WorkOrderChecklistResult[];
  },
): Promise<{ id: string; status: string; resolvedAt: string | null }> {
  const res = await fetch(apiUrl(`/api/v1/vendor-work-order/${encodeURIComponent(token)}`), {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readJsonErrorBody(j, res, "Could not update."));
  return j as { id: string; status: string; resolvedAt: string | null };
}
