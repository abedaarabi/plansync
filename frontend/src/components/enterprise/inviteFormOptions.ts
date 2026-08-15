export const INVITE_KIND_OPTIONS = [
  { value: "INTERNAL", label: "Internal teammate" },
  { value: "CLIENT", label: "Client" },
  { value: "CONTRACTOR", label: "Contractor" },
  { value: "SUBCONTRACTOR", label: "Subcontractor" },
] as const;

export const WORKSPACE_ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "ADMIN", label: "Admin" },
] as const;
