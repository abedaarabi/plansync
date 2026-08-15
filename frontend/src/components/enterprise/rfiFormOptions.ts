/** Shared RFI select options for create/edit slide-overs. */
export const RFI_PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

export const RFI_RISK_OPTIONS = [
  { value: "", label: "—" },
  { value: "low", label: "Low" },
  { value: "med", label: "Medium" },
  { value: "high", label: "High" },
] as const;
