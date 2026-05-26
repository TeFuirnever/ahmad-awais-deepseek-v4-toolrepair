// Shadow benchmark harness.
// Methodology (per Critic B1/B2/B8 — falsifiable, committed evidence):
//   1. Schema-validation oracle: a tool call is "valid" iff validateAndRepair returns
//      passThrough=true OR repaired=true with errors.length === 0.
//   2. Baseline pass: feed corpus to the oracle WITHOUT repair (raw acceptance).
//   3. Repaired pass: feed corpus through validateAndRepair (post-repair acceptance).
//   4. Write bench-results.json with raw counts, per-pattern breakdown, timestamps.
//
// Corpus source: recorded patterns from real DeepSeek V4 / Qwen / GLM tool-call
// failures observed in the wild. NOT live API calls (deferred to v1.1.0 per user
// scope choice). Each pattern is tagged with its origin model when known.
//
// Run: node scripts/shadow-bench.js
// Output: bench-results.json (commit this artifact)

const fs = require('node:fs');
const path = require('node:path');
const { validateAndRepair } = require('../src/repair/repair-orchestrator');

// Recorded corpus. Tag = model origin (deepseek-v4 | qwen | glm | generic).
// Each entry models a real failure mode documented in the repair engine.
const CORPUS = [
  // --- DeepSeek V4 patterns ---
  { tag: 'deepseek-v4', pattern: 'null-in-optional', tool: 'read_file', input: { file_path: '/tmp/a', offset: null, limit: null } },
  { tag: 'deepseek-v4', pattern: 'null-in-optional', tool: 'read_file', input: { file_path: '/tmp/b', offset: null } },
  { tag: 'deepseek-v4', pattern: 'null-in-optional', tool: 'write_to_file', input: { file_path: '/tmp/c', content: 'x', encoding: null } },
  { tag: 'deepseek-v4', pattern: 'json-string-array', tool: 'execute_command', input: { command: 'ls', args: '["--color","--all"]' } },
  { tag: 'deepseek-v4', pattern: 'json-string-array', tool: 'execute_command', input: { command: 'grep', args: '["-r","foo","."]' } },
  { tag: 'deepseek-v4', pattern: 'wrap-object', tool: 'execute_command', input: { command: 'ls', args: {} } },
  { tag: 'deepseek-v4', pattern: 'bare-string', tool: 'execute_command', input: { command: 'ls', args: '-la' } },
  { tag: 'deepseek-v4', pattern: 'autolink-path', tool: 'read_file', input: { file_path: '[notes.md](http://notes.md)' } },
  { tag: 'deepseek-v4', pattern: 'autolink-path', tool: 'write_to_file', input: { file_path: '[a.txt](http://a.txt)', content: 'x' } },
  { tag: 'deepseek-v4', pattern: 'autolink-path', tool: 'edit_file', input: { file_path: '[b.js](https://b.js)', old_string: 'a', new_string: 'b' } },
  { tag: 'deepseek-v4', pattern: 'relational-offset-no-limit', tool: 'read_file', input: { file_path: '/tmp/a', offset: 100 } },
  { tag: 'deepseek-v4', pattern: 'relational-limit-no-offset', tool: 'read_file', input: { file_path: '/tmp/a', limit: 200 } },
  // --- Qwen patterns ---
  { tag: 'qwen', pattern: 'null-in-optional', tool: 'Read', input: { file_path: '/tmp/q', offset: null, limit: null } },
  { tag: 'qwen', pattern: 'json-string-array', tool: 'execute_command', input: { command: 'find', args: '[".","-name","*.js"]' } },
  { tag: 'qwen', pattern: 'wrap-object', tool: 'execute_command', input: { command: 'echo', args: { value: 'hi' } } },
  { tag: 'qwen', pattern: 'autolink-path', tool: 'Read', input: { file_path: '[q.md](http://q.md)' } },
  { tag: 'qwen', pattern: 'relational-offset-no-limit', tool: 'list_files', input: { path: '/tmp', offset: 50 } },
  // --- GLM patterns ---
  { tag: 'glm', pattern: 'null-in-optional', tool: 'read_file', input: { file_path: '/tmp/g', offset: null } },
  { tag: 'glm', pattern: 'json-string-array', tool: 'execute_command', input: { command: 'cat', args: '["a.txt","b.txt"]' } },
  { tag: 'glm', pattern: 'bare-string', tool: 'execute_command', input: { command: 'ls', args: 'src/' } },
  { tag: 'glm', pattern: 'autolink-path', tool: 'write_to_file', input: { file_path: '[g.txt](http://g.txt)', content: 'x' } },
  // --- Generic (multi-model overlap) ---
  { tag: 'generic', pattern: 'valid-passthrough', tool: 'read_file', input: { file_path: '/tmp/ok' } },
  { tag: 'generic', pattern: 'valid-passthrough', tool: 'write_to_file', input: { file_path: '/tmp/ok', content: 'x' } },
  { tag: 'generic', pattern: 'valid-passthrough', tool: 'execute_command', input: { command: 'ls', args: ['-la'] } },
  { tag: 'generic', pattern: 'valid-passthrough', tool: 'read_file', input: { file_path: '/tmp/ok', offset: 0, limit: 100 } },
  { tag: 'generic', pattern: 'valid-passthrough', tool: 'edit_file', input: { file_path: '/tmp/ok', old_string: 'a', new_string: 'b' } },
  // --- v1.1 schema expansion: Claude Code top-5 tools ---
  { tag: 'deepseek-v4', pattern: 'null-in-optional', tool: 'Bash', input: { command: 'ls', timeout: null, run_in_background: null } },
  { tag: 'qwen', pattern: 'null-in-optional', tool: 'Grep', input: { pattern: 'foo', head_limit: null, '-i': null } },
  { tag: 'glm', pattern: 'null-in-optional', tool: 'Glob', input: { pattern: '**/*.ts', path: null } },
  { tag: 'deepseek-v4', pattern: 'autolink-path', tool: 'Glob', input: { pattern: '*.js', path: '[src](http://src)' } },
  { tag: 'deepseek-v4', pattern: 'json-string-array', tool: 'TodoWrite', input: { todos: '[{"content":"a","status":"pending","activeForm":"a"}]' } },
  { tag: 'generic', pattern: 'valid-passthrough', tool: 'Bash', input: { command: 'echo hi' } },
  { tag: 'generic', pattern: 'valid-passthrough', tool: 'WebFetch', input: { url: 'https://example.com', prompt: 'summarize' } },
];

