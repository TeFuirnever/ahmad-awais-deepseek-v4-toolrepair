// Verify toolrepair installation integrity
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { RULES_MARKER_START, RULES_MARKER_END, PLUGIN_NAME, ALLOWED_PLATFORMS } = require('./constants');

// End-to-end runtime check: load the installed .mjs plugin and confirm
// `tool.execute.before` actually mutates `output.args`. Catches the class
// of regression that silently broke v1.0.0/v1.0.1 (wrong hook signature,
// CJS-loaded-as-ESM, missing tool schemas) — all of which let unit tests
// pass while the plugin was dead code in production.
async function runPluginSmokeCheck(pluginPath) {
  try {
    const mod = await import(pathToFileURL(pluginPath).href);
    if (typeof mod.default !== 'function') {
      return { ok: false, reason: 'plugin default export is not a function' };
    }
    const hooks = await mod.default({ project: {}, client: {}, $: undefined, directory: os.tmpdir() });
    const before = hooks && hooks['tool.execute.before'];
    if (typeof before !== 'function') {
      return { ok: false, reason: 'tool.execute.before hook missing' };
    }
    const output = { args: { filePath: '/x', offset: null, limit: null } };
    await before({ tool: 'read', sessionID: 'verify', callID: 'verify' }, output);
    if (output.args.offset !== undefined || output.args.limit !== undefined) {
      return { ok: false, reason: 'hook did not strip null offset/limit on `read`' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function sha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function verifyClaudeCode(isGlobal, projectDir) {
  const home = os.homedir();
  const hooksDir = isGlobal
    ? path.join(home, '.claude', 'hooks')
    : path.join(projectDir, '.claude', 'hooks');
  const settingsPath = isGlobal
    ? path.join(home, '.claude', 'settings.json')
    : path.join(projectDir, '.claude', 'settings.local.json');
  const claudeMdPath = isGlobal
    ? path.join(home, '.claude', 'CLAUDE.md')
    : path.join(projectDir, '.claude', 'CLAUDE.md');

  const checks = [];

  // Check hook registration in settings
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const hasHook = settings.hooks?.PostToolUseFailure?.some(group =>
        group.hooks?.some(h => h.command?.includes('tool-repair-detector.js'))
      );
      checks.push({ item: 'hook-registered', status: hasHook ? 'OK' : 'MISSING' });
    } catch (e) {
      checks.push({ item: 'settings-json', status: 'INVALID' });
    }
  } else {
    checks.push({ item: 'settings-json', status: 'NOT_FOUND' });
  }

  // Check hook script
  const hookPath = path.join(hooksDir, 'tool-repair-detector.js');
  checks.push({
    item: 'hook-script',
    status: fs.existsSync(hookPath) ? 'OK' : 'MISSING',
    sha256: sha256(hookPath),
  });

  // Check CLAUDE.md rules
  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    const hasRules = content.includes(RULES_MARKER_START) && content.includes(RULES_MARKER_END);
    checks.push({ item: 'claude-md-rules', status: hasRules ? 'OK' : 'MISSING' });
  } else {
    checks.push({ item: 'claude-md', status: 'NOT_FOUND' });
  }

  return checks;
}

async function verifyOpenCode(isGlobal, projectDir) {
  const home = os.homedir();
  const opencodeConfigPath = isGlobal
    ? path.join(home, '.config', 'opencode', 'opencode.json')
    : path.join(projectDir, 'opencode.json');
  const agentsMdPath = isGlobal
    ? path.join(home, '.config', 'opencode', 'AGENTS.md')
    : path.join(projectDir, 'AGENTS.md');
  const claudeMdPath = isGlobal
    ? path.join(home, '.claude', 'CLAUDE.md')
    : path.join(projectDir, 'CLAUDE.md');

  const checks = [];

  // Resolve where the plugin file should live.
  const pluginDir = isGlobal
    ? path.join(home, '.config', 'opencode', 'plugin')
    : path.join(projectDir, '.opencode', 'plugin');
  const pluginPath = path.join(pluginDir, 'tool-repair-plugin.mjs');

  // For global installs the config must explicitly register the plugin;
  // for project-local installs OpenCode auto-discovers .opencode/plugin/*,
  // so a registry entry is optional. Accept both PLUGIN_NAME (legacy) and
  // the file:// absolute path (current installer output).
  if (isGlobal) {
    if (fs.existsSync(opencodeConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(opencodeConfigPath, 'utf8'));
        const registered = Array.isArray(config.plugin) && config.plugin.some(spec =>
          spec === PLUGIN_NAME || spec === 'file://' + pluginPath
        );
        checks.push({ item: 'plugin-registered', status: registered ? 'OK' : 'MISSING' });
      } catch (e) {
        checks.push({ item: 'opencode-json', status: 'INVALID' });
      }
    } else {
      checks.push({ item: 'opencode-json', status: 'NOT_FOUND' });
    }
  } else {
    checks.push({ item: 'plugin-registered', status: 'AUTO_DISCOVERY' });
  }

  // Check plugin file
  checks.push({
    item: 'plugin-script',
    status: fs.existsSync(pluginPath) ? 'OK' : 'MISSING',
    sha256: sha256(pluginPath),
  });

  // Runtime smoke check — only when the plugin file exists
  if (fs.existsSync(pluginPath)) {
    const smoke = await runPluginSmokeCheck(pluginPath);
    checks.push({
      item: 'plugin-runtime',
      status: smoke.ok ? 'OK' : 'FAILED',
      ...(smoke.reason ? { reason: smoke.reason } : {}),
    });
  }

  // Check rules (AGENTS.md or CLAUDE.md fallback)
  const rulesPaths = [agentsMdPath, claudeMdPath].filter(p => fs.existsSync(p));
  let rulesFound = false;
  for (const p of rulesPaths) {
    const content = fs.readFileSync(p, 'utf8');
    if (content.includes(RULES_MARKER_START) && content.includes(RULES_MARKER_END)) {
      rulesFound = true;
      checks.push({ item: 'rules', status: 'OK', path: p });
      break;
    }
  }
  if (!rulesFound) {
    checks.push({ item: 'rules', status: 'MISSING' });
  }

  return checks;
}

