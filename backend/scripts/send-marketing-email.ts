/**
 * Send PlanSync outreach emails to companies from an Excel (.xlsx) or CSV file.
 *
 * Requires RESEND_API_KEY in repo root .env (or .env.prod).
 * Sends from MARKETING_EMAIL_FROM (default: PlanSync <support@plansync.dev>).
 *
 * Examples (from repo root):
 *   npm run send:marketing:template
 *   npm run send:marketing -- --file marketing/recipients.xlsx --dry-run
 *   npm run send:marketing -- --file marketing/recipients.xlsx --confirm
 *   npm run send:marketing -- --file marketing/recipients.xlsx --confirm --limit 5
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Resend } from "resend";
import * as XLSX from "xlsx";
import {
  buildMarketingEmailHtml,
  buildMarketingEmailText,
  marketingEmailSubject,
  markMarketingRowsSent,
  parseMarketingRecipients,
  resolveMarketingAppUrl,
  type MarketingRecipient,
} from "../src/lib/marketingEmail.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");

loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.prod") });
loadEnv({ path: resolve(repoRoot, ".env.local"), override: true });

const DEFAULT_FROM = "PlanSync <support@plansync.dev>";
const DEFAULT_TEMPLATE = resolve(repoRoot, "marketing/recipients.template.xlsx");
const DEFAULT_PREVIEW = resolve(repoRoot, "marketing/email-preview.html");

type CliOptions = {
  file?: string;
  dryRun: boolean;
  confirm: boolean;
  limit?: number;
  delayMs: number;
  writeTemplate?: string;
  writePreview?: string;
  testTo?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, confirm: false, delayMs: 600 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--confirm") opts.confirm = true;
    else if (arg === "--file") opts.file = argv[++i];
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--delay-ms") opts.delayMs = Number(argv[++i]);
    else if (arg === "--write-template") opts.writeTemplate = argv[++i] ?? DEFAULT_TEMPLATE;
    else if (arg === "--preview") opts.writePreview = argv[++i] ?? DEFAULT_PREVIEW;
    else if (arg === "--test-to") opts.testTo = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`PlanSync marketing email sender

Usage:
  npm run send:marketing:template
  npm run send:marketing:preview
  npm run send:marketing:preview:open
  npm run send:marketing -- --file marketing/recipients.xlsx [--dry-run] [--confirm] [--limit N]

Options:
  --file <path>           Excel (.xlsx) or CSV: email, company (optional), name (optional), sent (optional)
  --write-template [path] Write an empty Excel template (default: marketing/recipients.template.xlsx)
  --preview [path]        Write HTML preview (default: marketing/email-preview.html)
  --dry-run               Preview recipients and subjects without sending
  --confirm               Required to actually send (safety gate)
  --limit <n>             Send to at most N recipients
  --delay-ms <ms>         Pause between sends (default: 600)
  --test-to <email>       Send one preview email to this address (uses first row for personalization)
  --help                  Show this help

Environment:
  RESEND_API_KEY          Required to send (from Resend dashboard)
  MARKETING_EMAIL_FROM    Default: ${DEFAULT_FROM}
  MARKETING_APP_URL        Links and images in outreach emails (default: https://plansync.dev when PUBLIC_APP_URL is localhost)
  PUBLIC_APP_URL          Fallback when not localhost (ignored for localhost in favor of plansync.dev)
`);
}

function writeTemplate(outPath: string): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["email", "company", "name", "sent"],
    ["contact@example.com", "Acme Construction", "Alex", false],
    ["ops@example.org", "BuildCo FM", "", false],
  ]);
  ws["!cols"] = [{ wch: 32 }, { wch: 28 }, { wch: 20 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws, "Recipients");
  writeFileSync(outPath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`Wrote template: ${outPath}`);
}

/** Default origin for `npm run send:marketing:preview:open` (live-server port). */
const MARKETING_PREVIEW_ORIGIN = "http://127.0.0.1:8765";

