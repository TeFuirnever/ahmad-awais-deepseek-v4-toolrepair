// Verifies the dual-export contract: CJS require, ESM import, and exports map shape.
// Runs under node --test. No TypeScript compilation here — d.ts checks live in test/types/.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const pkgRoot = path.resolve(__dirname, '..', '..');
const pkgJson = require(path.join(pkgRoot, 'package.json'));

test('package.json exposes types, module, and exports map', () => {
  assert.equal(pkgJson.types, './src/index.d.ts');
  assert.equal(pkgJson.module, './src/index.mjs');
  assert.ok(pkgJson.exports, 'exports field present');
  assert.deepEqual(pkgJson.exports['.'], {
    types: './src/index.d.ts',
    import: './src/index.mjs',
    require: './src/index.js',
    default: './src/index.js',
  });
});

test('CJS require returns full public surface', () => {
  const api = require(path.join(pkgRoot, 'src/index.js'));
  assert.equal(typeof api.repair.validateAndRepair, 'function');
  assert.equal(typeof api.repair.getSchema, 'function');
  assert.equal(typeof api.shapeFixes.removeNulls, 'function');
  assert.equal(typeof api.shapeFixes.applyFixesForPath, 'function');
  assert.equal(typeof api.autolinkFix.fixAutolinksInPaths, 'function');
  assert.equal(typeof api.relationalFix.applyRelationalFixes, 'function');
});

test('ESM import returns identical surface via dynamic import', async () => {
  const mod = await import(path.join(pkgRoot, 'src/index.mjs'));
  assert.equal(typeof mod.repair.validateAndRepair, 'function');
  assert.equal(typeof mod.shapeFixes.removeNulls, 'function');
  assert.equal(typeof mod.autolinkFix.fixAutolinksInPaths, 'function');
  assert.equal(typeof mod.relationalFix.applyRelationalFixes, 'function');
  assert.equal(typeof mod.default, 'object');
  assert.equal(mod.default.repair, mod.repair);
});

test('ESM named exports reference the same objects as CJS', async () => {
  const cjs = require(path.join(pkgRoot, 'src/index.js'));
  const esm = await import(path.join(pkgRoot, 'src/index.mjs'));
  assert.equal(esm.repair, cjs.repair);
  assert.equal(esm.shapeFixes, cjs.shapeFixes);
  assert.equal(esm.autolinkFix, cjs.autolinkFix);
  assert.equal(esm.relationalFix, cjs.relationalFix);
});

test('index.d.ts file exists and declares the public surface', () => {
  const fs = require('node:fs');
  const dts = fs.readFileSync(path.join(pkgRoot, 'src/index.d.ts'), 'utf8');
  for (const decl of [
    'export const repair: RepairApi',
    'export const shapeFixes: ShapeFixesApi',
    'export const autolinkFix: AutolinkFixApi',
    'export const relationalFix: RelationalFixApi',
    'export default _default',
  ]) {
    assert.ok(dts.includes(decl), `d.ts missing: ${decl}`);
  }
});
