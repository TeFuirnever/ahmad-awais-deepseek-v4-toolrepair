// Four core shape fixes for DeepSeek tool-calling errors.
// Order matters: parseJsonArray MUST run before wrapBareString,
// otherwise '["a","b"]' becomes ['["a","b"]'].
// Based on Ahmad Awais's research on CommandCodeAI.

function removeNulls(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { fixed: false, input };
  }
  let changed = false;
  const cleaned = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null) {
      changed = true;
      continue;
    }
    cleaned[key] = value;
  }
  return changed ? { fixed: true, input: cleaned, fix: 'remove-nulls' } : { fixed: false, input };
}

function parseJsonArray(input, path) {
  if (!path) return { fixed: false, input };

  const keys = path.split('.');
  let obj = input;
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj == null) return { fixed: false, input };
    obj = obj[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  if (obj == null) return { fixed: false, input };

  const val = obj[lastKey];
  if (typeof val !== 'string') return { fixed: false, input };

  const trimmed = val.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return { fixed: false, input };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      obj[lastKey] = parsed;
      return { fixed: true, input, fix: 'parse-json-array' };
    }
  } catch (_) {
    // Not valid JSON, skip
  }
  return { fixed: false, input };
}

function wrapSingleObject(input, path) {
  if (!path) return { fixed: false, input };

  const keys = path.split('.');
  let obj = input;
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj == null) return { fixed: false, input };
    obj = obj[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  if (obj == null) return { fixed: false, input };

  const val = obj[lastKey];
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    obj[lastKey] = [val];
    return { fixed: true, input, fix: 'wrap-single-object' };
  }
  return { fixed: false, input };
}

function wrapBareString(input, path) {
  if (!path) return { fixed: false, input };

  const keys = path.split('.');
  let obj = input;
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj == null) return { fixed: false, input };
    obj = obj[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  if (obj == null) return { fixed: false, input };

  const val = obj[lastKey];
  if (typeof val === 'string') {
    obj[lastKey] = [val];
    return { fixed: true, input, fix: 'wrap-bare-string' };
  }
  return { fixed: false, input };
}

// Apply fixes in correct order for a specific issue path.
// Note: removeNulls runs unconditionally and is object-global, not path-scoped —
// it strips ALL null fields from input, not just `path`. Safe because null
// optional fields are always removable, but the name suggests path-only action.
function applyFixesForPath(input, path, expectedType) {
  // Fix 1: remove nulls (only if input is object)
  const r1 = removeNulls(input);
  input = r1.input;

  // Fix 2: parse JSON string to array (MUST run before wrapBareString)
  if (expectedType === 'array') {
    const r2 = parseJsonArray(input, path);
    if (r2.fixed) return r2;
  }

  // Fix 3: wrap single object in array
  if (expectedType === 'array') {
    const r3 = wrapSingleObject(input, path);
    if (r3.fixed) return r3;
  }

  // Fix 4: wrap bare string in array
  if (expectedType === 'array') {
    const r4 = wrapBareString(input, path);
    if (r4.fixed) return r4;
  }

  return r1.fixed ? r1 : { fixed: false, input, fix: null };
}

module.exports = {
  removeNulls,
  parseJsonArray,
  wrapSingleObject,
  wrapBareString,
  applyFixesForPath,
};
