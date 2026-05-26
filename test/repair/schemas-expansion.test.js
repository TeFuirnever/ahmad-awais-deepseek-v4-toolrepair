// Regression coverage for the v1.1 schema expansion (Bash, Glob, Grep, TodoWrite, WebFetch).
// Verifies registry shape + end-to-end repair behavior on each new tool.

const test = require('node:test');
const assert = require('node:assert/strict');
const { toolSchemas, getSchema } = require('../../src/repair/schemas');
const { validateAndRepair } = require('../../src/repair/repair-orchestrator');

test('schema registry exposes all 19 tools (legacy + Claude + OpenCode)', () => {
  const expected = [
    // Legacy / generic
    'read_file', 'write_to_file', 'edit_file', 'search_content',
    'execute_command', 'list_files', 'Read',
    // Claude Code (PascalCase)
    'Bash', 'Glob', 'Grep', 'TodoWrite', 'WebFetch',
    // OpenCode (lowercase ids, camelCase params)
    'read', 'glob', 'grep', 'edit', 'write', 'todowrite', 'webfetch',
  ];
  for (const name of expected) {
    assert.ok(getSchema(name), `missing schema: ${name}`);
  }
  assert.equal(Object.keys(toolSchemas).length, 19);
});

test('OpenCode read: camelCase filePath + null offset/limit repaired', () => {
  const r = validateAndRepair('read', { filePath: '/x', offset: null, limit: null });
  assert.equal(r.repaired, true);
  assert.equal(r.errors.length, 0);
  assert.equal(r.input.offset, undefined);
});

test('OpenCode glob: autolink in path field repaired', () => {
  const r = validateAndRepair('glob', { pattern: '*.js', path: '[src](http://src)' });
  assert.equal(r.input.path, 'src');
});

test('OpenCode edit: camelCase oldString/newString required', () => {
  const r = validateAndRepair('edit', { filePath: '/x', oldString: 'a', newString: 'b' });
  assert.equal(r.passThrough || r.repaired, true);
  assert.equal(r.errors.length, 0);
});

test('OpenCode todowrite: stringified todos array repaired', () => {
  const r = validateAndRepair('todowrite', {
    todos: '[{"content":"a","status":"pending","activeForm":"a"}]',
  });
  assert.equal(r.errors.length, 0);
  assert.ok(Array.isArray(r.input.todos));
});

test('Bash: required command + null timeout repaired', () => {
  const r = validateAndRepair('Bash', { command: 'ls', timeout: null });
  assert.equal(r.repaired || r.passThrough, true);
  assert.equal(r.errors.length, 0);
});

test('Bash: missing command rejected', () => {
  const r = validateAndRepair('Bash', { description: 'no cmd' });
  assert.equal(r.repaired, false);
  assert.ok(r.errors.length > 0);
});

test('Glob: pattern only passes through', () => {
  const r = validateAndRepair('Glob', { pattern: '**/*.ts' });
  assert.equal(r.passThrough, true);
});

test('Glob: null path stripped', () => {
  const r = validateAndRepair('Glob', { pattern: '*.js', path: null });
  assert.equal(r.errors.length, 0);
});

test('Glob: autolink in path field repaired', () => {
  const r = validateAndRepair('Glob', { pattern: '*.js', path: '[src](http://src)' });
  assert.equal(r.errors.length, 0);
  assert.equal(r.input.path, 'src');
});

test('Grep: required pattern, optional flags', () => {
  const r = validateAndRepair('Grep', { pattern: 'foo', '-i': true, '-n': true });
  assert.equal(r.passThrough || r.repaired, true);
  assert.equal(r.errors.length, 0);
});

test('Grep: null head_limit stripped', () => {
  const r = validateAndRepair('Grep', { pattern: 'x', head_limit: null });
  assert.equal(r.errors.length, 0);
});

test('TodoWrite: stringified array repaired', () => {
  const r = validateAndRepair('TodoWrite', { todos: '[{"content":"a","status":"pending","activeForm":"a"}]' });
  assert.equal(r.errors.length, 0);
  assert.ok(Array.isArray(r.input.todos));
});

test('TodoWrite: missing todos rejected', () => {
  const r = validateAndRepair('TodoWrite', {});
  assert.equal(r.repaired, false);
  assert.ok(r.errors.length > 0);
});

test('WebFetch: both required fields present passes through', () => {
  const r = validateAndRepair('WebFetch', { url: 'https://x', prompt: 'summarize' });
  assert.equal(r.passThrough, true);
});

test('WebFetch: missing prompt rejected', () => {
  const r = validateAndRepair('WebFetch', { url: 'https://x' });
  assert.equal(r.repaired, false);
  assert.ok(r.errors.length > 0);
});

test('WebFetch: autolink url is NOT path-fixed (string, not path)', () => {
  const r = validateAndRepair('WebFetch', { url: '[a](http://a)', prompt: 'x' });
  assert.equal(r.input.url, '[a](http://a)');
});
