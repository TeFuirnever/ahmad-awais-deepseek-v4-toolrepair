// Integration: `toolrepair verify` runs an end-to-end plugin smoke check
// that catches the class of bug that silently broke v1.0.0/v1.0.1.
//
// Without this check, a plugin with the wrong hook signature, CJS-vs-ESM
// loader mismatch, or missing tool schemas can pass `verify` (file exists,
// config registered) while doing nothing at runtime. The smoke check
// loads the real .mjs, invokes the hook against a known-broken input,
// and asserts the hook mutated `output.args` as expected.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PLUGIN_SRC = path.join(
  REPO_ROOT,
  'src', 'platforms', 'opencode', 'plugin', 'tool-repair-plugin.mjs'
);

function stageRealPlugin() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-smoke-real-'));
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

function stageNoopPlugin() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-smoke-noop-'));
  // Mimics the broken v1.0.0/v1.0.1 shape: hook exists but reads from the
  // wrong place, so output.args is never mutated.
  fs.writeFileSync(
    path.join(tmp, 'tool-repair-plugin.mjs'),
    `export default async function NoopPlugin() {
       return {
         "tool.execute.before": async (input, _output) => {
           // pretend to do work but never touch _output.args
           const _ = input && input.parameters;
         },
       };
     }
`
  );
  return path.join(tmp, 'tool-repair-plugin.mjs');
}

const { runPluginSmokeCheck } = require('../../src/verify');

test('smoke check: real plugin reports OK', async () => {
  const realPlugin = stageRealPlugin();
  const result = await runPluginSmokeCheck(realPlugin);
  assert.equal(result.ok, true, `expected ok=true, got ${JSON.stringify(result)}`);
});

test('smoke check: no-op stub reports FAILED with reason', async () => {
  const noop = stageNoopPlugin();
  const result = await runPluginSmokeCheck(noop);
  assert.equal(result.ok, false);
  assert.match(result.reason, /did not strip null offset\/limit/);
});

test('smoke check: missing file reports FAILED', async () => {
  const result = await runPluginSmokeCheck('/nonexistent/plugin.mjs');
  assert.equal(result.ok, false);
});

test('smoke check: plugin without default export reports FAILED', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-smoke-nodefault-'));
  const bad = path.join(tmp, 'tool-repair-plugin.mjs');
  fs.writeFileSync(bad, `export const notDefault = 1;\n`);
  const result = await runPluginSmokeCheck(bad);
  assert.equal(result.ok, false);
  assert.match(result.reason, /default export/);
});
