// Live API benchmark — calls DeepSeek V4 with tool-calling prompts,
// captures raw tool_use output, runs validateAndRepair, and computes
// real Before/After acceptance rates.
//
// Methodology:
//   1. Each scenario probes a known failure pattern (null-in-optional,
//      json-string-array, autolink-path, wrap-object, bare-string, relational).
//   2. Oracle: accepted iff passThrough OR (repaired && errors.length === 0).
//   3. Baseline: raw input from DeepSeek, fed directly to oracle (no repair).
//   4. Repaired: raw input run through validateAndRepair → oracle.
//   5. Reports per-pattern + aggregate rates.
//
// Prerequisites: ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL (or DEEPSEEK_API_KEY).
//   via Anthropic-compat: ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
//   via native:           DEEPSEEK_API_KEY=sk-...  DEEPSEEK_BASE_URL=https://api.deepseek.com
//
// Run: node scripts/live-bench.js
// Output: live-bench-results.json

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { validateAndRepair } = require('../src/repair/repair-orchestrator');

// ---- API transport (Anthropic-compat) ----

function callDeepSeek({ model, messages, tools, max_tokens = 1024 }) {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/anthropic';
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.DEEPSEEK_API_KEY || '';
  const url = baseUrl + '/v1/messages';

  if (!apiKey) {
    return Promise.reject(new Error('set ANTHROPIC_AUTH_TOKEN or DEEPSEEK_API_KEY'));
  }

  const body = JSON.stringify({ model, max_tokens, messages, tools: tools || undefined });

  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API ${res.statusCode}: ${data.substring(0, 500)}`));
          return;
        }
        resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---- Test scenarios ----
// Each scenario has a prompt engineered to trigger a tool call that is
// likely to exhibit a particular DeepSeek V4 format error.

const SCENARIOS = [
  // null-in-optional: DeepSeek often includes `offset: null, limit: null`
  {
    id: 'null-optional-read',
    pattern: 'null-in-optional',
    messages: [{ role: 'user', content: 'use the Read tool to read file "/tmp/bench.ts" with offset null and limit null' }],
    tools: [{ name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } }, required: ['file_path'] } }],
  },
  {
    id: 'null-optional-bash',
    pattern: 'null-in-optional',
    messages: [{ role: 'user', content: 'run: ls -la, with timeout null, run_in_background null' }],
    tools: [{ name: 'Bash', description: 'Run a bash command', input_schema: { type: 'object', properties: { command: { type: 'string' }, timeout: { type: 'number' }, run_in_background: { type: 'boolean' } }, required: ['command'] } }],
  },
  // json-string-array: DeepSeek produces args as JSON string "[...]" instead of array
  {
    id: 'json-string-array',
    pattern: 'json-string-array',
    messages: [{ role: 'user', content: 'run: grep -r foo src/ --include="*.ts" --exclude="*.test.ts"' }],
    tools: [{ name: 'Bash', description: 'Run a bash command', input_schema: { type: 'object', properties: { command: { type: 'string' }, args: { type: 'array', items: { type: 'string' } } }, required: ['command'] } }],
  },
  // wrap-object: DeepSeek wraps single object {value:'hi'} where array expected
  {
    id: 'wrap-object',
    pattern: 'wrap-object',
    messages: [{ role: 'user', content: 'run: echo hello, with args as a single object {value:"hello"}' }],
    tools: [{ name: 'Bash', description: 'Run a bash command', input_schema: { type: 'object', properties: { command: { type: 'string' }, args: { type: 'array', items: { type: 'string' } } }, required: ['command'] } }],
  },
  // bare-string: DeepSeek passes "src/" (string) where array expected
  {
    id: 'bare-string-args',
    pattern: 'bare-string',
    messages: [{ role: 'user', content: 'run: ls src/ with args as just a string "src/"' }],
    tools: [{ name: 'Bash', description: 'Run a bash command', input_schema: { type: 'object', properties: { command: { type: 'string' }, args: { type: 'array', items: { type: 'string' } } }, required: ['command'] } }],
  },
  // autolink-path: DeepSeek wraps paths in markdown autolinks
  {
    id: 'autolink-read',
    pattern: 'autolink-path',
    messages: [{ role: 'user', content: 'read file [notes.md] from http host' }],
    tools: [{ name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } }],
  },
  // relational: offset without limit
  {
    id: 'relational-offset',
    pattern: 'relational',
    messages: [{ role: 'user', content: 'read file "/tmp/bench.ts" starting from offset 100, no limit' }],
    tools: [{ name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } }, required: ['file_path'] } }],
  },
  // TodoWrite: DeepSeek sometimes JSON-stringifies the todos array
  {
    id: 'todowrite-json-array',
    pattern: 'json-string-array',
    messages: [{ role: 'user', content: 'Create 2 todos: "fix bug" (pending) and "add test" (pending). Use TodoWrite with todos as: "[{\\"content\\":\\"fix bug\\",\\"status\\":\\"pending\\",\\"activeForm\\":\\"fix bug\\"},{\\"content\\":\\"add test\\",\\"status\\":\\"pending\\",\\"activeForm\\":\\"add test\\"}]"' }],
    tools: [{ name: 'TodoWrite', description: 'Write todos', input_schema: { type: 'object', properties: { todos: { type: 'array' } }, required: ['todos'] } }],
  },
  // null encoding on write
  {
    id: 'write-null-encoding',
    pattern: 'null-in-optional',
    messages: [{ role: 'user', content: 'write file "/tmp/bench.txt" with content "hello world" and encoding null' }],
    tools: [{ name: 'write_to_file', description: 'Write a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' }, encoding: { type: 'string' } }, required: ['file_path', 'content'] } }],
  },
  // Grep: search with null optional params (DeepSeek should omit them cleanly)
  {
    id: 'grep-clean',
    pattern: 'valid-passthrough',
    messages: [{ role: 'user', content: 'search for "TODO" in the project with no path or include filters' }],
    tools: [{ name: 'Grep', description: 'Search code', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, include: { type: 'string' }, head_limit: { type: 'number' } }, required: ['pattern'] } }],
  },
  // valid control: a prompt where the tool call should be clean
  {
    id: 'valid-control',
    pattern: 'valid-passthrough',
    messages: [{ role: 'user', content: 'read file "/tmp/ok.txt"' }],
    tools: [{ name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } }],
  },
];

// ---- Extract tool_use from Anthropic-compat response ----
// DeepSeek may return content blocks of type "tool_use".

function extractToolCalls(response) {
  const blocks = [];
  for (const block of (response.content || [])) {
    if (block.type === 'tool_use') {
      blocks.push({ name: block.name, input: block.input || {} });
    }
  }
  return blocks;
}

// ---- Oracle (same as shadow-bench) ----

function isAccepted(toolName, rawInput) {
  const r = validateAndRepair(toolName, rawInput);
  if (r.passThrough) return { accepted: true, mode: 'passthrough' };
  if (r.repaired && r.errors.length === 0) return { accepted: true, mode: 'repaired' };
  return { accepted: false, mode: 'rejected', errors: r.errors };
}

function baselineAccepted(toolName, rawInput) {
  const r = validateAndRepair(toolName, rawInput);
  return r.passThrough && r.fixes.length === 0 && r.errors.length === 0;
}

// ---- Main ----

const DEEPSEEK_MODEL = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME || process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

async function run() {
  const startedAt = new Date().toISOString();

  console.log(`=== Live API Benchmark ===`);
  console.log(`Model:  ${DEEPSEEK_MODEL}`);
  console.log(`API:    ${process.env.ANTHROPIC_BASE_URL || 'default'}`);
  console.log(`Scenarios: ${SCENARIOS.length}\n`);

  const results = [];
  const byPattern = new Map();
  let totalCalls = 0;
  let baselinePass = 0;
  let repairedPass = 0;

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.id} [${scenario.pattern}] ... `);
    try {
      const response = await callDeepSeek({
        model: DEEPSEEK_MODEL,
        messages: scenario.messages,
        tools: scenario.tools,
      });

      // Handle Anthropic-compat stop_reason or finish_reason
      const stopReason = response.stop_reason || 'unknown';
      const toolCalls = extractToolCalls(response);

      if (toolCalls.length === 0) {
        // No tool call — model chose to reply in text. Count as N/A (neither pass nor fail).
        const textResp = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').substring(0, 80);
        console.log(`no tool call (text: "${textResp}")`);
        results.push({ scenario: scenario.id, pattern: scenario.pattern, no_tool_call: true, stop_reason: stopReason });
        continue;
      }

      for (const tc of toolCalls) {
        totalCalls++;
        const baseline = baselineAccepted(tc.name, structuredClone(tc.input));
        const repaired = isAccepted(tc.name, structuredClone(tc.input));

        if (baseline) baselinePass++;
        if (repaired.accepted) repairedPass++;

        bump(byPattern, scenario.pattern, baseline, repaired.accepted);

        const icon = repaired.accepted ? '✓' : '✗';
        const flag = baseline ? 'passthrough' : repaired.accepted ? 'REPAIRED' : 'REJECTED';
        console.log(`${icon} ${tc.name} {${JSON.stringify(tc.input).substring(0, 100)}} → ${flag}`);

        results.push({
          scenario: scenario.id,
          pattern: scenario.pattern,
          tool: tc.name,
          input: tc.input,
          baseline: baseline,
          repaired: repaired.accepted,
          mode: repaired.mode,
          errors: repaired.errors || [],
          stop_reason: stopReason,
        });
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results.push({ scenario: scenario.id, pattern: scenario.pattern, error: e.message });
    }
  }

  const finishedAt = new Date().toISOString();

  const report = {
    methodology: {
      oracle: 'schema-validation: accepted iff passThrough OR (repaired AND errors.length===0)',
      baseline: 'unrepaired: raw DeepSeek output fed to oracle with no repair',
      repaired: 'full pipeline: validateAndRepair applied to raw DeepSeek output',
      model: DEEPSEEK_MODEL,
      api_url: process.env.ANTHROPIC_BASE_URL || 'default',
    },
    startedAt,
    finishedAt,
    totals: {
      scenarios: SCENARIOS.length,
      total_tool_calls: totalCalls,
      baseline_accepted: baselinePass,
      baseline_rate: totalCalls ? round(baselinePass / totalCalls) : 0,
      repaired_accepted: repairedPass,
      repaired_rate: totalCalls ? round(repairedPass / totalCalls) : 0,
      uplift_points: totalCalls ? round((repairedPass - baselinePass) / totalCalls) : 0,
    },
    by_pattern: toObject(byPattern),
    raw_results: results,
  };

  const outPath = path.resolve(__dirname, '..', 'live-bench-results.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  console.log(`\n=== Results ===`);
  console.log(`Total tool calls: ${totalCalls}`);
  console.log(`Baseline (raw):   ${baselinePass}/${totalCalls} (${pct(baselinePass, totalCalls)})`);
  console.log(`Repaired:         ${repairedPass}/${totalCalls} (${pct(repairedPass, totalCalls)})`);
  console.log(`Uplift:           +${repairedPass - baselinePass} (+${pct(repairedPass - baselinePass, totalCalls)})`);
  console.log(`\nArtifact: ${outPath}`);

  if (totalCalls === 0) {
    console.log('\nWARNING: No tool calls captured. DeepSeek may have replied in text for all prompts.');
    process.exitCode = 1;
  }
}

function bump(map, key, baseline, repaired) {
  const cur = map.get(key) || { total: 0, baseline_accepted: 0, repaired_accepted: 0 };
  cur.total += 1;
  if (baseline) cur.baseline_accepted += 1;
  if (repaired) cur.repaired_accepted += 1;
  map.set(key, cur);
}

function toObject(map) {
  const out = {};
  for (const [k, v] of map) {
    out[k] = { ...v, baseline_rate: round(v.baseline_accepted / v.total), repaired_rate: round(v.repaired_accepted / v.total) };
  }
  return out;
}

function round(n) { return Math.round(n * 1000) / 1000; }
function pct(n, d) { return d ? ((n / d) * 100).toFixed(1) + '%' : 'N/A'; }

run();
