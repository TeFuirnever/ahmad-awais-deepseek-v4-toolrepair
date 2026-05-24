// Fix markdown autolinks in file paths.
// DeepSeek sometimes outputs [file.md](http://file.md) instead of /path/to/file.md.
// Only fix when link text equals URL without protocol — real markdown like [click](https://x.com) is untouched.

function fixMarkdownAutolink(value) {
  if (typeof value !== 'string') return { fixed: false, value };

  // Match [text](http://text) pattern — link text equals URL without protocol
  const match = value.match(/^\[([^\]]+)\]\(https?:\/\/\1\/?\)$/);
  if (!match) return { fixed: false, value };

  const extracted = match[1];

  // Security: reject path traversal, control chars, HTML, or prompt injection patterns
  if (/[\x00-\x1f<>]/.test(extracted) || extracted.includes('..')) return { fixed: false, value };

  return { fixed: true, value: extracted, fix: 'autolink' };
}

function fixAutolinksInPaths(input) {
  let changed = false;
  const fixes = [];

  function walk(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const result = fixMarkdownAutolink(val);
        if (result.fixed) {
          obj[key] = result.value;
          changed = true;
          fixes.push(key);
        }
      } else if (typeof val === 'object' && val !== null) {
        walk(val);
      }
    }
  }

  walk(input);
  return { fixed: changed, input, fixes, fix: 'autolink' };
}

module.exports = { fixMarkdownAutolink, fixAutolinksInPaths };
