// Run: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from './validate-skills.mjs';

test('parses scalars, quotes and one-level metadata', () => {
  const { data, body } = parseFrontmatter('---\nname: a-b\ndescription: "x: y"\nmetadata:\n  version: "1.0.0"\n---\n# T\n');
  assert.equal(data.name, 'a-b');
  assert.equal(data.description, 'x: y');
  assert.deepEqual(data.metadata, { version: '1.0.0' });
  assert.equal(body, '# T\n');
});

test('handles CRLF files', () => {
  assert.equal(parseFrontmatter('---\r\nname: x\r\n---\r\nbody').data.name, 'x');
});

test('rejects missing frontmatter, duplicates and block scalars', () => {
  assert.throws(() => parseFrontmatter('# no fm'), /missing YAML frontmatter/);
  assert.throws(() => parseFrontmatter('---\nname: a\nname: b\n---\n'), /duplicate key/);
  assert.throws(() => parseFrontmatter('---\ndescription: >\n---\n'), /block scalars/);
});
