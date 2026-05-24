// OpenCode plugin — tool.execute.before hook for real input repair.
// This is the ONLY path that can actually modify tool_input before execution.
// Based on Ahmad Awais's research: validate-then-repair, not preprocess-then-validate.

/**
 * @type {import("@opencode-ai/plugin").Plugin}
 */
module.exports = async function ToolRepairPlugin({ project, client, $, directory }) {
  // Load the shared repair engine (copied alongside plugin at install time)
  const { validateAndRepair, logTelemetry } = require('./repair/repair-orchestrator');

  return {
    // MAIN: Repair tool inputs BEFORE execution
    "tool.execute.before": async (input, output) => {
      const toolName = input.tool || 'unknown';
      const toolInput = input.parameters || {};

      const result = validateAndRepair(toolName, toolInput);

      if (result.repaired) {
        // Replace with repaired parameters
        input.parameters = result.input;

        // Telemetry — metadata only, no values
        logTelemetry({
          tool: toolName,
          repaired: true,
          passThrough: false,
          fixes: result.fixes,
          errors: result.errors,
        });
      }
      // Valid inputs pass through untouched
    },

    // FALLBACK: Detect failures and inject repair guidance
    "tool.execute.after": async (input, output) => {
      if (!output.error) return;

      const toolName = input.tool || 'unknown';
      const errorText = output.error?.message || JSON.stringify(output.error);

      // Check for known DeepSeek error patterns
      const guidance = detectPatterns(toolName, input.parameters, errorText);
      if (guidance) {
        // Safe telemetry
        console.error(JSON.stringify({
          event: 'tool_failure_detected',
          tool: toolName,
          patterns: guidance.patterns,
          timestamp: new Date().toISOString(),
        }));

        // Inject guidance for model to see on retry
        output.error.context = guidance.message;
      }
    },
  };
};

function detectPatterns(toolName, toolInput, errorText) {
  const patterns = [];
  const suggestions = [];

  // Zod validation errors
  if (errorText.includes('ZodError') || errorText.includes('invalid_type')) {
    patterns.push('zod-validation');
    suggestions.push('Schema validation failed.');
    const fieldMatch = errorText.match(/["'](\w+)["']/g);
    if (fieldMatch) {
      const fields = [...new Set(fieldMatch.map(f => f.replace(/["']/g, '')))];
      suggestions.push(`Affected fields: ${fields.join(', ')}`);
    }
    suggestions.push('Omit null optional fields. Use actual arrays, not JSON strings. Wrap single values in arrays.');
  }

  // Array type mismatch
  if (errorText.includes('Expected array')) {
    patterns.push('array-mismatch');
    suggestions.push('Expected array but got something else. Wrap single values in []: "foo" → ["foo"].');
  }

  // Relational invariants
  if ((toolInput.offset !== undefined && toolInput.limit === undefined) ||
      (toolInput.limit !== undefined && toolInput.offset === undefined)) {
    patterns.push('relational-invariant');
    suggestions.push('read_file needs both offset AND limit. Add the missing one (offset default: 0, limit default: 2000).');
  }

  if (patterns.length === 0) return null;

  return {
    patterns,
    message: [
      `Tool "${toolName}" failed. Issues detected:`,
      ...suggestions.map(s => `- ${s}`),
      'Please retry with corrected format.',
    ].join('\n'),
  };
}
