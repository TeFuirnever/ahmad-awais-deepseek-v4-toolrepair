// Validate-then-repair orchestrator.
// Core insight from Ahmad Awais: validate first, only repair what failed.
// Valid inputs pass through untouched — no false positives.
//
// 1. Try parsing input → success = pass through
// 2. If failure → iterate validator issues, try 4 fixes in order
// 3. Re-parse → success = log tool_input_repaired, failure = return errors

const { applyFixesForPath, removeNulls } = require('./shape-fixes');
const { fixAutolinksInPaths } = require('./autolink-fix');
const { applyRelationalFixes } = require('./relational-fix');

// Schema registry: maps field names to types. '!' suffix = required field.
// 'path' = file path string (gets autolink detection + traversal check).
const toolSchemas = {
  read_file: {
    file_path: 'path!',
    offset: 'number',
    limit: 'number',
  },
  write_to_file: {
    file_path: 'path!',
    content: 'string!',
  },
  edit_file: {
    file_path: 'path!',
    old_string: 'string!',
    new_string: 'string!',
    replace_all: 'boolean',
  },
  search_content: {
    directory: 'path!',
    pattern: 'string!',
    file_types: 'string',
    output_mode: 'string',
  },
  execute_command: {
    command: 'string!',
    args: 'array',
    requires_approval: 'boolean',
  },
  list_files: {
    target_directory: 'path!',
    depth: 'number',
    offset: 'number',
    limit: 'number',
  },
  Read: {
    file_path: 'path!',
    offset: 'number',
    limit: 'number',
  },
};

function getSchema(toolName) {
  return toolSchemas[toolName] || null;
}

function tryParse(input) {
  // If input is already an object, validate with known schema
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    return { valid: true, input, errors: [] };
  }
  // If input is a string, try JSON parse
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'object' && parsed !== null) {
        return { valid: true, input: parsed, errors: [] };
      }
    } catch (_) {}
  }
  return { valid: false, input, errors: [{ path: '', expected: 'object', received: typeof input }] };
}

function validateField(input, schema) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return [{ path: '', expected: 'object', received: input === null ? 'null' : typeof input }];
  }
  const errors = [];
  for (const [key, rawType] of Object.entries(schema)) {
    const required = rawType.endsWith('!');
    const expectedType = required ? rawType.slice(0, -1) : rawType;
    const val = input[key];

    if (val === undefined || val === null) {
      if (required) {
        errors.push({ path: key, expected: expectedType, received: 'missing' });
      }
      continue;
    }

    if (expectedType === 'array' && !Array.isArray(val)) {
      errors.push({ path: key, expected: 'array', received: typeof val });
    }
    if (expectedType === 'string' && typeof val !== 'string') {
      errors.push({ path: key, expected: 'string', received: typeof val });
    }
    if (expectedType === 'path' && typeof val !== 'string') {
      errors.push({ path: key, expected: 'path', received: typeof val });
    }
    if (expectedType === 'number' && typeof val !== 'number') {
      errors.push({ path: key, expected: 'number', received: typeof val });
    }
    if (expectedType === 'boolean' && typeof val !== 'boolean') {
      errors.push({ path: key, expected: 'boolean', received: typeof val });
    }
    if (expectedType === 'object' && (typeof val !== 'object' || val === null || Array.isArray(val))) {
      errors.push({ path: key, expected: 'object', received: typeof val });
    }
  }
  return errors;
}

