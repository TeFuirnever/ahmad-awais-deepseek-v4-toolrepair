const { describe, it } = require('node:test');
const assert = require('node:assert');
const { fixMarkdownAutolink, fixAutolinksInPaths } = require('../../src/repair/autolink-fix');

describe('fixMarkdownAutolink', () => {
  it('repairs http autolink', () => {
    const r = fixMarkdownAutolink('[notes.md](http://notes.md)');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.value, 'notes.md');
  });

  it('repairs https autolink', () => {
    const r = fixMarkdownAutolink('[file.txt](https://file.txt)');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.value, 'file.txt');
  });

  it('repairs autolink with trailing slash', () => {
    const r = fixMarkdownAutolink('[notes.md](http://notes.md/)');
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.value, 'notes.md');
  });

  it('blocks path traversal (..)', () => {
    const r = fixMarkdownAutolink('[../../etc/passwd](http://../../etc/passwd)');
    assert.strictEqual(r.fixed, false, 'must reject path traversal');
  });

  it('blocks control characters', () => {
    const r = fixMarkdownAutolink('[test\x00.md](http://test\x00.md)');
    assert.strictEqual(r.fixed, false, 'must reject null byte');
  });

  it('blocks HTML-like content', () => {
    const r = fixMarkdownAutolink('[<script>](http://<script>)');
    assert.strictEqual(r.fixed, false, 'must reject HTML tags');
  });

  it('does NOT repair real markdown links', () => {
    const r = fixMarkdownAutolink('[click here](https://example.com/page)');
    assert.strictEqual(r.fixed, false);
  });

  it('returns fixed:false for non-string input', () => {
    const r = fixMarkdownAutolink(123);
    assert.strictEqual(r.fixed, false);
  });
});

describe('fixAutolinksInPaths', () => {
  it('repairs autolinks in object fields', () => {
    const input = { file_path: '[notes.md](http://notes.md)', content: 'hello' };
    const r = fixAutolinksInPaths(input);
    assert.strictEqual(r.fixed, true);
    assert.strictEqual(r.input.file_path, 'notes.md');
    assert.strictEqual(r.input.content, 'hello');
  });

  it('returns fixed:false when no autolinks present', () => {
    const input = { file_path: '/tmp/notes.md' };
    const r = fixAutolinksInPaths(input);
    assert.strictEqual(r.fixed, false);
  });
});
