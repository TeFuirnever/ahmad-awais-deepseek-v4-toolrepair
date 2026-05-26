'use strict';

// Unit tests for the normalise() mapper in scripts/shadow-bench-live.js.
// Uses only small inline fixtures — no external data is fetched.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { normalise } = require('../../scripts/shadow-bench-live');

// ---------------------------------------------------------------------------
// BFCL shape: { "function": "<name>", "parameters": { ... } }
// ---------------------------------------------------------------------------

describe('normalise — BFCL shape', () => {
  it('maps function + parameters to tool + input', () => {
    const raw = { function: 'read_file', parameters: { file_path: '/tmp/a' } };
    const result = normalise(raw);
    assert.ok(result, 'should return a result');
    assert.strictEqual(result.tool, 'read_file');
    assert.deepStrictEqual(result.input, { file_path: '/tmp/a' });
    assert.strictEqual(result.sourceTag, 'bfcl');
  });

  it('maps BFCL entry with multiple parameters', () => {
    const raw = {
      function: 'execute_command',
      parameters: { command: 'ls', args: ['-la'] },
    };
    const result = normalise(raw);
    assert.ok(result);
    assert.strictEqual(result.tool, 'execute_command');
    assert.deepStrictEqual(result.input, { command: 'ls', args: ['-la'] });
    assert.strictEqual(result.sourceTag, 'bfcl');
  });

  it('returns null when parameters is not an object', () => {
    const raw = { function: 'read_file', parameters: 'bad' };
    assert.strictEqual(normalise(raw), null);
  });

  it('returns null when parameters is an array', () => {
    const raw = { function: 'read_file', parameters: ['/tmp/a'] };
    assert.strictEqual(normalise(raw), null);
  });
});

// ---------------------------------------------------------------------------
// ToolBench Anthropic-style: { "tool_name": "<name>", "tool_input": { ... } }
// ---------------------------------------------------------------------------

describe('normalise — ToolBench Anthropic-style shape', () => {
  it('maps tool_name + tool_input to tool + input', () => {
    const raw = {
      tool_name: 'write_to_file',
      tool_input: { file_path: '/tmp/b', content: 'hello' },
    };
    const result = normalise(raw);
    assert.ok(result);
    assert.strictEqual(result.tool, 'write_to_file');
    assert.deepStrictEqual(result.input, { file_path: '/tmp/b', content: 'hello' });
    assert.strictEqual(result.sourceTag, 'toolbench');
  });

  it('returns null when tool_input is null', () => {
    const raw = { tool_name: 'write_to_file', tool_input: null };
    assert.strictEqual(normalise(raw), null);
  });
});

// ---------------------------------------------------------------------------
// ToolBench / OpenAI-compat: { "name": "<name>", "arguments": { ... } }
// ---------------------------------------------------------------------------

describe('normalise — ToolBench / OpenAI-compat shape', () => {
  it('maps name + arguments (object) to tool + input', () => {
    const raw = {
      name: 'execute_command',
      arguments: { command: 'grep', args: ['-r', 'foo', '.'] },
    };
    const result = normalise(raw);
    assert.ok(result);
    assert.strictEqual(result.tool, 'execute_command');
    assert.deepStrictEqual(result.input, { command: 'grep', args: ['-r', 'foo', '.'] });
    assert.strictEqual(result.sourceTag, 'toolbench');
  });

  it('parses JSON-string arguments (some ToolBench variants)', () => {
    const raw = {
      name: 'read_file',
      arguments: JSON.stringify({ file_path: '/tmp/c', offset: 10, limit: 50 }),
    };
    const result = normalise(raw);
    assert.ok(result);
    assert.strictEqual(result.tool, 'read_file');
    assert.deepStrictEqual(result.input, { file_path: '/tmp/c', offset: 10, limit: 50 });
    assert.strictEqual(result.sourceTag, 'toolbench');
  });

  it('returns null when arguments is invalid JSON string', () => {
    const raw = { name: 'read_file', arguments: '{bad json' };
    assert.strictEqual(normalise(raw), null);
  });

  it('returns null when arguments is an array', () => {
    const raw = { name: 'read_file', arguments: ['/tmp/a'] };
    assert.strictEqual(normalise(raw), null);
  });
});

// ---------------------------------------------------------------------------
// Pre-normalised shape: { "tool": "<name>", "input": { ... } }
// ---------------------------------------------------------------------------

describe('normalise — pre-normalised shape', () => {
  it('passes through tool + input directly', () => {
    const raw = { tool: 'edit_file', input: { file_path: '/tmp/d', old_string: 'a', new_string: 'b' } };
    const result = normalise(raw);
    assert.ok(result);
    assert.strictEqual(result.tool, 'edit_file');
    assert.deepStrictEqual(result.input, { file_path: '/tmp/d', old_string: 'a', new_string: 'b' });
    assert.strictEqual(result.sourceTag, 'normalized');
  });
});

// ---------------------------------------------------------------------------
// Unrecognised / degenerate inputs
// ---------------------------------------------------------------------------

describe('normalise — unrecognised inputs', () => {
  it('returns null for an empty object', () => {
    assert.strictEqual(normalise({}), null);
  });

  it('returns null for null', () => {
    assert.strictEqual(normalise(null), null);
  });

  it('returns null for an array', () => {
    assert.strictEqual(normalise([]), null);
  });

  it('returns null for a string', () => {
    assert.strictEqual(normalise('read_file'), null);
  });

  it('returns null for an object with no recognised keys', () => {
    assert.strictEqual(normalise({ foo: 'bar', baz: 42 }), null);
  });
});
