/**
 * Example shape for folders/files (matches API `Project` slices).
 * Use for Storybook, tests, or documentation — not imported by production UI.
 */
export const exampleFolderFileTree = {
  projectName: "Riverside Tower",
  folders: [
    {
      id: "f-root-arch",
      name: "Architectural",
      parentId: null as string | null,
      projectId: "proj-1",
      updatedAt: "2026-03-15T10:00:00.000Z",
    },
    {
      id: "f-nested-floor",
      name: "Floor Plans",
      parentId: "f-root-arch",
      projectId: "proj-1",
      updatedAt: "2026-03-14T09:30:00.000Z",
    },
    {
      id: "f-mep",
      name: "MEP",
      parentId: null as string | null,
      projectId: "proj-1",
      updatedAt: "2026-03-12T16:20:00.000Z",
    },
    {
      id: "f-mep-hvac",
      name: "HVAC",
      parentId: "f-mep",
      projectId: "proj-1",
      updatedAt: "2026-03-18T08:15:00.000Z",
    },
    {
      id: "f-mep-hvac-issued",
      name: "Issued For Construction",
      parentId: "f-mep-hvac",
      projectId: "proj-1",
      updatedAt: "2026-03-24T12:45:00.000Z",
    },
    {
      id: "f-structural",
      name: "Structural",
      parentId: null as string | null,
      projectId: "proj-1",
      updatedAt: "2026-03-20T14:10:00.000Z",
    },
  ],
  files: [
    {
      id: "file-1",
      name: "A-101.pdf",
      mimeType: "application/pdf",
      folderId: "f-nested-floor" as string | null,
      updatedAt: "2026-03-15T11:00:00.000Z",
      versions: [
        {
          id: "v1",
          version: 1,
          sizeBytes: 245000,
          s3Key: "…",
        },
      ],
    },
    {
      id: "file-2",
      name: "M-401.pdf",
      mimeType: "application/pdf",
      folderId: "f-mep-hvac-issued" as string | null,
      updatedAt: "2026-03-24T13:00:00.000Z",
      versions: [
        {
          id: "v2-1",
          version: 1,
          sizeBytes: 512000,
          s3Key: "…",
        },
        {
          id: "v2-2",
          version: 2,
          sizeBytes: 538432,
          s3Key: "…",
        },
      ],
    },
    {
      id: "file-3",
      name: "S-201.pdf",
      mimeType: "application/pdf",
      folderId: "f-structural" as string | null,
      updatedAt: "2026-03-22T09:10:00.000Z",
      versions: [
        {
          id: "v3-1",
          version: 1,
          sizeBytes: 392144,
          s3Key: "…",
        },
      ],
    },
  ],
} as const;