function writePreview(outPath: string): void {
  const publicAppUrl = resolveMarketingAppUrl(process.env.PUBLIC_APP_URL);
  const html = buildMarketingEmailHtml(
    { email: "preview@example.com", company: "Acme Construction", name: "Alex" },
    { publicAppUrl, embedVideo: true, previewOrigin: MARKETING_PREVIEW_ORIGIN },
  );
  writeFileSync(outPath, html);
  // Keep CI `prettier --check` green after regenerating this checked-in artifact.
  const prettier = spawnSync("npx", ["prettier", "--write", outPath], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (prettier.status !== 0) {
    throw new Error(`Prettier failed on ${outPath} (exit ${prettier.status ?? "?"})`);
  }
  console.log(`Wrote preview: ${outPath}`);
}

function resolveRecipientsFilePath(fileArg: string): string {
  const candidates = [
    resolve(fileArg),
    resolve(repoRoot, fileArg),
    resolve(process.cwd(), fileArg),
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (existsSync(candidate)) return candidate;
  }

  const marketingDir = resolve(repoRoot, "marketing");
  let hint = "";
  if (existsSync(marketingDir)) {
    const xlsx = readdirSync(marketingDir).filter((f) => f.endsWith(".xlsx") || f.endsWith(".csv"));
    if (xlsx.length) {
      hint = `\nFiles in marketing/: ${xlsx.join(", ")}\nIf you edited the template, use:\n  --file marketing/recipients.template.xlsx\nOr save a copy as marketing/recipients.xlsx`;
    }
  }
  throw new Error(`File not found: ${fileArg}${hint}`);
}

function loadRowsFromFile(filePath: string): Record<string, unknown>[] {
  const buf = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  if (ext === ".csv") {
    const text = buf.toString("utf8");
    const wb = XLSX.read(text, { type: "string" });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
  }
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
}

function saveRowsToFile(filePath: string, rows: Record<string, unknown>[]): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Recipients");
  const ext = extname(filePath).toLowerCase();
  if (ext === ".csv") {
    writeFileSync(filePath, XLSX.utils.sheet_to_csv(ws));
    return;
  }
  writeFileSync(filePath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendOne(
  resend: Resend,
  from: string,
  recipient: MarketingRecipient,
  publicAppUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const subject = marketingEmailSubject();
  const html = buildMarketingEmailHtml(recipient, { publicAppUrl });
  const text = buildMarketingEmailText(recipient);

  const { error } = await resend.emails.send({
    from,
    to: recipient.email,
    replyTo: "support@plansync.dev",
    subject,
    html,
    text,
  });

  if (error) return { ok: false, error: error.message ?? "Resend rejected the email" };
  return { ok: true };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.writeTemplate) {
    writeTemplate(resolve(opts.writeTemplate));
    return;
  }

  if (opts.writePreview) {
    writePreview(resolve(opts.writePreview));
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MARKETING_EMAIL_FROM?.trim() || DEFAULT_FROM;
  const publicAppUrl = resolveMarketingAppUrl(process.env.PUBLIC_APP_URL);

  if (opts.testTo) {
    if (!apiKey && !opts.dryRun) {
      console.error("RESEND_API_KEY is required. Set it in .env at the repo root.");
      process.exit(1);
    }
    const sample: MarketingRecipient = {
      email: opts.testTo.trim().toLowerCase(),
      company: "Sample Construction Co.",
      name: "Alex",
      rowIndex: 0,
    };
    if (opts.dryRun) {
      console.log(`[dry-run] Would send test to ${sample.email}`);
      console.log(`Subject: ${marketingEmailSubject()}`);
      return;
    }
    const resend = new Resend(apiKey!);
    console.log(`Using app URL for links/images: ${publicAppUrl}`);
    const result = await sendOne(resend, from, { ...sample, email: opts.testTo }, publicAppUrl);
    if (!result.ok) {
      console.error(`Test send failed: ${result.error}`);
      process.exit(1);
    }
    console.log(`Test email sent to ${opts.testTo}`);
    return;
  }

  if (!opts.file) {
    printHelp();
    process.exit(1);
  }

  const filePath = resolveRecipientsFilePath(opts.file);
  let rows = loadRowsFromFile(filePath);
  const { recipients, skipped, alreadySent } = parseMarketingRecipients(rows);
  let toSend = recipients;
  if (opts.limit != null && opts.limit > 0) {
    toSend = recipients.slice(0, opts.limit);
  }

  console.log(`Loaded ${filePath}`);
  console.log(`  Valid recipients (not sent yet): ${recipients.length}`);
  if (alreadySent) console.log(`  Already sent (skipped): ${alreadySent}`);
  if (skipped.length) console.log(`  Skipped rows: ${skipped.length}`);
  if (opts.limit) console.log(`  Sending to: ${toSend.length} (limit ${opts.limit})`);

  if (skipped.length) {
    for (const s of skipped.slice(0, 10)) {
      console.log(`    row ${s.row}: ${s.reason}`);
    }
    if (skipped.length > 10) console.log(`    … and ${skipped.length - 10} more`);
  }

  if (toSend.length === 0) {
    console.error("No valid recipients to send to (all sent, invalid, or empty).");
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log(`\n[dry-run] Would send to ${toSend.length} recipient(s):`);
    for (const r of toSend) {
      const parts = [r.email];
      if (r.company) parts.push(r.company);
      if (r.name) parts.push(r.name);
      console.log(`  → ${parts.join(" · ")}`);
    }
    console.log(`\nSubject: ${marketingEmailSubject()}`);
    console.log(`From: ${from}`);
    console.log("\nRe-run with --confirm to send.");
    return;
  }

  if (!opts.confirm) {
    console.error("\nRefusing to send without --confirm. Run with --dry-run first to preview.");
    process.exit(1);
  }

  if (!apiKey) {
    console.error("RESEND_API_KEY is required. Set it in .env at the repo root.");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;
  const sentRowIndices: number[] = [];

  console.log(`\nSending from ${from} …\n`);

  for (const recipient of toSend) {
    const result = await sendOne(resend, from, recipient, publicAppUrl);
    if (result.ok) {
      sent++;
      sentRowIndices.push(recipient.rowIndex);
      console.log(`  ✓ ${recipient.email}`);
    } else {
      failed++;
      console.error(`  ✗ ${recipient.email}: ${result.error}`);
    }
    if (opts.delayMs > 0 && sent + failed < toSend.length) {
      await sleep(opts.delayMs);
    }
  }

  if (sentRowIndices.length > 0) {
    rows = markMarketingRowsSent(rows, sentRowIndices);
    saveRowsToFile(filePath, rows);
    console.log(`\nUpdated ${filePath} — marked ${sentRowIndices.length} row(s) sent=true`);
  }

  console.log(`\nDone. Sent: ${sent}, failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
