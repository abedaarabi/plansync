/**
 * Dev seed: Better Auth user (email/password) + workspace with Pro status (no Stripe).
 * Requires DATABASE_URL (e.g. repo root `.env`, `.env.local`, or `backend/.env`).
 *
 *   SEED_USER_EMAIL     default dev@plansync.local
 *   SEED_USER_PASSWORD  default devpassword123
 *   SEED_WORKSPACE_SLUG default dev
 *   SEED_WORKSPACE_ID   optional existing workspace id (takes precedence)
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, WorkspaceRole } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../.env") });
loadEnv({ path: resolve(__dirname, "../../.env.prod") });
loadEnv({ path: resolve(__dirname, "../.env") });
loadEnv({ path: resolve(__dirname, "../../.env.local"), override: true });

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_USER_EMAIL ?? "dev@plansync.local").trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD ?? "devpassword123";
  const slug = (process.env.SEED_WORKSPACE_SLUG ?? "dev").trim().toLowerCase();
  const workspaceId = process.env.SEED_WORKSPACE_ID?.trim() || null;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Add it to the repo root `.env` or `.env.local` or `backend/.env` (same URL you use for Postgres).",
    );
  }

  const passwordHash = await hashPassword(password);

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Dev User",
        email,
        emailVerified: true,
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, name: "Dev User" },
    });
    const cred = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (!cred) {
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        },
      });
    } else {
      await prisma.account.update({
        where: { id: cred.id },
        data: { password: passwordHash, accountId: user.id },
      });
    }
  }

  const workspace = workspaceId
    ? await prisma.workspace.findUnique({ where: { id: workspaceId } })
    : await prisma.workspace.upsert({
        where: { slug },
        create: {
          name: "Development",
          slug,
          subscriptionStatus: "active",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
        },
        update: {
          subscriptionStatus: "active",
        },
      });
  if (!workspace) {
    throw new Error(`Workspace not found for SEED_WORKSPACE_ID=${workspaceId}`);
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.ADMIN,
    },
    update: { role: WorkspaceRole.ADMIN },
  });

  const seedMaterials: Array<{
    type: string;
    name: string;
    unit: string;
    unitPrice: string;
    currency?: string;
    sku?: string;
    supplier?: string;
    specification?: string;
  }> = [
    {
      type: "Concrete",
      name: "Ready-mix 25 MPa",
      unit: "m³",
      unitPrice: "92.50",
      sku: "CONC-25",
      supplier: "Metro Concrete",
    },
    {
      type: "Concrete",
      name: "Ready-mix 35 MPa",
      unit: "m³",
      unitPrice: "106.00",
      sku: "CONC-35",
      supplier: "Metro Concrete",
    },
    {
      type: "Reinforcement",
      name: "Rebar 12mm",
      unit: "kg",
      unitPrice: "1.08",
      sku: "REB-12",
      supplier: "SteelOne",
    },
    {
      type: "Reinforcement",
      name: "Rebar 16mm",
      unit: "kg",
      unitPrice: "1.12",
      sku: "REB-16",
      supplier: "SteelOne",
    },
    {
      type: "Masonry",
      name: "Concrete Block 200mm",
      unit: "ea",
      unitPrice: "1.95",
      sku: "BLK-200",
      supplier: "BlockWorks",
    },
    {
      type: "Masonry",
      name: "Cement Mortar",
      unit: "m³",
      unitPrice: "68.40",
      sku: "MORT-01",
      supplier: "BuildChem",
    },
    {
      type: "Formwork",
      name: "Plywood Formwork 18mm",
      unit: "m²",
      unitPrice: "11.25",
      sku: "FORM-P18",
      supplier: "TimberPro",
    },
    {
      type: "Steel",
      name: "Structural Steel Beam",
      unit: "kg",
      unitPrice: "1.45",
      sku: "STL-BEAM",
      supplier: "SteelOne",
    },
    {
      type: "Plaster",
      name: "Internal Plaster",
      unit: "m²",
      unitPrice: "4.10",
      sku: "PLS-INT",
      supplier: "BuildChem",
    },
    {
      type: "Paint",
      name: "Acrylic Wall Paint",
      unit: "m²",
      unitPrice: "2.35",
      sku: "PNT-ACR",
      supplier: "ColorLine",
    },
    {
      type: "Flooring",
      name: "Ceramic Tile 600x600",
      unit: "m²",
      unitPrice: "14.80",
      sku: "TILE-600",
      supplier: "TileHub",
    },
    {
      type: "Flooring",
      name: "Screed 50mm",
      unit: "m²",
      unitPrice: "5.95",
      sku: "SCR-50",
      supplier: "BuildChem",
    },
    {
      type: "MEP",
      name: "PVC Pipe 100mm",
      unit: "m",
      unitPrice: "6.75",
      sku: "PVC-100",
      supplier: "FlowTech",
    },
    {
      type: "Openings",
      name: "Door Set Standard",
      unit: "ea",
      unitPrice: "185.00",
      sku: "DR-STD",
      supplier: "JoineryCo",
    },
    {
      type: "Openings",
      name: "Aluminium Window Set",
      unit: "ea",
      unitPrice: "240.00",
      sku: "WIN-AL",
      supplier: "FrameWorks",
    },
  ];

  for (const m of seedMaterials) {
    const typeKey = m.type.trim().toLowerCase().replace(/\s+/g, " ");
    const nameKey = m.name.trim().toLowerCase().replace(/\s+/g, " ");
    const category = await prisma.materialCategory.upsert({
      where: { workspaceId_nameKey: { workspaceId: workspace.id, nameKey: typeKey } },
      create: {
        workspaceId: workspace.id,
        name: m.type.trim(),
        nameKey: typeKey,
      },
      update: {},
    });
    await prisma.material.upsert({
      where: {
        workspaceId_categoryId_nameKey: {
          workspaceId: workspace.id,
          categoryId: category.id,
          nameKey,
        },
      },
      create: {
        workspaceId: workspace.id,
        categoryId: category.id,
        name: m.name.trim(),
        nameKey,
        sku: m.sku ?? null,
        unit: m.unit,
        unitPrice: m.unitPrice,
        currency: m.currency ?? "USD",
        supplier: m.supplier ?? null,
        specification: m.specification ?? null,
      },
      update: {
        sku: m.sku ?? null,
        unit: m.unit,
        unitPrice: m.unitPrice,
        currency: m.currency ?? "USD",
        supplier: m.supplier ?? null,
        specification: m.specification ?? null,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(
    `  Workspace: ${workspace.name} (${workspace.slug}) — subscriptionStatus=active (no Stripe)`,
  );
  console.log("  Materials seeded: 15");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
