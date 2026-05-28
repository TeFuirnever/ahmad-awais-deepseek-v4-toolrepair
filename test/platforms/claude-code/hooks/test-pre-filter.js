const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isLikelyExecutionError, FORMAT_ERROR_SENSITIVE_TOOLS, EXECUTION_ERROR_PATTERNS } = require('../../../../src/platforms/claude-code/hooks/tool-repair-detector');

describe('isLikelyExecutionError', () => {
  it('detects "command not found" as execution error', () => {
    assert.strictEqual(isLikelyExecutionError('command not found: foo'), true);
  });

  it('detects ENOENT as execution error', () => {
    assert.strictEqual(isLikelyExecutionError('ENOENT: no such file'), true);
  });

  it('does NOT detect ZodError as execution error (must allow format detection)', () => {
    assert.strictEqual(isLikelyExecutionError('ZodError: invalid_type'), false);
  });

  it('does NOT detect TypeError as execution error (potential format error)', () => {
    assert.strictEqual(isLikelyExecutionError('TypeError: Cannot read property'), false);
  });

  it('detects EACCES as execution error', () => {
    assert.strictEqual(isLikelyExecutionError('EACCES: permission denied'), true);
  });

  it('detects ECONNREFUSED as execution error', () => {
    assert.strictEqual(isLikelyExecutionError('ECONNREFUSED'), true);
  });

  it('detects "fetch failed" as execution error', () => {
    assert.strictEqual(isLikelyExecutionError('fetch failed'), true);
  });

  it('detects "Permission denied" as execution error', () => {
    assert.strictEqual(isLikelyExecutionError('Permission denied'), true);
  });

  it('detects "No such file" as execution error', () => {
    assert.strictEqual(isLikelyExecutionError('No such file or directory'), true);
  });

  it('empty string is not an execution error (fail-safe: runs detection)', () => {
    assert.strictEqual(isLikelyExecutionError(''), false);
  });
});

describe('FORMAT_ERROR_SENSITIVE_TOOLS', () => {
  it('includes read_file as format-sensitive', () => {
    assert.strictEqual(FORMAT_ERROR_SENSITIVE_TOOLS.has('read_file'), true);
  });

  it('includes Read as format-sensitive', () => {
    assert.strictEqual(FORMAT_ERROR_SENSITIVE_TOOLS.has('Read'), true);
  });

  it('does NOT include Bash as format-sensitive (common execution errors)', () => {
    assert.strictEqual(FORMAT_ERROR_SENSITIVE_TOOLS.has('Bash'), false);
  });

  it('does NOT include Grep as format-sensitive', () => {
    assert.strictEqual(FORMAT_ERROR_SENSITIVE_TOOLS.has('Grep'), false);
  });
});

describe('EXECUTION_ERROR_PATTERNS', () => {
  it('all patterns are RegExp instances', () => {
    for (const p of EXECUTION_ERROR_PATTERNS) {
      assert.ok(p instanceof RegExp, `${p} is not a RegExp`);
    }
  });
});
