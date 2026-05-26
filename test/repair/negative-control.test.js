// Regression tests for negative-control corpus.
// These inputs MUST be rejected — acceptance signals over-eager repair.
// See scripts/shadow-bench.js NEGATIVE_CORPUS for the full list.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAndRepair } = require('../../src/repair/repair-orchestrator');

function assertRejected(toolName, input, label) {
  const r = validateAndRepair(toolName, input);
  assert.equal(r.passThrough, false, `${label}: must not pass through`);
  assert.ok(r.errors.length > 0, `${label}: must report errors`);
}

test('negative-control: missing required field is rejected', () => {
  assertRejected('read_file', {}, 'read_file missing file_path');
  assertRejected('write_to_file', { file_path: '/tmp/a' }, 'write_to_file missing content');
  assertRejected('edit_file', { file_path: '/tmp/a', old_string: 'a' }, 'edit_file missing new_string');
  assertRejected('WebFetch', { url: 'https://example.com' }, 'WebFetch missing prompt');
  assertRejected('TodoWrite', {}, 'TodoWrite missing todos');
});

test('negative-control: unfixable type mismatch is rejected', () => {
  assertRejected('read_file', { file_path: 12345 }, 'numeric file_path');
  assertRejected('Bash', { command: { not: 'a string' } }, 'object command');
  assertRejected('read_file', { file_path: '/tmp/a', offset: 'not-a-number' }, 'string offset');
});

test('negative-control: unsafe path is rejected (control chars / HTML / traversal / leftover markdown)', () => {
  assertRejected('read_file', { file_path: '[../etc/passwd](http://../etc/passwd)' }, 'traversal autolink');
  assertRejected('read_file', { file_path: '[<script>](http://<script>)' }, 'HTML autolink');
  assertRejected('write_to_file', { file_path: '[a\x00b](http://a\x00b)', content: 'x' }, 'control-char autolink');
  assertRejected('read_file', { file_path: '../../etc/passwd' }, 'raw traversal');
  assertRejected('write_to_file', { file_path: 'a\x00b', content: 'x' }, 'raw control char');
});

test('negative-control: real markdown link (text != url) is rejected, not auto-fixed', () => {
  assertRejected('read_file', { file_path: '[click here](http://example.com)' }, 'descriptive link text');
  assertRejected('read_file', { file_path: '[notes](https://different.com)' }, 'mismatched link');
});
