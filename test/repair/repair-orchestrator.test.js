const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateAndRepair, generateRetryMessage, logTelemetry, validateField, getSchema } = require('../../src/repair/repair-orchestrator');

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

describe('validateAndRepair — required field validation', () => {
  it('reports error when required file_path is missing', () => {
    const r = validateAndRepair('read_file', {});
    assert.ok(r.errors.length > 0);
    assert.strictEqual(r.errors[0].path, 'file_path');
    assert.strictEqual(r.errors[0].received, 'missing');
  });

  it('reports error when required file_path is null (before removeNulls)', () => {
    const r = validateAndRepair('read_file', { file_path: null });
    assert.ok(r.errors.some(e => e.path === 'file_path'));
  });

  it('no error for present required field', () => {
    const r = validateAndRepair('read_file', { file_path: '/tmp/test' });
    assert.strictEqual(r.errors.length, 0);
    assert.strictEqual(r.passThrough, true);
  });

  it('no error for missing optional fields', () => {
    const r = validateAndRepair('read_file', { file_path: '/tmp/test' });
    assert.strictEqual(r.errors.length, 0);
  });

  it('reports multiple missing required fields', () => {
    const r = validateAndRepair('write_to_file', {});
    assert.ok(r.errors.length >= 2);
    const paths = r.errors.map(e => e.path);
    assert.ok(paths.includes('file_path'));
    assert.ok(paths.includes('content'));
  });
});

describe('validateAndRepair — API contract', () => {
  it('partial repair: repaired=true with errors when some fixes applied but issues remain', () => {
    const r = validateAndRepair('read_file', {
      file_path: '[test.md](http://test.md)',
      offset: 'bad',
    });
    assert.strictEqual(r.repaired, true);
    assert.ok(r.fixes.length > 0);
    assert.ok(r.errors.length > 0);
    assert.ok(r.retryMessage);
  });

  it('full repair: repaired=true with zero errors', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/tmp/test',
      offset: null,
      limit: null,
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.errors.length, 0);
    assert.strictEqual(r.retryMessage, undefined);
  });

  it('retryMessage always populated when errors present', () => {
    const r = validateAndRepair('read_file', { offset: 'bad' });
    assert.ok(r.errors.length > 0);
    assert.ok(r.retryMessage);
    assert.ok(r.retryMessage.includes('read_file'));
  });

  it('retryMessage populated for non-object input (step-2 no-fix path)', () => {
    const r = validateAndRepair('read_file', 42);
    assert.ok(r.errors.length > 0);
    assert.ok(r.retryMessage);
    assert.ok(r.retryMessage.includes('read_file'));
  });
});

describe('validateAndRepair — tryParse string input', () => {
  it('parses valid JSON string to object', () => {
    const r = validateAndRepair('read_file', '{"file_path":"/tmp/test","offset":0,"limit":100}');
    assert.strictEqual(r.passThrough, true);
    assert.strictEqual(r.input.file_path, '/tmp/test');
  });

  it('parses JSON string and applies fixes', () => {
    const r = validateAndRepair('read_file', '{"file_path":"/tmp/test","offset":null}');
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.offset, undefined);
  });
});

describe('validateAndRepair — validateField type checks', () => {
  it('detects string type mismatch', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '/tmp/test',
      content: 123,
    });
    assert.ok(r.errors.some(e => e.path === 'content' && e.expected === 'string'));
  });

  it('detects boolean type mismatch', () => {
    const r = validateAndRepair('execute_command', {
      command: 'ls',
      requires_approval: 'yes',
    });
    assert.ok(r.errors.some(e => e.path === 'requires_approval' && e.expected === 'boolean'));
  });
});

describe('validateAndRepair — Step 2 paths', () => {
  it('Step 2: known tool with non-object input hits schema validation', () => {
    const r = validateAndRepair('read_file', 'not-json');
    assert.strictEqual(r.passThrough, false);
    assert.ok(r.errors.length > 0);
    assert.strictEqual(r.errors[0].expected, 'object');
  });

  it('Step 2a: autolink fix on array input (unknown tool)', () => {
    const r = validateAndRepair('unknown_tool', ['[a.md](http://a.md)']);
    assert.ok(r.fixes.some(f => f.type === 'autolink'));
  });

  it('Step 2 + Step 3: re-validate failure after fix on non-object', () => {
    const r = validateAndRepair('unknown_tool', ['[a.md](http://a.md)']);
    assert.strictEqual(r.repaired, false);
    assert.ok(r.retryMessage);
  });

  it('Step 2: known tool non-object with no schema-level fix', () => {
    const r = validateAndRepair('read_file', null);
    assert.strictEqual(r.passThrough, false);
    assert.ok(r.errors.length > 0);
  });
});

