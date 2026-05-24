// Claude Code installer — CLAUDE.md rules + PostToolUseFailure hook
const path = require('path');
const os = require('os');
const fs = require('fs');

const HOOK_NAME = 'ahmad-awais-deepseek-v4-toolrepair';
const RULES_MARKER_START = '<!-- TOOLREPAIR-START -->';
const RULES_MARKER_END = '<!-- TOOLREPAIR-END -->';

function backupFile(filePath, skipBackup) {
  if (skipBackup || !fs.existsSync(filePath)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function atomicWrite(filePath, content) {
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  // Validate if JSON
  if (filePath.endsWith('.json')) {
    JSON.parse(content);
  }
  fs.renameSync(tmpPath, filePath);
}

function installHook(settingsPath, hooksDir, sourceDir, skipBackup) {
  backupFile(settingsPath, skipBackup);

  // Read settings
  let settings;
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } else {
    settings = {};
  }

  // Ensure hooks dir exists
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // Copy hook script
  const hookSrc = path.join(sourceDir, 'src', 'platforms', 'claude-code', 'hooks', 'tool-repair-detector.js');
  const hookDest = path.join(hooksDir, 'tool-repair-detector.js');
  fs.copyFileSync(hookSrc, hookDest);
  fs.chmodSync(hookDest, 0o444); // Read-only

  // Ensure hooks object exists
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PostToolUseFailure) settings.hooks.PostToolUseFailure = [];

  // Check if already installed (by command path)
  const existingGroup = settings.hooks.PostToolUseFailure.find(group =>
    group.hooks?.some(h => h.command?.includes('tool-repair-detector.js'))
  );

  if (existingGroup) {
    return { installed: false, reason: 'already-present' };
  }

  // Add hook entry in nested format matching existing style
  settings.hooks.PostToolUseFailure.push({
    matcher: '',
    hooks: [{
      type: 'command',
      command: `node ${hookDest}`,
    }],
  });

  // Atomic write
  atomicWrite(settingsPath, JSON.stringify(settings, null, 2));
  return { installed: true, path: hookDest };
}

function installRules(claudeMdPath, sourceDir, skipBackup) {
  backupFile(claudeMdPath, skipBackup);

  const rulesSrc = path.join(sourceDir, 'src', 'rules', 'deepseek-rules.md');
  let rulesContent = fs.readFileSync(rulesSrc, 'utf8');
  rulesContent = rulesContent.replace('TIMESTAMP', new Date().toISOString().split('T')[0]);

  let existing = '';
  if (fs.existsSync(claudeMdPath)) {
    existing = fs.readFileSync(claudeMdPath, 'utf8');
  }

  // Check if already present
  if (existing.includes(RULES_MARKER_START)) {
    // Replace existing block
    const startIdx = existing.indexOf(RULES_MARKER_START);
    const endIdx = existing.indexOf(RULES_MARKER_END, startIdx);
    if (endIdx !== -1) {
      const before = existing.substring(0, startIdx);
      const after = existing.substring(endIdx + RULES_MARKER_END.length);
      const updated = before + rulesContent.trim() + after;
      atomicWrite(claudeMdPath, updated);
      return { installed: true, updated: true };
    }
  }

  // Append to end
  const separator = existing && !existing.endsWith('\n') ? '\n\n' : '\n';
  const updated = existing + separator + rulesContent.trim() + '\n';
  atomicWrite(claudeMdPath, updated);
  return { installed: true, updated: false };
}

async function install(options = {}) {
  const { projectDir, isGlobal, rulesOnly, pluginOnly, skipBackup, sourceDir } = options;

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

  const result = {};

  // Install hook (unless rules-only)
  if (!rulesOnly) {
    try {
      const hookResult = installHook(settingsPath, hooksDir, sourceDir, skipBackup);
      result.hookInstalled = hookResult.installed;
      if (hookResult.reason) result.hookReason = hookResult.reason;
    } catch (err) {
      result.hookError = err.message;
      console.error(`toolrepair: claude-code hook install error: ${err.message}`);
    }
    result.hookPath = path.join(hooksDir, 'tool-repair-detector.js');
  }

  // Install rules (unless plugin-only)
  if (!pluginOnly) {
    try {
      const rulesResult = installRules(claudeMdPath, sourceDir, skipBackup);
      result.rulesInstalled = rulesResult.installed;
      if (rulesResult.updated) result.rulesUpdated = true;
    } catch (err) {
      result.rulesError = err.message;
      console.error(`toolrepair: claude-code rules install error: ${err.message}`);
    }
    result.rulesPath = claudeMdPath;
  }

  return result;
}

module.exports = { install };
