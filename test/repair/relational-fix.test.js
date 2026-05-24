const { describe, it } = require('node:test');
const assert = require('node:assert');
const { applyRelationalFixes, fixReadFileInvariants } = require('../../src/repair/relational-fix');

describe('fixReadFileInvariants', () => {
  it('adds limit=2000 when offset without limit', () => {
    const r = fixReadFileInvariants({ offset: 50 });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.limit, 2000);
    assert.strictEqual(r.input.offset, 50);
  });

  it('adds offset=0 when limit without offset', () => {
    const r = fixReadFileInvariants({ limit: 200 });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.offset, 0);
    assert.strictEqual(r.input.limit, 200);
  });

  it('does nothing when both present', () => {
    const r = fixReadFileInvariants({ offset: 0, limit: 100 });
    assert.strictEqual(r.repaired, false);
  });

  it('does nothing when neither present', () => {
    const r = fixReadFileInvariants({ file_path: '/tmp/test' });
    assert.strictEqual(r.repaired, false);
  });

  it('handles zero offset with missing limit', () => {
    const r = fixReadFileInvariants({ offset: 0 });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.limit, 2000);
    assert.strictEqual(r.input.offset, 0);
  });

  it('includes notes for model transparency', () => {
    const r = fixReadFileInvariants({ limit: 200 });
    assert.ok(r.notes.length > 0);
    assert.ok(r.notes[0].includes('offset'));
  });
});

describe('applyRelationalFixes', () => {
  it('applies fix for read_file tool', () => {
    const r = applyRelationalFixes('read_file', { limit: 200 });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.offset, 0);
  });

  it('applies fix for Read tool (alias)', () => {
    const r = applyRelationalFixes('Read', { limit: 200 });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.offset, 0);
  });

  it('skips unknown tools', () => {
    const r = applyRelationalFixes('unknown_tool', { limit: 200 });
    assert.strictEqual(r.repaired, false);
  });

  it('does not mutate original input', () => {
    const original = { limit: 200 };
    const copy = { ...original };
    applyRelationalFixes('read_file', original);
    assert.deepStrictEqual(original, copy, 'must not mutate original');
  });
});
