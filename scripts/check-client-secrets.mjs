import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SECRET_PREFIXES = ["sb_secret_", "sk_live_", "sk_test_"];

const SECRET_VALUE_PATTERNS = [
  /sb_secret_[A-Za-z0-9_-]{8,}/,
  /sk_live_[A-Za-z0-9]{8,}/,
  /sk_test_[A-Za-z0-9]{8,}/,
];

export const SECRET_ENV_NAMES = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SMS_API_KEY",
  "SMS_CLIENT_ID",
  "PAYSTACK_SECRET_KEY",
  "SENTRY_AUTH_TOKEN",
  "ADMIN_EMAILS",
];

const PUBLIC_SECRET_ALIASES = SECRET_ENV_NAMES.map((name) => `NEXT_PUBLIC_${name}`);
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".css", ".json", ".txt", ".map", ".html", ".ts", ".tsx"]);

export function findingsIn(text, { source = false } = {}) {
  const found = [];
  if (source) {
    for (const token of SECRET_PREFIXES) {
      if (text.includes(token)) found.push(token);
    }
  } else {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.test(text)) found.push(pattern.source);
    }
  }
  for (const name of SECRET_ENV_NAMES) {
    if (text.includes(`process.env.${name}`)) found.push(`process.env.${name}`);
  }
  for (const token of PUBLIC_SECRET_ALIASES) {
    if (text.includes(token)) found.push(token);
  }
  return found;
}

async function walk(dir) {
  const files = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      files.push(...(await walk(full)));
      continue;
    }
    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

async function clientSourceFiles() {
  const files = new Set();
  for (const dir of ["src/components", "src/context", "src/app"]) {
    for (const file of await walk(path.join(root, dir))) files.add(file);
  }
  for (const file of await walk(path.join(root, "src"))) {
    const text = await readFile(file, "utf8");
    if (text.includes('"use client"') || text.includes("'use client'")) files.add(file);
  }
  return [...files];
}

export async function scanClientSecrets() {
  const problems = [];
  for (const file of await clientSourceFiles()) {
    const text = await readFile(file, "utf8");
    const found = findingsIn(text, { source: true });
    if (found.length) problems.push(`${path.relative(root, file)}: ${found.join(", ")}`);
  }

  const bundleDir = path.join(root, ".next", "static");
  const bundleFiles = await walk(bundleDir);
  if (!bundleFiles.length) {
    problems.push(".next/static is missing. Run npm run build before npm run check:secrets.");
  }
  for (const file of bundleFiles) {
    const text = await readFile(file, "utf8");
    const found = findingsIn(text);
    if (found.length) problems.push(`${path.relative(root, file)}: ${found.join(", ")}`);
  }
  return problems;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const problems = await scanClientSecrets();
  if (problems.length) {
    console.error("Client bundle or client source contains secret material:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log("Client bundle and client source do not contain secret keys.");
}
