// Integration: the OpenCode plugin (.mjs) is the ONLY path that can repair
// tool inputs before execution. This test loads the real plugin file via
// dynamic import and asserts the `tool.execute.before` hook mutates
// `output.args` for known OpenCode tool calls.
//
// Why this matters: hook signatures are not type-checked at install time. A
// signature mismatch (we previously read `input.parameters` while OpenCode
// passes args via `output.args`) silently turned the entire OpenCode repair
// layer into dead code. This test makes that class of regression loud.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PLUGIN_SRC = path.join(
  REPO_ROOT,
  'src', 'platforms', 'opencode', 'plugin', 'tool-repair-plugin.mjs'
);

// Build a self-contained plugin layout in a tmp dir so the .mjs file can
// resolve its `./repair/repair-orchestrator` sibling — mirrors what the
// installer stages under .opencode/plugin/.
function stagePlugin() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toolrepair-plugin-'));
  fs.copyFileSync(PLUGIN_SRC, path.join(tmp, 'tool-repair-plugin.mjs'));
  const repairDest = path.join(tmp, 'repair');
  fs.mkdirSync(repairDest);
  const repairSrc = path.join(REPO_ROOT, 'src', 'repair');
  for (const file of fs.readdirSync(repairSrc)) {
    if (file.endsWith('.js')) {
      fs.copyFileSync(path.join(repairSrc, file), path.join(repairDest, file));
    }
  }
  return path.join(tmp, 'tool-repair-plugin.mjs');
}

async function loadHooks() {
  const staged = stagePlugin();
  const mod = await import(pathToFileURL(staged).href);
  assert.equal(typeof mod.default, 'function', 'plugin must default-export a factory function');
  const hooks = await mod.default({ project: {}, client: {}, $: undefined, directory: '/tmp' });
  return hooks;
}

test('plugin exports an async factory returning hooks', async () => {
  const hooks = await loadHooks();
  assert.equal(typeof hooks['tool.execute.before'], 'function');
});

test('tool.execute.before repairs OpenCode `read` args via output.args', async () => {
  const hooks = await loadHooks();
  const output = { args: { filePath: '/x', offset: null, limit: null } };
  await hooks['tool.execute.before']({ tool: 'read', sessionID: 's', callID: 'c' }, output);
  // null offset/limit stripped; passes through as a valid call.
  assert.equal(output.args.offset, undefined);
  assert.equal(output.args.limit, undefined);
  assert.equal(output.args.filePath, '/x');
});

test('tool.execute.before repairs autolink path on `glob`', async () => {
  const hooks = await loadHooks();
  const output = { args: { pattern: '*.js', path: '[src](http://src)' } };
  await hooks['tool.execute.before']({ tool: 'glob', sessionID: 's', callID: 'c' }, output);
  assert.equal(output.args.path, 'src');
});

test('tool.execute.before parses stringified todos array for `todowrite`', async () => {
  const hooks = await loadHooks();
  const output = {
    args: { todos: '[{"content":"a","status":"pending","activeForm":"a"}]' },
  };
  await hooks['tool.execute.before']({ tool: 'todowrite', sessionID: 's', callID: 'c' }, output);
  assert.ok(Array.isArray(output.args.todos));
  assert.equal(output.args.todos.length, 1);
});

test('tool.execute.before leaves valid args untouched (no spurious mutation)', async () => {
  const hooks = await loadHooks();
  const original = { filePath: '/x', offset: 0, limit: 100 };
  const output = { args: { ...original } };
  await hooks['tool.execute.before']({ tool: 'read', sessionID: 's', callID: 'c' }, output);
  assert.deepEqual(output.args, original);
});

test('tool.execute.before is a no-op on unknown tools (passthrough)', async () => {
  const hooks = await loadHooks();
  const output = { args: { whatever: 'x' } };
  await hooks['tool.execute.before']({ tool: 'unknown-tool', sessionID: 's', callID: 'c' }, output);
  assert.deepEqual(output.args, { whatever: 'x' });
});