describe('logTelemetry', () => {
  it('logs repaired event to stderr', () => {
    const original = console.error;
    let logged;
    console.error = (msg) => { logged = msg; };
    logTelemetry({
      repaired: true,
      tool: 'read_file',
      passThrough: false,
      fixes: [{ type: 'remove-nulls' }],
      errors: [],
    });
    console.error = original;
    const parsed = JSON.parse(logged);
    assert.strictEqual(parsed.event, 'tool_input_repaired');
    assert.strictEqual(parsed.tool, 'read_file');
    assert.deepStrictEqual(parsed.fixes, ['remove-nulls']);
  });

  it('logs invalid event to stderr', () => {
    const original = console.error;
    let logged;
    console.error = (msg) => { logged = msg; };
    logTelemetry({
      repaired: false,
      tool: 'read_file',
      passThrough: false,
    });
    console.error = original;
    const parsed = JSON.parse(logged);
    assert.strictEqual(parsed.event, 'tool_input_invalid');
    assert.strictEqual(parsed.error_count, 0);
  });
});

describe('generateRetryMessage', () => {
  it('includes tool name, errors, and fixes', () => {
    const msg = generateRetryMessage('read_file',
      [{ path: 'offset', expected: 'number', received: 'string' }],
      [{ type: 'relational', notes: ['limit defaulted to 2000'] }],
    );
    assert.ok(msg.includes('read_file'));
    assert.ok(msg.includes('offset'));
    assert.ok(msg.includes('Note: limit defaulted'));
  });

  it('handles empty fixes', () => {
    const msg = generateRetryMessage('test',
      [{ path: '', expected: 'object', received: 'number' }],
      [],
    );
    assert.ok(msg.includes('test'));
    assert.ok(!msg.includes('Auto-repair'));
  });
});

describe('refactor invariants — fixes record shape', () => {
  it('autolink fix record contains type and fields', () => {
    const r = validateAndRepair('write_to_file', { file_path: '[a.md](http://a.md)', content: 'x' });
    const fix = r.fixes.find(f => f.type === 'autolink');
    assert.ok(Array.isArray(fix.fields));
    assert.ok(fix.fields.includes('file_path'));
  });

  it('relational fix record contains type and notes', () => {
    const r = validateAndRepair('read_file', { file_path: '/tmp/t', offset: 10 });
    const fix = r.fixes.find(f => f.type === 'relational');
    assert.ok(Array.isArray(fix.notes));
  });

  it('shape-fix record contains type and path', () => {
    const r = validateAndRepair('execute_command', { command: 'ls', args: '["-la"]' });
    const fix = r.fixes.find(f => f.type === 'parse-json-array');
    assert.strictEqual(fix.path, 'args');
  });

  it('remove-nulls fix record has only type', () => {
    const r = validateAndRepair('read_file', { file_path: '/tmp/t', offset: null });
    const fix = r.fixes.find(f => f.type === 'remove-nulls');
    assert.ok(fix);
  });
});

describe('validateField — direct', () => {
  it('rejects null input', () => {
    const schema = getSchema('read_file');
    const errors = validateField(null, schema);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].expected, 'object');
    assert.strictEqual(errors[0].received, 'null');
  });

  it('rejects array input', () => {
    const schema = getSchema('read_file');
    const errors = validateField(['bad'], schema);
    assert.strictEqual(errors[0].expected, 'object');
  });

  it('rejects number input', () => {
    const schema = getSchema('read_file');
    const errors = validateField(42, schema);
    assert.strictEqual(errors[0].received, 'number');
  });

  it('returns empty errors for valid object', () => {
    const schema = getSchema('read_file');
    const errors = validateField({ file_path: '/tmp/t', offset: 0, limit: 100 }, schema);
    assert.strictEqual(errors.length, 0);
  });

  it('detects number type mismatch', () => {
    const schema = getSchema('read_file');
    const errors = validateField({ file_path: '/tmp/t', offset: 'bad' }, schema);
    assert.ok(errors.some(e => e.path === 'offset' && e.expected === 'number'));
  });
});
