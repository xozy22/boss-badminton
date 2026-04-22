#!/usr/bin/env node
// scripts/check-i18n-keys.mjs
//
// Scans src/lib/i18n/types.ts for all key names defined on the Translations
// interface, then grep all *.ts/*.tsx files under src/ for references.
// Reports unused keys and — as a separate section — keys that exist in the
// types but are missing from en.ts / de.ts (catches typos after renames).
//
// Usage: node scripts/check-i18n-keys.mjs
//
// A key is considered "used" if we find `t.<key>` or `.<key>` or a quoted
// "<key>" literal. That covers direct access, destructured access, and
// dynamic lookups like `t[foo]` with a const-string `foo`.
//
// Exits 0 when everything is clean, 1 otherwise — so you can wire it into
// CI if desired.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");
const srcDir = join(repoRoot, "src");

const TYPES_FILE = join(srcDir, "lib", "i18n", "types.ts");
const EN_FILE = join(srcDir, "lib", "i18n", "en.ts");
const DE_FILE = join(srcDir, "lib", "i18n", "de.ts");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

function extractKeysFromTypes(src) {
  // Match lines like `  key_name: string;` within the Translations interface.
  const keys = new Set();
  const re = /^\s+([a-z][a-zA-Z0-9_]*)\s*:\s*string\s*;/gm;
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

function extractKeysFromTranslationFile(src) {
  // Match lines like `  key_name: "...",` within a const object.
  const keys = new Set();
  const re = /^\s+([a-z][a-zA-Z0-9_]*)\s*:\s*["'`]/gm;
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

// ---- main ----------------------------------------------------------------

const typesSrc = readFileSync(TYPES_FILE, "utf8");
const enSrc = readFileSync(EN_FILE, "utf8");
const deSrc = readFileSync(DE_FILE, "utf8");

const declaredKeys = extractKeysFromTypes(typesSrc);
const enKeys = extractKeysFromTranslationFile(enSrc);
const deKeys = extractKeysFromTranslationFile(deSrc);

if (declaredKeys.size === 0) {
  console.error("Could not parse any keys from", TYPES_FILE);
  process.exit(2);
}

// Scan src/ (excluding i18n folder itself).
const allFiles = walk(srcDir).filter(
  (p) => !p.includes(join("lib", "i18n"))
);

// Build one big haystack instead of re-reading for each key.
const haystackParts = allFiles.map((p) => readFileSync(p, "utf8"));
const haystack = haystackParts.join("\n");

// For each key, check if it appears as `t.key`, `.key`, or `"key"`.
const unused = [];
for (const key of declaredKeys) {
  const direct = new RegExp(`[.\\[]\\s*${key}\\b`);
  const quoted = new RegExp(`["'\`]${key}["'\`]`);
  if (!direct.test(haystack) && !quoted.test(haystack)) {
    unused.push(key);
  }
}
unused.sort();

const missingInEn = [...declaredKeys].filter((k) => !enKeys.has(k)).sort();
const missingInDe = [...declaredKeys].filter((k) => !deKeys.has(k)).sort();
const extraInEn = [...enKeys].filter((k) => !declaredKeys.has(k)).sort();
const extraInDe = [...deKeys].filter((k) => !declaredKeys.has(k)).sort();

console.log(`Declared keys (types.ts): ${declaredKeys.size}`);
console.log(`en.ts keys: ${enKeys.size}`);
console.log(`de.ts keys: ${deKeys.size}`);
console.log(`Source files scanned: ${allFiles.length}`);
console.log();

let failed = false;

if (unused.length > 0) {
  failed = true;
  console.log(`⚠ Unused keys (${unused.length}):`);
  for (const k of unused) console.log(`   ${k}`);
  console.log();
}

if (missingInEn.length > 0) {
  failed = true;
  console.log(`✗ Missing in en.ts (${missingInEn.length}):`);
  for (const k of missingInEn) console.log(`   ${k}`);
  console.log();
}
if (missingInDe.length > 0) {
  failed = true;
  console.log(`✗ Missing in de.ts (${missingInDe.length}):`);
  for (const k of missingInDe) console.log(`   ${k}`);
  console.log();
}
if (extraInEn.length > 0) {
  failed = true;
  console.log(`✗ Extra in en.ts (not in types.ts) (${extraInEn.length}):`);
  for (const k of extraInEn) console.log(`   ${k}`);
  console.log();
}
if (extraInDe.length > 0) {
  failed = true;
  console.log(`✗ Extra in de.ts (not in types.ts) (${extraInDe.length}):`);
  for (const k of extraInDe) console.log(`   ${k}`);
  console.log();
}

if (!failed) {
  console.log("✓ All i18n keys are used and consistent across en.ts / de.ts.");
  process.exit(0);
}

// Summary line.
console.log(
  `Summary: ${unused.length} unused, ` +
    `${missingInEn.length} missing EN, ${missingInDe.length} missing DE, ` +
    `${extraInEn.length} extra EN, ${extraInDe.length} extra DE.`
);
console.log(`Scanned from: ${relative(repoRoot, srcDir)}`);
process.exit(1);
