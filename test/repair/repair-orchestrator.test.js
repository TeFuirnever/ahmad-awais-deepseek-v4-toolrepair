const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateAndRepair } = require('../../src/repair/repair-orchestrator');

describe('validateAndRepair — valid input', () => {
  it('passes through valid input untouched', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/tmp/test.txt',
      offset: 0,
      limit: 100,
    });
    assert.strictEqual(r.passThrough, true);
    assert.strictEqual(r.repaired, false);
    assert.deepStrictEqual(r.fixes, []);
  });
});

describe('validateAndRepair — invalid input', () => {
  it('rejects array input', () => {
    const r = validateAndRepair('read_file', ['val']);
    assert.strictEqual(r.passThrough, false);
    assert.ok(r.errors.length > 0);
  });

  it('rejects null input', () => {
    const r = validateAndRepair('read_file', null);
    assert.strictEqual(r.passThrough, false);
    assert.ok(r.errors.length > 0);
  });

  it('rejects number input', () => {
    const r = validateAndRepair('read_file', 123);
    assert.strictEqual(r.passThrough, false);
    assert.ok(r.errors.length > 0);
  });
});

describe('validateAndRepair — repair', () => {
  it('removes null optional fields', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/tmp/test.txt',
      offset: null,
      limit: null,
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.offset, undefined);
    assert.strictEqual(r.input.limit, undefined);
    assert.strictEqual(r.input.file_path, '/tmp/test.txt');
  });

  it('fixes limit without offset', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/tmp/test.txt',
      limit: 200,
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.offset, 0);
    assert.strictEqual(r.input.limit, 200);
  });

  it('fixes offset without limit', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/tmp/test.txt',
      offset: 50,
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.limit, 2000);
  });

  it('fixes markdown autolink in paths', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '[notes.md](http://notes.md)',
      content: 'test',
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.file_path, 'notes.md');
  });

  it('returns original on failed repair', () => {
    const original = 'not-json-not-object';
    const r = validateAndRepair('unknown_tool', original);
    assert.strictEqual(r.repaired, false);
    assert.strictEqual(r.input, original);
  });
});

describe('validateAndRepair — unknown tool', () => {
  it('handles tools not in schema registry', () => {
    const r = validateAndRepair('some_unknown_tool', {
      arg1: 'val',
      offset: null,
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.offset, undefined);
    assert.strictEqual(r.input.arg1, 'val');
  });
});
