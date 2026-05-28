#!/usr/bin/env node
// SECURITY: This script MUST NOT import http, https, net, dgram, child_process, or dns.
// It is a pure data transformer operating on stdin/stdout only.

// PostToolUseFailure hook for Claude Code.
// Detects DeepSeek tool-calling format errors and injects repair guidance via additionalContext.

const readline = require('readline');

function main() {
  let stdinData = '';

  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    stdinData += line;
  });

  rl.on('close', () => {
    try {
      const event = JSON.parse(stdinData);
      const toolName = event.tool_name || 'unknown';
      const toolInput = event.tool_input || {};
      const errorOutput = event.tool_output || '';

      const guidance = detectAndGenerateGuidance(toolName, toolInput, errorOutput);

      // Only output if we detected something
      if (guidance) {
        // Safe telemetry — metadata only, no values
        console.error(JSON.stringify({
          event: 'tool_failure_detected',
          tool: toolName,
          patterns: guidance.patterns,
          timestamp: new Date().toISOString(),
        }));

        console.log(JSON.stringify({
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'PostToolUseFailure',
            additionalContext: guidance.message,
          },
        }));
      } else {
        // Pass through — no repair guidance needed
        console.log(JSON.stringify({ continue: true }));
      }
    } catch (err) {
      // On parse error, pass through
      console.error(JSON.stringify({
        event: 'hook_error',
        error: 'parse_failed',
      }));
      console.log(JSON.stringify({ continue: true }));
    }
  });
}

// Tools DeepSeek historically breaks format on (known from shadow-bench corpus).
// Only these tools get unconditional detection; others skip when the error
// clearly looks like a real execution failure (fail-safe: unknown -> run).
const FORMAT_ERROR_SENSITIVE_TOOLS = new Set([
  'read_file', 'Read', 'write_to_file', 'edit_file', 'execute_command', 'list_files'
]);

// POSIX/OS error patterns only — deliberately excludes bare "Error:" to avoid
// matching ZodError, TypeError, SyntaxError etc. which may indicate format errors.
const EXECUTION_ERROR_PATTERNS = [
  /command not found/i,
  /No such file/i,
  /Permission denied/i,
  /ENOENT/,
  /EACCES:/,
  /EISDIR:/,
  /EPERM:/,
  /EEXIST:/,
  /ENOTDIR:/,
  /EMFILE:/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /fetch failed/i,
];

function isLikelyExecutionError(errorOutput) {
  return EXECUTION_ERROR_PATTERNS.some(p => p.test(errorOutput));
}

function detectAndGenerateGuidance(toolName, toolInput, errorOutput) {
  // Fast-filter: skip detection only when BOTH:
  // 1. Tool is NOT in the format-error-sensitive set, AND
  // 2. Error output matches known execution error patterns
  // Unknown tools + unknown error patterns → run full detection (fail-safe)
  if (!FORMAT_ERROR_SENSITIVE_TOOLS.has(toolName) && isLikelyExecutionError(errorOutput)) {
    console.error(JSON.stringify({
      event: 'hook_detection_skipped',
      tool: toolName,
      reason: 'execution_error',
      timestamp: new Date().toISOString(),
    }));
    return null; // null → main() outputs {"continue":true} passthrough
  }

  const patterns = [];
  const suggestions = [];

  // Pattern 1: Zod validation blob (DeepSeek returns raw zod errors)
  if (errorOutput.includes('ZodError') || errorOutput.includes('invalid_type')) {
    patterns.push('zod-validation');
    suggestions.push('Tool call rejected by schema validator.');

    // Try to extract field info
    const fieldMatch = errorOutput.match(/["'](\w+)["']/g);
    if (fieldMatch) {
      const fields = [...new Set(fieldMatch.map(f => f.replace(/["']/g, '')))];
      suggestions.push(`Check fields: ${fields.join(', ')}`);
    }
  }

  // Pattern 2: Markdown autolink in path
  if (typeof errorOutput === 'string' && errorOutput.includes('[') && errorOutput.includes('](')) {
    patterns.push('markdown-autolink');
    suggestions.push('File paths contain markdown autolinks. Use plain paths: /absolute/path/to/file.md');
  }

  // Pattern 3: Array type mismatch
  if (errorOutput.includes('Expected array') || errorOutput.includes('Expected string')) {
    patterns.push('type-mismatch');
    suggestions.push('Type mismatch in tool input. Remember: arrays as [], strings as "value", omit null optional fields.');
  }

  // Pattern 4: Offset/limit relational error
  if ((toolInput.offset !== undefined && toolInput.limit === undefined) ||
      (toolInput.limit !== undefined && toolInput.offset === undefined)) {
    patterns.push('relational-invariant');
    suggestions.push('read_file requires both offset AND limit, or neither. If only limit: add offset=0. If only offset: add limit=2000.');
  }

  if (patterns.length === 0) return null;

  return {
    patterns,
    message: [
      'Tool call "' + toolName + '" failed. Detected issues:',
      '',
      ...suggestions.map(s => '- ' + s),
      '',
      'Please retry the tool call with corrected inputs.',
    ].join('\n'),
  };
}

if (require.main === module) {
  main();
} else {
  module.exports = { detectAndGenerateGuidance, isLikelyExecutionError, FORMAT_ERROR_SENSITIVE_TOOLS, EXECUTION_ERROR_PATTERNS };
}
