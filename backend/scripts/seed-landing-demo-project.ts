/**
 * Seeds rich demo content on an existing project (for marketing screenshots).
 *
 * Env:
 *   DATABASE_URL                 — required (same as Prisma)
 *   SEED_LANDING_PROJECT_ID      — default: cmnzdz9vj00018oitb9nos71w
 *   SEED_LANDING_REPLACE=1       — remove prior rows tagged with "[Landing]" (and field reports with marker note) then re-seed
 *   SEED_LANDING_SKIP_PROJECT=1  — do not update project name/stage/progress/dates (only seed child rows)
 *
 * Run from repo root:
 *   npm run db:seed:landing
 */
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  ActivityType,
  IssueKind,
  IssuePriority,
  IssueStatus,
  PrismaClient,
  ProjectMemberRole,
  ProjectStage,
  PunchPriority,
  PunchStatus,
  RfiPriority,
  RfiStatus,
  WorkspaceRole,
} from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");

loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.prod") });
loadEnv({ path: resolve(backendRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.local"), override: true });

const DEMO_PREFIX = "[Landing]";
const FIELD_REPORT_MARKER = "landing-seed-v1";
const DEFAULT_PROJECT_ID = "cmnzdz9vj00018oitb9nos71w";

const prisma = new PrismaClient();

function utcNoon(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function buildDemoPdfKey(
  workspaceId: string,
  projectId: string,
  fileId: string,
  uploadId: string,
): string {
  return `ws/${workspaceId}/p/${projectId}/${fileId}/${uploadId}/blob.pdf`;
}

async function removePriorLandingContent(projectId: string) {
  await prisma.issue.deleteMany({
    where: { projectId, title: { startsWith: DEMO_PREFIX } },
  });
  await prisma.rfi.deleteMany({
    where: { projectId, title: { startsWith: DEMO_PREFIX } },
  });
  await prisma.punchItem.deleteMany({
    where: { projectId, title: { startsWith: DEMO_PREFIX } },
  });
  await prisma.scheduleTask.deleteMany({
    where: { projectId, title: { startsWith: DEMO_PREFIX }, parentId: null },
  });
  await prisma.fieldReport.deleteMany({
    where: { projectId, notes: FIELD_REPORT_MARKER },
  });
}

async function main() {
  const projectId = (process.env.SEED_LANDING_PROJECT_ID ?? DEFAULT_PROJECT_ID).trim();
  const replace =
    process.env.SEED_LANDING_REPLACE === "1" || process.env.SEED_LANDING_REPLACE === "true";
  const skipProject =
    process.env.SEED_LANDING_SKIP_PROJECT === "1" ||
    process.env.SEED_LANDING_SKIP_PROJECT === "true";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (use repo root .env.local or backend/.env).");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const workspaceId = project.workspaceId;

  const actorMembership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: WorkspaceRole.ADMIN },
    include: { user: true },
  });
  const anyMember = actorMembership
    ? null
    : await prisma.workspaceMember.findFirst({
        where: { workspaceId },
        include: { user: true },
      });
  const actorUserId = actorMembership?.userId ?? anyMember?.userId ?? null;

  if (actorUserId) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: actorUserId } },
      create: {
        projectId,
        userId: actorUserId,
        projectRole: ProjectMemberRole.INTERNAL,
      },
      update: {},
    });
  }

  if (replace) {
    await removePriorLandingContent(projectId);
    console.log(
      "Removed prior landing demo rows (issues, RFIs, punch, schedule roots, field reports).",
    );
  } else {
    const existing = await prisma.issue.count({
      where: { projectId, title: { startsWith: DEMO_PREFIX } },
    });
    if (existing > 0) {
      console.log(
        `Project already has ${existing} landing demo issues. Set SEED_LANDING_REPLACE=1 to remove and re-seed demo rows.`,
      );
      await prisma.$disconnect();
      return;
    }
  }

  if (!skipProject) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: "Riverside Office — Phase 2",
        projectNumber: "PS-2026-0148",
        projectType: "Commercial",
        location: "Austin, TX",
        stage: ProjectStage.CONSTRUCTION,
        progressPercent: 62,
        localBudget: "4850000.00",
        currency: "USD",
        projectSize: "142,000 sq ft · 6 levels",
        startDate: utcNoon(2025, 6, 1),
        endDate: utcNoon(2026, 11, 30),
      },
    });
    console.log("Updated project metadata for screenshot-friendly defaults.");
  }

  let drawingsFolder = await prisma.folder.findFirst({
    where: { projectId, name: "Drawings", parentId: null },
  });
  if (!drawingsFolder) {
    drawingsFolder = await prisma.folder.create({
      data: { projectId, name: "Drawings", parentId: null },
    });
  }

  const folderId = drawingsFolder.id;

  const demoFileName = "_Landing demo — L02 Architectural.pdf";
  let demoFile = await prisma.file.findFirst({
    where: { projectId, name: demoFileName, folderId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!demoFile) {
    const uploadId = randomUUID();
    demoFile = await prisma.file.create({
      data: {
        projectId,
        folderId,
        folderKey: folderId,
        name: demoFileName,
        mimeType: "application/pdf",
        disciplines: ["Architectural"],
      },
      include: { versions: true },
    });
    await prisma.fileVersion.create({
      data: {
        fileId: demoFile.id,
        version: 1,
        s3Key: buildDemoPdfKey(workspaceId, projectId, demoFile.id, uploadId),
        sizeBytes: 128_000n,
        label: "Issued for construction",
        uploadedById: actorUserId,
      },
    });
    demoFile = await prisma.file.findUniqueOrThrow({
      where: { id: demoFile.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
  }

  let fv = demoFile.versions[0];
  if (!fv) {
    const uploadId = randomUUID();
    fv = await prisma.fileVersion.create({
      data: {
        fileId: demoFile.id,
        version: 1,
        s3Key: buildDemoPdfKey(workspaceId, projectId, demoFile.id, uploadId),
        sizeBytes: 128_000n,
        label: "Issued for construction",
        uploadedById: actorUserId,
      },
    });
  }

  const sheetName = demoFile.name.replace(/\.pdf$/i, "");

  const issueSeeds: Array<{
    title: string;
    description: string;
    status: IssueStatus;
    priority: IssuePriority;
    location: string;
    pageNumber: number;
  }> = [
    {
      title: `${DEMO_PREFIX} Verify ceiling height at corridor grid C-4`,
      description: "GC walkthrough: confirm 9'-6\" AFF per spec 09 51 13 before drywall lid.",
      status: IssueStatus.OPEN,
      priority: IssuePriority.HIGH,
      location: "Level 2 · Corridor C-4",
      pageNumber: 3,
    },
    {
      title: `${DEMO_PREFIX} MEP clash — supply duct vs beam pocket`,
      description: 'Route 24" duct per reflected ceiling plan; structural shows pocket 22" clear.',
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.HIGH,
      location: "Level 3 · Zone M-12",
      pageNumber: 5,
    },
    {
      title: `${DEMO_PREFIX} Door hardware schedule mismatch (Set 12)`,
      description:
        "Hardware set calls for mortise; submittal shows cylindrical — align with owner spec.",
      status: IssueStatus.OPEN,
      priority: IssuePriority.MEDIUM,
      location: "Level 1 · Entry vestibule",
      pageNumber: 2,
    },
    {
      title: `${DEMO_PREFIX} Waterproofing detail at planter`,
      description: "Confirm liquid membrane terminations at threshold before stone install.",
      status: IssueStatus.RESOLVED,
      priority: IssuePriority.MEDIUM,
      location: "Level 4 · Terrace",
      pageNumber: 7,
    },
    {
      title: `${DEMO_PREFIX} Stair 2 guardrail anchorage`,
      description: "Post bases per detail 5/A-901 — field verify embed layout prior to pour-back.",
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.LOW,
      location: "Stair 2 · Level 2–3",
      pageNumber: 4,
    },
    {
      title: `${DEMO_PREFIX} IT pathway — add sleeves at slab`,
      description:
        "Low-voltage sleeves missing at grids G7–G8; coordinate coring window with PT vendor.",
      status: IssueStatus.CLOSED,
      priority: IssuePriority.LOW,
      location: "Level 5 · Open office",
      pageNumber: 6,
    },
  ];

  const createdIssues: { id: string; title: string }[] = [];
  for (const row of issueSeeds) {
    const issue = await prisma.issue.create({
      data: {
        workspaceId,
        projectId,
        fileId: demoFile.id,
        fileVersionId: fv.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        location: row.location,
        sheetName,
        sheetVersion: fv.version,
        pageNumber: row.pageNumber,
        issueKind: IssueKind.CONSTRUCTION,
        assigneeId: actorUserId,
        creatorId: actorUserId,
        dueDate: utcNoon(2026, 5, 1),
      },
    });
    createdIssues.push({ id: issue.id, title: issue.title });
  }

  const rfiMax = await prisma.rfi.aggregate({
    where: { projectId },
    _max: { rfiNumber: true },
  });
  let nextRfi = (rfiMax._max.rfiNumber ?? 0) + 1;

  const rfiA = await prisma.rfi.create({
    data: {
      projectId,
      rfiNumber: nextRfi++,
      title: `${DEMO_PREFIX} Confirm exterior metal panel module joint`,
      description:
        "Panel module is 4'-0\" per elevation; shop drawings show 3'-11\". Confirm module and reveal before fabrication.",
      status: RfiStatus.IN_REVIEW,
      priority: RfiPriority.HIGH,
      fromDiscipline: "Architectural",
      dueDate: utcNoon(2026, 4, 28),
      assignedToUserId: actorUserId,
      creatorId: actorUserId,
      fileId: demoFile.id,
      fileVersionId: fv.id,
      pageNumber: 1,
      pinNormX: 0.42,
      pinNormY: 0.36,
    },
  });

  await prisma.rfiMessage.create({
    data: {
      rfiId: rfiA.id,
      authorId: actorUserId,
      body: "Attached markup shows the joint in question on the north elevation. Can we get a written confirmation before CO?",
    },
  });

  await prisma.rfi.create({
    data: {
      projectId,
      rfiNumber: nextRfi++,
      title: `${DEMO_PREFIX} STC rating at conference rooms`,
      description:
        "Owner wants STC 50 at rooms 204–206; partition type on sheet A-502 shows STC 45 assembly.",
      status: RfiStatus.OPEN,
      priority: RfiPriority.MEDIUM,
      fromDiscipline: "Acoustical",
      dueDate: utcNoon(2026, 5, 6),
      creatorId: actorUserId,
      fileId: demoFile.id,
      fileVersionId: fv.id,
      pageNumber: 4,
    },
  });

  const rfiAnswered = await prisma.rfi.create({
    data: {
      projectId,
      rfiNumber: nextRfi++,
      title: `${DEMO_PREFIX} Roof drain leader routing`,
      description: "Confirm leader sizes at sump per civil sheet C-101 vs arch roof plan.",
      status: RfiStatus.ANSWERED,
      priority: RfiPriority.MEDIUM,
      fromDiscipline: "Plumbing",
      officialResponse:
        'Leaders are 4" to sump per civil; arch roof plan is schematic only — follow civil for sizing.',
      assignedToUserId: actorUserId,
      creatorId: actorUserId,
      fileId: demoFile.id,
      fileVersionId: fv.id,
      pageNumber: 8,
    },
  });

  await prisma.rfi.create({
    data: {
      projectId,
      rfiNumber: nextRfi++,
      title: `${DEMO_PREFIX} Expansion joint cover plate finish`,
      description: "Match anodized finish to adjacent storefront system — confirm submittal loop.",
      status: RfiStatus.CLOSED,
      priority: RfiPriority.LOW,
      officialResponse: "Approved as submitted 2026-04-02; field verify color under site lighting.",
      creatorId: actorUserId,
      assignedToUserId: actorUserId,
    },
  });

  await prisma.rfiIssueLink.create({
    data: {
      rfiId: rfiAnswered.id,
      issueId: createdIssues[1]!.id,
    },
  });

  const punchMax = await prisma.punchItem.aggregate({
    where: { projectId },
    _max: { punchNumber: true },
  });
  let nextPunch = (punchMax._max.punchNumber ?? 0) + 1;

  const punchRows = [
    {
      title: `${DEMO_PREFIX} Touch-up paint at baseboards — Level 2`,
      location: "Corridors 200 wing",
      trade: "Painting",
      priority: PunchPriority.P2,
      status: PunchStatus.OPEN,
    },
    {
      title: `${DEMO_PREFIX} Ceiling tile replacement (water stain)`,
      location: "Room 312",
      trade: "Drywall / Acoustical",
      priority: PunchPriority.P1,
      status: PunchStatus.IN_PROGRESS,
    },
    {
      title: `${DEMO_PREFIX} Label HVAC VAV boxes per ID schedule`,
      location: "Mechanical rooms MR-02, MR-03",
      trade: "HVAC",
      priority: PunchPriority.P2,
      status: PunchStatus.READY_FOR_GC,
    },
    {
      title: `${DEMO_PREFIX} Fire caulk at penetrations — east stair`,
      location: "Stair 3, levels 1–3",
      trade: "Firestopping",
      priority: PunchPriority.P1,
      status: PunchStatus.OPEN,
    },
    {
      title: `${DEMO_PREFIX} Clean glass at lobby curtain wall`,
      location: "Main lobby",
      trade: "Glazing",
      priority: PunchPriority.P3,
      status: PunchStatus.CLOSED,
    },
  ] as const;

  let firstPunchId: string | null = null;
  for (const p of punchRows) {
    const row = await prisma.punchItem.create({
      data: {
        projectId,
        punchNumber: nextPunch++,
        title: p.title,
        location: p.location,
        trade: p.trade,
        priority: p.priority,
        status: p.status,
        assigneeId: actorUserId,
        dueDate: utcNoon(2026, 4, 25),
      },
    });
    if (!firstPunchId) firstPunchId = row.id;
  }

  const rootSchedule = await prisma.scheduleTask.create({
    data: {
      projectId,
      title: `${DEMO_PREFIX} Core & shell`,
      parentId: null,
      sortOrder: 0,
      startDate: utcNoon(2025, 6, 1),
      endDate: utcNoon(2026, 2, 15),
      progressPercent: 88,
      status: "in_progress",
      isMilestone: false,
    },
  });

  await prisma.scheduleTask.createMany({
    data: [
      {
        projectId,
        parentId: rootSchedule.id,
        title: `${DEMO_PREFIX} Structure to level 4`,
        sortOrder: 0,
        startDate: utcNoon(2025, 6, 10),
        endDate: utcNoon(2025, 11, 20),
        progressPercent: 100,
        status: "completed",
        isMilestone: false,
      },
      {
        projectId,
        parentId: rootSchedule.id,
        title: `${DEMO_PREFIX} Enclosure / dry-in`,
        sortOrder: 1,
        startDate: utcNoon(2025, 10, 1),
        endDate: utcNoon(2026, 3, 10),
        progressPercent: 72,
        status: "delayed",
        isMilestone: false,
      },
      {
        projectId,
        parentId: rootSchedule.id,
        title: `${DEMO_PREFIX} MEP rough-in`,
        sortOrder: 2,
        startDate: utcNoon(2025, 12, 1),
        endDate: utcNoon(2026, 5, 30),
        progressPercent: 54,
        status: "in_progress",
        isMilestone: false,
      },
      {
        projectId,
        parentId: rootSchedule.id,
        title: `${DEMO_PREFIX} Tenant fit-out`,
        sortOrder: 3,
        startDate: utcNoon(2026, 2, 1),
        endDate: utcNoon(2026, 10, 15),
        progressPercent: 18,
        status: "not_started",
        isMilestone: false,
      },
    ],
  });

  await prisma.fieldReport.createMany({
    data: [
      {
        projectId,
        reportDate: utcNoon(2026, 4, 7),
        reportKind: "DAILY",
        status: "SUBMITTED",
        totalWorkers: 48,
        weather: "Partly cloudy, 74°F",
        authorLabel: "Site superintendent",
        photoCount: 6,
        issueCount: 2,
        notes: FIELD_REPORT_MARKER,
        details: {
          workPerformed: "Deck pour at level 5 grid E–H; MEP overhead rough-in corridors.",
          visitors: "Owner walkthrough 2:00 PM — no punch items added.",
        },
      },
      {
        projectId,
        reportDate: utcNoon(2026, 4, 8),
        reportKind: "DAILY",
        status: "SUBMITTED",
        totalWorkers: 52,
        weather: "Clear, 81°F",
        authorLabel: "Site superintendent",
        photoCount: 4,
        issueCount: 1,
        notes: FIELD_REPORT_MARKER,
        details: {
          workPerformed: "Drywall hanging level 3; firestopping inspections scheduled Thursday.",
        },
      },
      {
        projectId,
        reportDate: utcNoon(2026, 4, 9),
        reportKind: "DAILY",
        status: "DRAFT",
        totalWorkers: 36,
        weather: "Wind advisory PM",
        authorLabel: "Assistant superintendent",
        photoCount: 0,
        issueCount: 0,
        notes: FIELD_REPORT_MARKER,
        details: { workPerformed: "Stand-down for weather; interior finishes only." },
      },
    ],
  });

  if (actorUserId) {
    const now = new Date();
    await prisma.activityLog.createMany({
      data: [
        {
          workspaceId,
          projectId,
          actorUserId,
          type: ActivityType.ISSUE_CREATED,
          entityType: "issue",
          entityId: createdIssues[0]!.id,
          metadata: { title: createdIssues[0]!.title },
          createdAt: new Date(now.getTime() - 3_600_000),
        },
        {
          workspaceId,
          projectId,
          actorUserId,
          type: ActivityType.RFI_CREATED,
          entityType: "rfi",
          entityId: rfiA.id,
          metadata: { title: rfiA.title },
          createdAt: new Date(now.getTime() - 7_200_000),
        },
        {
          workspaceId,
          projectId,
          actorUserId,
          type: ActivityType.PUNCH_CREATED,
          entityType: "punch",
          entityId: firstPunchId,
          metadata: { title: punchRows[0]!.title },
          createdAt: new Date(now.getTime() - 86_400_000),
        },
      ],
    });
  }

  console.log("Landing demo seed complete.");
  console.log(`  Project: ${projectId}`);
  console.log(
    `  Demo PDF: ${demoFile.name} (upload a real PDF to S3 at the version key if you need the viewer to load.)`,
  );
  console.log(
    `  Issues: ${issueSeeds.length} · RFIs: 4 · Punch: ${punchRows.length} · Schedule: 1 root + 4 children · Field reports: 3`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
