// Verify toolrepair installation integrity
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { RULES_MARKER_START, RULES_MARKER_END, PLUGIN_NAME } = require('./constants');

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

function verifyOpenCode(isGlobal, projectDir) {
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

  // Check plugin in opencode.json
  if (fs.existsSync(opencodeConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(opencodeConfigPath, 'utf8'));
      const hasPlugin = config.plugin?.includes(PLUGIN_NAME);
      checks.push({ item: 'plugin-registered', status: hasPlugin ? 'OK' : 'MISSING' });
    } catch (e) {
      checks.push({ item: 'opencode-json', status: 'INVALID' });
    }
  } else {
    checks.push({ item: 'opencode-json', status: 'NOT_FOUND' });
  }

  // Check plugin file
  const pluginPath = path.join(projectDir, '.opencode', 'plugin', 'tool-repair-plugin.js');
  checks.push({
    item: 'plugin-script',
    status: fs.existsSync(pluginPath) ? 'OK' : 'MISSING',
    sha256: sha256(pluginPath),
  });

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

async function verify(options = {}) {
  const cwd = process.cwd();
  const projectDir = options.project ? path.resolve(options.project) : cwd;
  const isGlobal = !options.project;

  let platforms;
  if (options.platform) {
    platforms = [options.platform];
  } else {
    platforms = ['claude-code', 'opencode'];
  }

  let allOk = true;
  for (const platform of platforms) {
    console.error(`\ntoolrepair: ${platform} verification`);
    const checks = platform === 'claude-code'
      ? verifyClaudeCode(isGlobal, projectDir)
      : verifyOpenCode(isGlobal, projectDir);

    for (const check of checks) {
      const icon = check.status === 'OK' ? '✓' : '✗';
      const sha = check.sha256 ? ` (sha256: ${check.sha256.substring(0, 16)}...)` : '';
      console.error(`  ${icon} ${check.item}: ${check.status}${sha}`);
      if (check.status !== 'OK' && check.status !== 'NOT_FOUND') {
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

module.exports = { verify };
