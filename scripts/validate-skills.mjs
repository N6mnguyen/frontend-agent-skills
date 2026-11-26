#!/usr/bin/env node
// Validates every skills/<category>/<name>/SKILL.md against the Agent Skills spec
// (https://agentskills.io/specification) plus this repo's authoring rules.
// Zero dependencies. Exit 1 on any error.
// ponytail: hand-rolled frontmatter parser supports only the subset we allow
// (scalar `key: value` + one-level `metadata:` map). Swap for `yaml` if the spec grows.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');
const CATEGORIES = ['shared', 'react', 'angular'];
const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const REQUIRED_METADATA = ['category', 'version'];
const REQUIRED_SECTIONS = ['Purpose', 'When to Use', 'Workflow', 'Best Practices', 'Anti-patterns', 'Implementation Examples', 'Validation Checklist'];
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_LINES = 500;

const errors = [];
const warnings = [];
let verifyCount = 0;
const err = (file, msg) => { errors.push(`${relative(ROOT, file)}: ${msg}`); };
const warn = (file, msg) => { warnings.push(`${relative(ROOT, file)}: ${msg}`); };

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) throw new Error('missing YAML frontmatter (must start at line 1 with ---)');
  const data = {};
  let current = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const nested = raw.match(/^ {2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nested) {
      if (!current) throw new Error(`indented line outside a map: "${raw}"`);
      data[current][nested[1]] = unquote(nested[2]);
      continue;
    }
    const top = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!top) throw new Error(`unsupported YAML line: "${raw}"`);
    const [, key, value] = top;
    if (key in data) throw new Error(`duplicate key "${key}"`);
    if (value === '') { data[key] = {}; current = key; }
    else { data[key] = unquote(value); current = null; }
  }
  return { data, body: text.slice(m[0].length), bodyStartLine: m[0].split('\n').length };
}

function unquote(v) {
  const s = v.trim();
  if (/^(['"]).*\1$/.test(s)) return s.slice(1, -1);
  if (/^[>|]/.test(s)) throw new Error('block scalars (> or |) are not supported; keep values on one line');
  return s;
}

function stripCode(body) {
  // Remove fenced blocks and inline code so links/headings inside code are ignored.
  return body.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
}

function checkFences(file, body) {
  let open = null;
  body.split(/\r?\n/).forEach((line, i) => {
    const f = line.match(/^\s*(```|~~~)/);
    if (!f) return;
    if (!open) open = { fence: f[1], line: i + 1 };
    else if (f[1] === open.fence) open = null;
  });
  if (open) err(file, `unclosed code fence opened at body line ${open.line}`);
}

function checkLinks(file, body, skillDir) {
  for (const [, target] of stripCode(body).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURIComponent(target.split('#')[0]);
    const abs = resolve(dirname(file), path);
    if (!existsSync(abs)) { err(file, `broken link: ${target}`); continue; }
    if (!abs.startsWith(skillDir)) err(file, `link escapes the skill folder (skills install independently): ${target}`);
  }
}

function validateSkill(category, dirName) {
  const skillDir = join(SKILLS, category, dirName);
  const file = join(skillDir, 'SKILL.md');
  if (!existsSync(file)) return err(skillDir, 'missing SKILL.md');
  const text = readFileSync(file, 'utf8');

  let fm;
  try { fm = parseFrontmatter(text); } catch (e) { return err(file, e.message); }
  const { data, body } = fm;

  for (const key of Object.keys(data)) if (!ALLOWED_KEYS.has(key)) err(file, `unknown frontmatter key "${key}"`);

  const { name, description, compatibility, metadata } = data;
  if (typeof name !== 'string' || !name) err(file, 'name is required');
  else {
    if (name.length > 64) err(file, 'name exceeds 64 chars');
    if (!NAME_RE.test(name)) err(file, `name "${name}" must be lowercase a-z0-9 with single hyphens, no leading/trailing hyphen`);
    if (name !== dirName) err(file, `name "${name}" must match directory "${dirName}"`);
  }
  if (typeof description !== 'string' || !description) err(file, 'description is required');
  else {
    if (description.length > 1024) err(file, `description is ${description.length} chars (max 1024)`);
    if (!/\bUse when\b/i.test(description)) err(file, 'description must include a "Use when ..." trigger clause');
    if (description.length < 120) warn(file, 'description is short; add concrete trigger keywords');
  }
  if (compatibility !== undefined && (typeof compatibility !== 'string' || compatibility.length > 500)) err(file, 'compatibility must be a string of 1-500 chars');
  if (metadata === undefined || typeof metadata !== 'object') err(file, 'metadata map is required');
  else {
    for (const k of REQUIRED_METADATA) if (!metadata[k]) err(file, `metadata.${k} is required`);
    if (metadata.category && metadata.category !== category) err(file, `metadata.category "${metadata.category}" must be "${category}"`);
    if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) err(file, 'metadata.version must be semver (quote it: "1.0.0")');
  }

  const lines = text.split(/\r?\n/).length;
  if (lines > MAX_LINES) err(file, `${lines} lines (max ${MAX_LINES}); move detail into references/`);

  const headings = [...stripCode(body).matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
  for (const s of REQUIRED_SECTIONS) if (!headings.includes(s)) err(file, `missing required section "## ${s}"`);
  if (!/^#\s+\S/m.test(stripCode(body))) err(file, 'missing H1 title');

  checkFences(file, body);
  checkLinks(file, body, skillDir);
  verifyCount += (body.match(/\[VERIFY\]/g) || []).length;

  // references/ files: must be linked from SKILL.md and have valid links/fences themselves.
  const refDir = join(skillDir, 'references');
  if (existsSync(refDir)) {
    for (const ref of readdirSync(refDir)) {
      const refFile = join(refDir, ref);
      if (!ref.endsWith('.md')) continue;
      if (!body.includes(`references/${ref}`)) warn(refFile, 'not referenced from SKILL.md (agents will never load it)');
      const refText = readFileSync(refFile, 'utf8');
      const refLines = refText.split(/\r?\n/).length;
      if (refLines > MAX_LINES) err(refFile, `${refLines} lines (max ${MAX_LINES}); split into smaller reference files`);
      checkFences(refFile, refText);
      checkLinks(refFile, refText, skillDir);
      verifyCount += (refText.match(/\[VERIFY\]/g) || []).length;
    }
  }
  return name;
}

// Importing for tests must not run the scan.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
const seen = new Map();
for (const entry of readdirSync(SKILLS)) {
  if (!statSync(join(SKILLS, entry)).isDirectory()) continue;
  if (!CATEGORIES.includes(entry)) { err(join(SKILLS, entry), `unknown category (allowed: ${CATEGORIES.join(', ')})`); continue; }
  for (const dirName of readdirSync(join(SKILLS, entry))) {
    const p = join(SKILLS, entry, dirName);
    if (!statSync(p).isDirectory()) { err(p, 'unexpected file; each skill must be a directory'); continue; }
    if (!NAME_RE.test(dirName)) err(p, 'directory name must be kebab-case');
    const name = validateSkill(entry, dirName);
    if (name) {
      if (seen.has(name)) err(p, `duplicate skill name "${name}" (also in ${seen.get(name)}); the CLI installs by name`);
      seen.set(name, relative(ROOT, p));
    }
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\n${seen.size} skills, ${errors.length} errors, ${warnings.length} warnings, ${verifyCount} [VERIFY] markers`);
process.exit(errors.length ? 1 : 0);
}
