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

describe('validateAndRepair — content integrity', () => {
  it('does NOT parse JSON-like content in string-typed fields', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '/tmp/test',
      content: '["hello","world"]',
    });
    assert.strictEqual(typeof r.input.content, 'string');
    assert.strictEqual(r.input.content, '["hello","world"]');
    assert.strictEqual(r.passThrough, true);
  });

  it('does NOT corrupt execute_command.command with JSON string', () => {
    const r = validateAndRepair('execute_command', {
      command: '["ls","-la"]',
      requires_approval: false,
    });
    assert.strictEqual(typeof r.input.command, 'string');
    assert.strictEqual(r.passThrough, true);
  });

  it('does NOT strip autolink from string-typed content field', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '/tmp/test.md',
      content: '[readme.md](http://readme.md)',
    });
    assert.strictEqual(r.input.content, '[readme.md](http://readme.md)');
  });

  it('DOES fix autolink in path-typed file_path field', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '[notes.md](http://notes.md)',
      content: 'test',
    });
    assert.strictEqual(r.input.file_path, 'notes.md');
    assert.strictEqual(r.repaired, true);
  });

  it('parses JSON array only for array-typed fields via schema', () => {
    const r = validateAndRepair('execute_command', {
      command: 'ls',
      args: '["--color","--all"]',
    });
    assert.ok(Array.isArray(r.input.args));
    assert.deepStrictEqual(r.input.args, ['--color', '--all']);
    assert.strictEqual(r.repaired, true);
  });
});

describe('validateAndRepair — notes surfacing', () => {
  it('includes relational notes in retryMessage when errors present', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/tmp/t',
      offset: 'bad',
    });
    assert.ok(r.retryMessage);
    assert.ok(r.retryMessage.includes('Note:'));
    assert.ok(r.retryMessage.includes('limit defaulted'));
  });
});

describe('validateAndRepair — Read alias', () => {
  it('validates Read tool with schema', () => {
    const r = validateAndRepair('Read', { file_path: 123 });
    assert.ok(r.errors.length > 0);
    assert.strictEqual(r.errors[0].expected, 'path');
  });

  it('applies relational fix for Read tool', () => {
    const r = validateAndRepair('Read', {
      file_path: '/tmp/t',
      offset: 10,
    });
    assert.strictEqual(r.input.limit, 2000);
    assert.strictEqual(r.repaired, true);
  });
});

describe('validateAndRepair — list_files relational', () => {
  it('adds limit when list_files has offset only', () => {
    const r = validateAndRepair('list_files', {
      target_directory: '/tmp',
      offset: 10,
    });
    assert.strictEqual(r.input.limit, 2000);
    assert.strictEqual(r.repaired, true);
  });
});
