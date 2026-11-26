import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES, detectFramework, discoverSkills, resolveBundle } from './install.mjs';

const skills = discoverSkills();

test('discovers a non-empty skill list for every category', () => {
  for (const category of CATEGORIES) assert.ok(skills[category].length > 0, category);
});

test('each framework bundle = its skills + all shared, nothing from the other framework', () => {
  assert.deepEqual(resolveBundle('React', skills), [...skills.react, ...skills.shared]);
  assert.deepEqual(resolveBundle('angular', skills), [...skills.angular, ...skills.shared]);
  assert.ok(!resolveBundle('react', skills).some((name) => skills.angular.includes(name)));
});

test('rejects unknown frameworks', () => {
  assert.throws(() => resolveBundle('Vue', skills), /Unknown framework/);
});

test('detects the framework from the project package.json', () => {
  const project = (pkg) => { const dir = mkdtempSync(join(tmpdir(), 'fas-')); if (pkg) writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg)); return dir; };
  assert.equal(detectFramework(project({ dependencies: { '@angular/core': '20', react: '19' } })), 'angular');
  assert.equal(detectFramework(project({ devDependencies: { react: '19' } })), 'react');
  assert.equal(detectFramework(project({ dependencies: { vue: '3' } })), undefined);
  assert.equal(detectFramework(project()), undefined);
});