function verifyCursor(isGlobal, projectDir) {
  const home = os.homedir();
  const cursorRulesPath = isGlobal
    ? path.join(home, '.cursorrules')
    : path.join(projectDir, '.cursorrules');

  const checks = [];

  if (fs.existsSync(cursorRulesPath)) {
    const content = fs.readFileSync(cursorRulesPath, 'utf8');
    const hasRules = content.includes(RULES_MARKER_START) && content.includes(RULES_MARKER_END);
    checks.push({ item: 'cursorrules', status: hasRules ? 'OK' : 'MISSING' });
  } else {
    checks.push({ item: 'cursorrules', status: 'NOT_FOUND' });
  }

  return checks;
}

function verifyGemini(isGlobal, projectDir) {
  const home = os.homedir();
  const geminiMdPath = isGlobal
    ? path.join(home, '.gemini', 'GEMINI.md')
    : path.join(projectDir, 'GEMINI.md');

  const checks = [];

  if (fs.existsSync(geminiMdPath)) {
    const content = fs.readFileSync(geminiMdPath, 'utf8');
    const hasRules = content.includes(RULES_MARKER_START) && content.includes(RULES_MARKER_END);
    checks.push({ item: 'gemini-md', status: hasRules ? 'OK' : 'MISSING' });
  } else {
    checks.push({ item: 'gemini-md', status: 'NOT_FOUND' });
  }

  return checks;
}

async function verify(options = {}) {
  const cwd = process.cwd();
  const projectDir = options.project ? path.resolve(options.project) : cwd;
  const isGlobal = !options.project;

  let platforms;
  if (options.platform) {
    if (!ALLOWED_PLATFORMS.includes(options.platform)) {
      console.error(`toolrepair: invalid platform "${options.platform}"`);
      process.exitCode = 1;
      return;
    }
    platforms = [options.platform];
  } else {
    platforms = ['claude-code', 'opencode', 'cursor', 'gemini'];
  }

  let allOk = true;
  for (const platform of platforms) {
    console.error(`\ntoolrepair: ${platform} verification`);
    const checks = platform === 'claude-code'
      ? verifyClaudeCode(isGlobal, projectDir)
      : platform === 'cursor'
        ? verifyCursor(isGlobal, projectDir)
        : platform === 'gemini'
          ? verifyGemini(isGlobal, projectDir)
          : await verifyOpenCode(isGlobal, projectDir);

    for (const check of checks) {
      const icon = check.status === 'OK' ? '✓' : '✗';
      const sha = check.sha256 ? ` (sha256: ${check.sha256.substring(0, 16)}...)` : '';
      const reason = check.reason ? ` — ${check.reason}` : '';
      console.error(`  ${icon} ${check.item}: ${check.status}${sha}${reason}`);
      if (check.status !== 'OK' && check.status !== 'NOT_FOUND' && check.status !== 'AUTO_DISCOVERY') {
        allOk = false;
      }
    }
  }

  if (!allOk) {
    console.error('\ntoolrepair: some checks failed. Reinstall with: npx ahmad-awais-deepseek-v4-toolrepair install');
    process.exitCode = 1;
  } else {
    console.error('\ntoolrepair: all checks passed.');
  }
}

module.exports = { verify, runPluginSmokeCheck };
