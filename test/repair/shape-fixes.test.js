const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  removeNulls,
  parseJsonArray,
  wrapSingleObject,
  wrapBareString,
  applyFixesForPath,
} = require('../../src/repair/shape-fixes');

describe('removeNulls', () => {
  it('removes null properties', () => {
    const r = removeNulls({ a: 1, b: null, c: 'str' });
    assert.strictEqual(r.fixed, true);
    assert.deepStrictEqual(r.input, { a: 1, c: 'str' });
  });

  it('returns fixed:false for null-free objects', () => {
    const r = removeNulls({ a: 1, b: 2 });
    assert.strictEqual(r.fixed, false);
  });

  it('returns fixed:false for arrays', () => {
    const r = removeNulls([1, null, 2]);
    assert.strictEqual(r.fixed, false);
  });

  it('returns fixed:false for null input', () => {
    const r = removeNulls(null);
    assert.strictEqual(r.fixed, false);
  });
});

describe('parseJsonArray', () => {
  it('parses JSON-encoded array string', () => {
    const input = { cmd: '["ls", "-la"]' };
    const r = parseJsonArray(input, 'cmd');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.fix, 'parse-json-array');
    assert.deepStrictEqual(r.input.cmd, ['ls', '-la']);
  });

  it('skips non-string values', () => {
    const input = { cmd: 123 };
    const r = parseJsonArray(input, 'cmd');
    assert.strictEqual(r.fixed, false);
  });

  it('skips non-array JSON', () => {
    const input = { data: '{"key":"val"}' };
    const r = parseJsonArray(input, 'data');
    assert.strictEqual(r.fixed, false);
  });

  it('handles null path traversal gracefully', () => {
    const input = { a: null };
    const r = parseJsonArray(input, 'a.b');
    assert.strictEqual(r.fixed, false);
  });
});

describe('wrapSingleObject', () => {
  it('wraps plain object in array', () => {
    const input = { input: { key: 'val' } };
    const r = wrapSingleObject(input, 'input');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.fix, 'wrap-single-object');
    assert.deepStrictEqual(r.input.input, [{ key: 'val' }]);
  });

  it('does not wrap arrays', () => {
    const input = { input: [1, 2] };
    const r = wrapSingleObject(input, 'input');
    assert.strictEqual(r.fixed, false);
  });
});

describe('wrapBareString', () => {
  it('wraps string in array', () => {
    const input = { file: 'foo.txt' };
    const r = wrapBareString(input, 'file');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.fix, 'wrap-bare-string');
    assert.deepStrictEqual(r.input.file, ['foo.txt']);
  });

  it('skips non-strings', () => {
    const input = { file: 123 };
    const r = wrapBareString(input, 'file');
    assert.strictEqual(r.fixed, false);
  });
});

describe('applyFixesForPath — ordering invariant', () => {
  it('parseJsonArray runs BEFORE wrapBareString', () => {
    const input = { cmd: '["ls", "-la"]' };
    const r = applyFixesForPath(input, 'cmd', 'array');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.fix, 'parse-json-array',
      'must parse JSON array, NOT wrap bare string');
    assert.deepStrictEqual(r.input.cmd, ['ls', '-la']);
  });

  it('falls back to wrapBareString for plain strings', () => {
    const input = { cmd: 'hello' };
    const r = applyFixesForPath(input, 'cmd', 'array');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.fix, 'wrap-bare-string');
    assert.deepStrictEqual(r.input.cmd, ['hello']);
  });

  it('removes nulls before other fixes', () => {
    const input = { cmd: null, other: null };
    const r = applyFixesForPath(input, 'cmd', 'array');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.fix, 'remove-nulls');
    assert.strictEqual(r.input.cmd, undefined);
    assert.strictEqual(r.input.other, undefined);
  });
});
