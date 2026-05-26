// Shadow benchmark harness — external corpus replay.
// Methodology (falsifiable, no self-authored fixtures):
//   1. Reads a user-supplied JSONL file (ToolBench or BFCL format).
//   2. Normalises each line to { tool, input } — mapper documented below.
//   3. Runs each entry through validateAndRepair (baseline + repaired pass).
//   4. Writes bench-results-live.json with the same oracle methodology as
//      scripts/shadow-bench.js, plus source provenance fields.
//
// We do NOT bundle any external dataset (license + size concerns).
// We do NOT make any live LLM API calls.
//
// Usage:
//   node scripts/shadow-bench-live.js --source path/to/file.jsonl
//   node scripts/shadow-bench-live.js           # prints help + exits 0
//
// Obtaining a source file:
//   BFCL (Berkeley Function Calling Leaderboard):
//     https://gorilla.cs.berkeley.edu/blogs/8_berkeley_function_calling_leaderboard.html
//   ToolBench:
//     https://github.com/OpenBMB/ToolBench
//
// Normalised shape (what this script expects after mapping):
//   { tool: string, input: object }
//
// Supported input shapes (auto-detected, see normalise() below):
//
//   BFCL:
//     { "function": "<name>", "parameters": { ... } }
//     — "function" key → tool, "parameters" key → input
//
//   ToolBench (Anthropic-style):
//     { "tool_name": "<name>", "tool_input": { ... } }
//     — "tool_name" key → tool, "tool_input" key → input
//
//   ToolBench / OpenAI-compat:
//     { "name": "<name>", "arguments": { ... } }
//     — "name" key → tool, "arguments" key → input
//
//   Pre-normalised (pass-through):
//     { "tool": "<name>", "input": { ... } }
//     — used when caller already normalised entries externally

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateAndRepair } = require('../src/repair/repair-orchestrator');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { source: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      result.source = args[i + 1];
      i++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Normalization mapper
//
// Accepts a parsed JSON object from a JSONL line.
// Returns { tool: string, input: object, sourceTag: string }
// or null if the shape is unrecognised.
//
// sourceTag values: 'bfcl' | 'toolbench' | 'normalized' | 'unknown'
// ---------------------------------------------------------------------------

function normalise(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  // BFCL: { "function": "<name>", "parameters": { ... } }
  if (typeof raw['function'] === 'string' && raw['parameters'] !== undefined) {
    const input = raw['parameters'];
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
    return { tool: raw['function'], input, sourceTag: 'bfcl' };
  }

  // ToolBench Anthropic-style: { "tool_name": "<name>", "tool_input": { ... } }
  if (typeof raw['tool_name'] === 'string' && raw['tool_input'] !== undefined) {
    const input = raw['tool_input'];
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
    return { tool: raw['tool_name'], input, sourceTag: 'toolbench' };
  }

  // ToolBench / OpenAI-compat: { "name": "<name>", "arguments": { ... } }
  if (typeof raw['name'] === 'string' && raw['arguments'] !== undefined) {
    let input = raw['arguments'];
    // arguments may itself be a JSON string (some ToolBench variants)
    if (typeof input === 'string') {
      try { input = JSON.parse(input); } catch (_) { return null; }
    }
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
    return { tool: raw['name'], input, sourceTag: 'toolbench' };
  }

  // Pre-normalised: { "tool": "<name>", "input": { ... } }
  if (typeof raw['tool'] === 'string' && raw['input'] !== undefined) {
    const input = raw['input'];
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
    return { tool: raw['tool'], input, sourceTag: 'normalized' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Oracle (same as shadow-bench.js)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SHA-256 of a file (for provenance, no external deps)
// ---------------------------------------------------------------------------

function fileSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
shadow-bench-live: replay external tool-call corpora through validateAndRepair.

Usage:
  node scripts/shadow-bench-live.js --source <path>

  <path>  Path to a JSONL file (one JSON object per line).

Supported input shapes per line (auto-detected):
  BFCL:        { "function": "<tool>",    "parameters": { ... } }
  ToolBench:   { "tool_name": "<tool>",   "tool_input": { ... } }
               { "name": "<tool>",        "arguments":  { ... } }
  Normalised:  { "tool": "<tool>",        "input":      { ... } }

How to obtain a source file:
  BFCL (Berkeley Function Calling Leaderboard):
    https://gorilla.cs.berkeley.edu/blogs/8_berkeley_function_calling_leaderboard.html

  ToolBench:
    https://github.com/OpenBMB/ToolBench

NOTE: External datasets are NOT bundled in this repository (license + size).
      Do not commit downloaded corpora.

Output: bench-results-live.json (write to repo root)
`);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function deepClone(x) { return structuredClone(x); }
function round(n) { return Math.round(n * 1000) / 1000; }
function pct(n, d) { return ((n / d) * 100).toFixed(1) + '%'; }

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run() {
  const { source } = parseArgs(process.argv);

  if (!source) {
    printHelp();
    process.exit(0);
  }

  const sourcePath = path.resolve(source);
  if (!fs.existsSync(sourcePath)) {
    console.error(`shadow-bench-live: file not found: ${sourcePath}`);
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const sha256 = fileSha256(sourcePath);

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);

  let entryCount = 0;
  let skipped = 0;
  let baselineAccept = 0;
  let repairedAccept = 0;

  const bySource = new Map();
  const byTool = new Map();

  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (_) {
      skipped++;
      continue;
    }

    const entry = normalise(parsed);
    if (!entry) {
      skipped++;
      continue;
    }

    const { tool, input, sourceTag } = entry;
    entryCount++;

    const baseline = baselineAccepted(tool, deepClone(input));
    const result = isAccepted(tool, deepClone(input));

    if (baseline) baselineAccept++;
    if (result.accepted) repairedAccept++;

    bump(bySource, sourceTag, baseline, result.accepted);
    bump(byTool, tool, baseline, result.accepted);
  }

  const finishedAt = new Date().toISOString();

  if (entryCount === 0) {
    console.warn('shadow-bench-live: no recognisable entries found in source file.');
    console.warn('Check that each line matches one of the supported shapes (see --help or run without --source).');
    process.exit(0);
  }

  const report = {
    methodology: {
      oracle: 'schema-validation: accepted iff passThrough OR (repaired AND errors.length===0)',
      baseline: 'unrepaired: accepted iff passThrough AND fixes.length===0 AND errors.length===0',
      repaired: 'full pipeline: validateAndRepair output is accepted by the oracle',
      corpus: 'external JSONL corpus provided by contributor — NOT authored by this repository',
      live_api_status: 'n/a — replaying recorded external corpus',
    },
    source_file: path.basename(sourcePath),
    source_sha256: sha256,
    entry_count: entryCount,
    skipped_lines: skipped,
    startedAt,
    finishedAt,
    totals: {
      corpus_size: entryCount,
      baseline_accepted: baselineAccept,
      baseline_rate: round(baselineAccept / entryCount),
      repaired_accepted: repairedAccept,
      repaired_rate: round(repairedAccept / entryCount),
      uplift_points: round((repairedAccept - baselineAccept) / entryCount),
    },
    by_source_tag: toObject(bySource),
    by_tool: toObject(byTool),
  };

  const outPath = path.resolve(__dirname, '..', 'bench-results-live.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  console.log('=== Shadow Bench Live Results ===');
  console.log(`Source:            ${path.basename(sourcePath)}`);
  console.log(`SHA-256:           ${sha256}`);
  console.log(`Entries:           ${entryCount} (${skipped} lines skipped)`);
  console.log(`Baseline accepted: ${baselineAccept} (${pct(baselineAccept, entryCount)})`);
  console.log(`Repaired accepted: ${repairedAccept} (${pct(repairedAccept, entryCount)})`);
  console.log(`Uplift:            +${repairedAccept - baselineAccept} (+${pct(repairedAccept - baselineAccept, entryCount)})`);
  console.log(`\nArtifact: ${outPath}`);
}

// Export normalise for unit testing without running the harness.
module.exports = { normalise };

// Only run when invoked directly.
if (require.main === module) {
  run();
}
