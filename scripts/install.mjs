#!/usr/bin/env node
// Interactive framework-bundle installer. Run from the target application root.
// Skill names come from skills/<category>/ folders; name/uniqueness rules live in validate-skills.mjs.
import { createInterface, emitKeypressEvents } from 'node:readline';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { styleText } from 'node:util';

const SOURCE = 'N6mnguyen/frontend-agent-skills';
const SKILLS_CLI = 'skills@1.9.0';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FRAMEWORKS = { react: 'React + TypeScript', angular: 'Angular + TypeScript' };
export const CATEGORIES = ['shared', ...Object.keys(FRAMEWORKS)];
// Project install paths, per the Skills CLI agent table (see README "Agent compatibility").
export const AGENTS = [
  { id: 'claude-code', label: 'Claude Code', path: '.claude/skills/' },
  { id: 'cursor', label: 'Cursor', path: '.agents/skills/' },
  { id: 'github-copilot', label: 'GitHub Copilot', path: '.agents/skills/' },
  { id: 'codex', label: 'OpenAI Codex', path: '.agents/skills/' },
  { id: 'windsurf', label: 'Windsurf', path: '.windsurf/skills/' },
  { id: 'gemini-cli', label: 'Gemini CLI', path: '.agents/skills/' },
  { id: 'opencode', label: 'OpenCode', path: '.agents/skills/' },
];

export function discoverSkills(root = ROOT) {
  return Object.fromEntries(CATEGORIES.map((category) => {
    const dir = join(root, 'skills', category);
    const names = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort();
    return [category, names];
  }));
}

export function resolveBundle(framework, skills = discoverSkills()) {
  const key = String(framework).toLowerCase();
  if (!(key in FRAMEWORKS)) throw new Error(`Unknown framework "${framework}". Choose: ${Object.keys(FRAMEWORKS).join(', ')}.`);
  return [...skills[key], ...skills.shared];
}

// Preselects the framework the target project already depends on.
export function detectFramework(cwd = process.cwd()) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return '@angular/core' in deps ? 'angular' : 'react' in deps ? 'react' : undefined;
  } catch {
    return undefined;
  }
}

const { stdin, stdout } = process;

// Arrow-key menu on a TTY; numbered prompt when input is piped (CI, scripts).
function select(title, options, initial = 0) {
  if (!stdin.isTTY) return selectByNumber(title, options);
  return new Promise((done) => {
    let index = initial;
    const draw = () => options.forEach((o, i) => stdout.write(`\x1b[2K${i === index ? styleText('cyan', `❯ ${o.label}`) : `  ${o.label}`}${o.hint ? styleText('dim', `  ${o.hint}`) : ''}\n`));
    const cleanup = () => { stdin.off('keypress', onKey); stdin.setRawMode(false); stdin.pause(); stdout.write('\x1b[?25h'); };
    const onKey = (_, key = {}) => {
      if (key.ctrl && key.name === 'c') { cleanup(); stdout.write('\n'); process.exit(130); }
      if (key.name === 'up' || key.name === 'k') index = (index - 1 + options.length) % options.length;
      else if (key.name === 'down' || key.name === 'j') index = (index + 1) % options.length;
      else if (/^[1-9]$/.test(key.sequence) && Number(key.sequence) <= options.length) index = Number(key.sequence) - 1;
      else if (key.name === 'return') {
        cleanup();
        stdout.write(`\x1b[${options.length + 1}A\x1b[0J${styleText('green', '✔')} ${title} ${styleText('cyan', options[index].label)}\n`);
        return done(index);
      } else return;
      stdout.write(`\x1b[${options.length}A`);
      draw();
    };
    stdout.write(`${styleText('cyan', '?')} ${styleText('bold', title)} ${styleText('dim', '(↑/↓ then Enter)')}\n\x1b[?25l`);
    draw();
    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('keypress', onKey);
  });
}

// One shared line iterator: piped input arrives at once, and a fresh readline per question would drop lines.
let pipedRl, pipedLines;
async function selectByNumber(title, options) {
  pipedRl ??= createInterface({ input: stdin });
  pipedLines ??= pipedRl[Symbol.asyncIterator]();
  console.log(title);
  options.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}`));
  stdout.write(`Choose [1-${options.length}]: `);
  const { value = '' } = await pipedLines.next();
  console.log(value);
  const index = Number(value.trim()) - 1;
  if (Number.isInteger(index) && index >= 0 && index < options.length) return index;
  throw new Error(`Choose a number from 1 to ${options.length}.`);
}

async function main() {
  const skills = discoverSkills();
  console.log(`\n${styleText(['bold', 'cyan'], '◆ Frontend Agent Skills')}\n${styleText('dim', '  Installs a complete React or Angular skill bundle into this project.')}\n`);

  const keys = Object.keys(FRAMEWORKS);
  const detected = detectFramework();
  const frameworkOptions = keys.map((key) => ({
    label: FRAMEWORKS[key],
    hint: `${skills[key].length + skills.shared.length} skills${key === detected ? ' · detected in package.json' : ''}`,
  }));
  const framework = keys[await select('Framework', frameworkOptions, Math.max(0, keys.indexOf(detected)))];
  const agent = AGENTS[await select('Agent', AGENTS.map((a) => ({ label: a.label, hint: a.path })))];

  pipedRl?.close();
  const bundle = resolveBundle(framework, skills);
  console.log(`\n${styleText('dim', `Installing ${skills[framework].length} ${FRAMEWORKS[framework]} + ${skills.shared.length} shared skills into ${agent.path} ...`)}\n`);
  const args = ['-y', SKILLS_CLI, 'add', SOURCE, ...bundle.flatMap((name) => ['--skill', name]), '-a', agent.id, '-y'];
  const result = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Skills CLI exited with code ${result.status}. Nothing else was changed.`);

  console.log(`\n${styleText('green', '✔')} ${styleText('bold', `${bundle.length} skills installed`)} for ${agent.label} in ${agent.path}`);
  console.log(styleText('dim', `  Update later:   npx skills update -y\n  New skills:     npx github:${SOURCE}\n`));
}

// realpath: npx runs bins through a symlink in node_modules/.bin.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => { console.error(`${styleText('red', '✖')} ${error.message}`); process.exitCode = 1; });
}
