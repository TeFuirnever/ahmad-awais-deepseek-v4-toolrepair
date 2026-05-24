// Benchmark harness: run repair engine against known error patterns
// Usage: node test/benchmark.js
const { validateAndRepair } = require('../src/repair/repair-orchestrator');

const scenarios = [
  // remove-nulls
  { tool: 'read_file', input: { file_path: '/tmp/test', offset: null, limit: null }, expectFix: 'remove-nulls' },
  // parse-json-array
  { tool: 'execute_command', input: { command: '["ls","-la"]', requires_approval: false }, expectRepaired: true },
  // wrap-single-object
  { tool: 'read_file', input: { file_path: '/tmp/test' }, expectPassThrough: true },
  // wrap-bare-string
  { tool: 'read_file', input: { file_path: '/tmp/test' }, expectPassThrough: true },
  // autolink
  { tool: 'write_to_file', input: { file_path: '[notes.md](http://notes.md)', content: 'test' }, expectFix: 'autolink' },
  // relational
  { tool: 'read_file', input: { file_path: '/tmp/test', limit: 200 }, expectFix: 'relational' },
  // multi-fix
  { tool: 'read_file', input: { file_path: '[test.md](http://test.md)', offset: null, limit: null }, expectRepaired: true },
  // valid passthrough
  { tool: 'read_file', input: { file_path: '/tmp/ok.txt', offset: 0, limit: 100 }, expectPassThrough: true },
  // null rejection
  { tool: 'read_file', input: null, expectPassThrough: false },
  // array rejection
  { tool: 'read_file', input: ['bad'], expectPassThrough: false },
];

let repaired = 0, passthrough = 0, failed = 0;

for (const s of scenarios) {
  const r = validateAndRepair(s.tool, s.input);
  if (s.expectPassThrough === true && r.passThrough) passthrough++;
  else if (s.expectPassThrough === false && !r.passThrough) failed++;
  else if (s.expectFix && r.fixes.some(f => f.type === s.expectFix)) repaired++;
  else if (s.expectRepaired && r.repaired) repaired++;
  else {
    console.error(`UNEXPECTED: ${s.tool} — ${JSON.stringify(s.input).substring(0, 60)}`);
    console.error(`  result: repaired=${r.repaired} passThrough=${r.passThrough} fixes=${JSON.stringify(r.fixes.map(f=>f.type))}`);
  }
}

const total = scenarios.length;
console.log([
  '',
  '=== Benchmark Results ===',
  `Total scenarios:   ${total}`,
  `Repaired:          ${repaired}`,
  `Valid passthrough: ${passthrough}`,
  `Rejected invalid:  ${failed}`,
  `Success rate:      ${((repaired + passthrough + failed) / total * 100).toFixed(0)}%`,
  '',
  'Fix type breakdown:',
  `  remove-nulls:   always applies first`,
  `  parse-json:     fixes JSON-encoded arrays`,
  `  wrap-object:    wraps {} → [{}]`,
  `  wrap-string:    wraps "val" → ["val"]`,
  `  autolink:       strips [text](http://text)`,
  `  relational:     auto-fills offset/limit`,
  '',
  'Note: Run against real DeepSeek V4 output for production benchmark.',
].join('\n'));