// Returns { repaired, input, fixes, errors, passThrough, retryMessage? }.
// repaired=true means at least one fix was applied — NOT that input is fully valid.
// Check errors.length to distinguish full repair (errors=[]) from partial (errors.length>0).
// When errors.length>0, retryMessage is always populated for model feedback.
function validateAndRepair(toolName, toolInput) {
  const result = {
    repaired: false,
    input: toolInput,
    fixes: [],
    errors: [],
    passThrough: true,
  };

  // Step 1: Try direct parse
  const parsed = tryParse(toolInput);
  if (parsed.valid) {
    let input = parsed.input;

    // Step 1a: Remove nulls from all objects (safe — just strips null optional fields)
    const nullResult = removeNulls(input);
    if (nullResult.fixed) {
      input = nullResult.input;
      result.fixes.push({ type: 'remove-nulls' });
      result.passThrough = false;
    }

    // Step 1b: Fix autolinks in path-typed fields only
    const schema = getSchema(toolName);
    const autolinkResult = fixAutolinksInPaths(input, schema);
    if (autolinkResult.fixed) {
      input = autolinkResult.input;
      result.fixes.push({ type: 'autolink', fields: autolinkResult.fixes });
      result.passThrough = false;
    }

    // Step 1c: Fix relational invariants
    const relationResult = applyRelationalFixes(toolName, input);
    if (relationResult.repaired) {
      input = relationResult.input;
      result.fixes.push({ type: 'relational', notes: relationResult.notes });
      result.passThrough = false;
    }

    // Step 1d: Fix field-level type mismatches against schema
    // Handles wrap-single-object / wrap-bare-string for array-typed fields
    if (schema) {
      const errors = validateField(input, schema);
      for (const error of errors) {
        const fixResult = applyFixesForPath(input, error.path, error.expected);
        if (fixResult.fixed) {
          input = fixResult.input;
          result.fixes.push({ type: fixResult.fix, path: error.path });
          result.passThrough = false;
        } else {
          // Fix not applicable — record error for caller
          result.errors.push(error);
        }
      }
    }

    result.input = input;
    if (result.fixes.length > 0) {
      result.repaired = true;
    }
    if (result.errors.length > 0) {
      result.retryMessage = generateRetryMessage(toolName, result.errors, result.fixes);
    }
    return result;
  }

  // Step 2: Parse failed — try shape fixes
  result.passThrough = false;
  let input = parsed.input;
  const schema = getSchema(toolName);

  if (schema) {
    const errors = validateField(input, schema);
    if (errors.length > 0) {
      result.errors = errors;

      for (const error of errors) {
        const fixResult = applyFixesForPath(input, error.path, error.expected);
        if (fixResult.fixed) {
          input = fixResult.input;
          result.fixes.push({ type: fixResult.fix, path: error.path });
        }
      }
    } else {
      // No schema-level errors found — keep parse errors for non-object inputs
      result.errors = parsed.errors;
    }
  } else {
    result.errors = parsed.errors;
  }

  // Step 2a: Also try autolink fix
  const autolinkResult = fixAutolinksInPaths(input, schema);
  if (autolinkResult.fixed) {
    input = autolinkResult.input;
    result.fixes.push({ type: 'autolink', fields: autolinkResult.fixes });
  }

  // Step 2b: Try relational fix
  const relationResult = applyRelationalFixes(toolName, input);
  if (relationResult.repaired) {
    input = relationResult.input;
    result.fixes.push({ type: 'relational', notes: relationResult.notes });
  }

  // Step 3: Re-validate after fixes
  if (result.fixes.length > 0) {
    const recheck = tryParse(input);
    if (recheck.valid) {
      result.repaired = true;
      result.input = recheck.input;
      result.passThrough = false;
    } else {
      result.repaired = false;
      result.input = toolInput; // Return original on failure
      result.retryMessage = generateRetryMessage(toolName, result.errors, result.fixes);
    }
  }

  if (result.errors.length > 0 && !result.retryMessage) {
    result.retryMessage = generateRetryMessage(toolName, result.errors, result.fixes);
  }

  return result;
}

// Generate a model-readable retry message
function generateRetryMessage(toolName, errors, fixes) {
  const lines = [];
  lines.push(`Tool call "${toolName}" had format errors:`);
  for (const err of errors) {
    lines.push(`- Field "${err.path}" expected ${err.expected}, got ${err.received}`);
  }
  if (fixes.length > 0) {
    lines.push('Auto-repair attempted:');
    for (const fix of fixes) {
      lines.push(`- Applied: ${fix.type} on ${fix.path || fix.fields?.join(', ') || 'input'}`);
      if (fix.notes) {
        for (const note of fix.notes) {
          lines.push(`  Note: ${note}`);
        }
      }
    }
  }
  lines.push('Please retry with corrected format.');
  return lines.join('\n');
}

// Safe telemetry — only metadata, never values
function logTelemetry(telemetry) {
  console.error(JSON.stringify({
    event: telemetry.repaired ? 'tool_input_repaired' : 'tool_input_invalid',
    tool: telemetry.tool,
    repaired: telemetry.repaired,
    pass_through: telemetry.passThrough,
    fixes: telemetry.fixes?.map(f => f.type),
    error_count: telemetry.errors?.length || 0,
    timestamp: new Date().toISOString(),
  }));
}

module.exports = { validateAndRepair, generateRetryMessage, logTelemetry };
