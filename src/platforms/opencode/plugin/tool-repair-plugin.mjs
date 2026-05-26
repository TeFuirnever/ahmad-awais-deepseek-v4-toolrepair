// OpenCode plugin — tool.execute.before hook for real input repair.
// ESM-only: OpenCode loads file:// plugins via dynamic import.
//
// Hook signatures (from @opencode-ai/plugin):
//   "tool.execute.before"(input: {tool,sessionID,callID}, output: {args}) => Promise<void>
//   "tool.execute.after"(input: {tool,sessionID,callID,args}, output: {title,output,metadata}) => Promise<void>
//
// Repair happens by mutating output.args in `before`. There is no error field
// in `after` — OpenCode invokes it only on success — so this plugin no longer
// pretends to inject failure-recovery guidance. Run-time failures bubble up
// to the model as ordinary tool errors; structural failures get fixed before
// the tool runs.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateAndRepair, logTelemetry } = require('./repair/repair-orchestrator');

export default async function ToolRepairPlugin(_ctx) {
  return {
    "tool.execute.before": async (input, output) => {
      const toolName = input.tool || 'unknown';
      const toolInput = output.args || {};

      const result = validateAndRepair(toolName, toolInput);

      if (result.repaired) {
        // OpenCode may capture `output.args` by reference at hook-call time;
        // mutate the original object in-place AND reassign, so either capture
        // pattern picks up the repaired shape.
        for (const k of Object.keys(toolInput)) {
          if (!(k in result.input)) delete toolInput[k];
        }
        Object.assign(toolInput, result.input);
        output.args = toolInput;

        logTelemetry({
          tool: toolName,
          repaired: true,
          passThrough: false,
          fixes: result.fixes,
          errors: result.errors,
        });
      }
    },
  };
}
