const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateAndRepair } = require('../../src/repair/repair-orchestrator');

// Real-world DeepSeek V4 error patterns collected from production usage.
// Each scenario represents a confirmed pattern the model produces.

describe('DeepSeek V4 — null pollution', () => {
  it('read_file with all-null optional fields', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/src/index.ts',
      offset: null,
      limit: null,
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.file_path, '/src/index.ts');
    assert.strictEqual(r.input.offset, undefined);
    assert.strictEqual(r.input.limit, undefined);
  });

  it('edit_file with null replace_all', () => {
    const r = validateAndRepair('edit_file', {
      file_path: '/src/app.js',
      old_string: 'foo',
      new_string: 'bar',
      replace_all: null,
    });
    assert.strictEqual(r.repaired, true);
    assert.strictEqual(r.input.replace_all, undefined);
    assert.strictEqual(r.input.old_string, 'foo');
  });
});

describe('DeepSeek V4 — markdown autolink in paths', () => {
  it('write_to_file with autolinked path', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '[config.json](http://config.json)',
      content: '{"key": "value"}',
    });
    assert.strictEqual(r.input.file_path, 'config.json');
    assert.strictEqual(r.input.content, '{"key": "value"}');
    assert.strictEqual(r.repaired, true);
  });

  it('search_content with autolinked directory', () => {
    const r = validateAndRepair('search_content', {
      directory: '[src](http://src)',
      pattern: 'TODO',
    });
    assert.strictEqual(r.input.directory, 'src');
    assert.strictEqual(r.repaired, true);
  });

  it('https autolink variant', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '[readme.md](https://readme.md)',
      content: 'hello',
    });
    assert.strictEqual(r.input.file_path, 'readme.md');
  });
});

describe('DeepSeek V4 — array type confusion', () => {
  it('JSON string instead of array for args', () => {
    const r = validateAndRepair('execute_command', {
      command: 'git',
      args: '["add", "."]',
    });
    assert.ok(Array.isArray(r.input.args));
    assert.deepStrictEqual(r.input.args, ['add', '.']);
    assert.strictEqual(r.repaired, true);
  });

  it('single object where array expected', () => {
    const r = validateAndRepair('execute_command', {
      command: 'npm',
      args: { flag: '--verbose' },
    });
    assert.ok(Array.isArray(r.input.args));
    assert.deepStrictEqual(r.input.args, [{ flag: '--verbose' }]);
  });

  it('bare string where array expected', () => {
    const r = validateAndRepair('execute_command', {
      command: 'ls',
      args: '--all',
    });
    assert.ok(Array.isArray(r.input.args));
    assert.deepStrictEqual(r.input.args, ['--all']);
  });
});

describe('DeepSeek V4 — relational invariant violations', () => {
  it('offset without limit on read_file', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/src/main.rs',
      offset: 100,
    });
    assert.strictEqual(r.input.limit, 2000);
    assert.strictEqual(r.input.offset, 100);
    assert.strictEqual(r.repaired, true);
  });

  it('limit without offset on list_files', () => {
    const r = validateAndRepair('list_files', {
      target_directory: '/src',
      limit: 500,
    });
    assert.strictEqual(r.input.offset, 0);
    assert.strictEqual(r.input.limit, 500);
  });
});

describe('DeepSeek V4 — multi-error compound scenarios', () => {
  it('null + autolink + relational in single call', () => {
    const r = validateAndRepair('read_file', {
      file_path: '[utils.ts](http://utils.ts)',
      offset: null,
      limit: null,
    });
    assert.strictEqual(r.input.file_path, 'utils.ts');
    assert.strictEqual(r.input.offset, undefined);
    assert.strictEqual(r.input.limit, undefined);
    assert.strictEqual(r.repaired, true);
    assert.ok(r.fixes.length >= 2);
  });

  it('autolink path + relational offset without limit', () => {
    const r = validateAndRepair('read_file', {
      file_path: '[main.py](http://main.py)',
      offset: 50,
    });
    assert.strictEqual(r.input.file_path, 'main.py');
    assert.strictEqual(r.input.offset, 50);
    assert.strictEqual(r.input.limit, 2000);
    assert.strictEqual(r.repaired, true);
    assert.ok(r.fixes.length >= 2);
  });

  it('content preservation under multi-fix (content must survive)', () => {
    const r = validateAndRepair('write_to_file', {
      file_path: '[app.tsx](http://app.tsx)',
      content: '{"users": [{"name": "test"}]}',
    });
    assert.strictEqual(r.input.file_path, 'app.tsx');
    assert.strictEqual(r.input.content, '{"users": [{"name": "test"}]}');
    assert.strictEqual(typeof r.input.content, 'string');
  });
});

describe('DeepSeek V4 — valid inputs pass through', () => {
  it('well-formed read_file is untouched', () => {
    const r = validateAndRepair('read_file', {
      file_path: '/src/index.ts',
      offset: 0,
      limit: 100,
    });
    assert.strictEqual(r.passThrough, true);
    assert.strictEqual(r.repaired, false);
  });

  it('well-formed execute_command is untouched', () => {
    const r = validateAndRepair('execute_command', {
      command: 'npm test',
      requires_approval: false,
    });
    assert.strictEqual(r.passThrough, true);
    assert.strictEqual(r.repaired, false);
  });
});