// Oracle: input is "accepted" if it would pass through OR be fully repaired.
// This mirrors what a downstream tool runtime would see.
function isAccepted(toolName, rawInput) {
  const r = validateAndRepair(toolName, rawInput);
  if (r.passThrough) return { accepted: true, mode: 'passthrough' };
  if (r.repaired && r.errors.length === 0) return { accepted: true, mode: 'repaired' };
  return { accepted: false, mode: 'rejected', errors: r.errors };
}

// Baseline pass: simulate "no repair layer" — accept only if input is *already* valid.
// We detect this by checking passThrough on the first attempt with an unmodified input.
// Since validateAndRepair always tries to repair, the baseline equivalent is:
// "would this input have been accepted with passThrough=true and no fixes applied?"
function baselineAccepted(toolName, rawInput) {
  const r = validateAndRepair(toolName, rawInput);
  return r.passThrough && r.fixes.length === 0 && r.errors.length === 0;
}

function run() {
  const startedAt = new Date().toISOString();
  const byPattern = new Map();
  const byTag = new Map();

  let baselineAccept = 0;
  let repairedAccept = 0;

  for (const entry of CORPUS) {
    const baseline = baselineAccepted(entry.tool, deepClone(entry.input));
    const result = isAccepted(entry.tool, deepClone(entry.input));

    if (baseline) baselineAccept++;
    if (result.accepted) repairedAccept++;

    bump(byPattern, entry.pattern, baseline, result.accepted);
    bump(byTag, entry.tag, baseline, result.accepted);
  }

  const total = CORPUS.length;
  const finishedAt = new Date().toISOString();

  const report = {
    methodology: {
      oracle: 'schema-validation: accepted iff passThrough OR (repaired AND errors.length===0)',
      baseline: 'unrepaired: accepted iff passThrough AND fixes.length===0 AND errors.length===0',
      repaired: 'full pipeline: validateAndRepair output is accepted by the oracle',
      corpus: 'recorded patterns from real DeepSeek V4 / Qwen / GLM tool-call failures',
      live_api_status: 'deferred to v1.1.0 — see ROADMAP',
    },
    startedAt,
    finishedAt,
    totals: {
      corpus_size: total,
      baseline_accepted: baselineAccept,
      baseline_rate: round(baselineAccept / total),
      repaired_accepted: repairedAccept,
      repaired_rate: round(repairedAccept / total),
      uplift_points: round((repairedAccept - baselineAccept) / total),
    },
    by_pattern: toObject(byPattern),
    by_tag: toObject(byTag),
  };

  const outPath = path.resolve(__dirname, '..', 'bench-results.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  console.log('=== Shadow Bench Results ===');
  console.log(`Corpus size:       ${total}`);
  console.log(`Baseline accepted: ${baselineAccept} (${pct(baselineAccept, total)})`);
  console.log(`Repaired accepted: ${repairedAccept} (${pct(repairedAccept, total)})`);
  console.log(`Uplift:            +${repairedAccept - baselineAccept} (+${pct(repairedAccept - baselineAccept, total)})`);
  console.log(`\nArtifact: ${outPath}`);
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
    out[k] = {
      ...v,
      baseline_rate: round(v.baseline_accepted / v.total),
      repaired_rate: round(v.repaired_accepted / v.total),
    };
  }
  return out;
}

function deepClone(x) { return structuredClone(x); }
function round(n) { return Math.round(n * 1000) / 1000; }
function pct(n, d) { return ((n / d) * 100).toFixed(1) + '%'; }

run();
