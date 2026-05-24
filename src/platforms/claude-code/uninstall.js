// Claude Code uninstaller
const path = require('path');
const os = require('os');
const fs = require('fs');

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
  if (filePath.endsWith('.json')) {
    JSON.parse(content);
  }
  fs.renameSync(tmpPath, filePath);
}

function uninstallHook(settingsPath, hooksDir, skipBackup) {
  if (!fs.existsSync(settingsPath)) {
    return { removed: false, reason: 'settings-not-found' };
  }

  backupFile(settingsPath, skipBackup);
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

  if (!settings.hooks?.PostToolUseFailure) {
    return { removed: false, reason: 'no-hooks' };
  }

  const originalLength = settings.hooks.PostToolUseFailure.length;
  settings.hooks.PostToolUseFailure = settings.hooks.PostToolUseFailure.filter(group =>
    !group.hooks?.some(h => h.command?.includes('tool-repair-detector.js'))
  );

  if (settings.hooks.PostToolUseFailure.length === originalLength) {
    return { removed: false, reason: 'hook-not-found' };
  }

  atomicWrite(settingsPath, JSON.stringify(settings, null, 2));

  // Remove hook script
  const hookPath = path.join(hooksDir, 'tool-repair-detector.js');
  if (fs.existsSync(hookPath)) {
    fs.unlinkSync(hookPath);
  }

  return { removed: true };
}

function uninstallRules(claudeMdPath, skipBackup) {
  if (!fs.existsSync(claudeMdPath)) {
    return { removed: false, reason: 'claude-md-not-found' };
  }

  const content = fs.readFileSync(claudeMdPath, 'utf8');
  if (!content.includes(RULES_MARKER_START)) {
    return { removed: false, reason: 'rules-not-found' };
  }

  backupFile(claudeMdPath, skipBackup);

  // Remove the marked block
  const startIdx = content.indexOf(RULES_MARKER_START);
  const endIdx = content.indexOf(RULES_MARKER_END, startIdx);

  if (endIdx === -1) {
    return { removed: false, reason: 'marker-mismatch' };
  }

  // Include the newline after END marker if present
  let endPos = endIdx + RULES_MARKER_END.length;
  if (content[endPos] === '\n') endPos++;
  if (content[endPos] === '\n') endPos++;

  const before = content.substring(0, startIdx);
  const after = content.substring(endPos);
  const cleaned = (before + after).trimEnd() + '\n';

  atomicWrite(claudeMdPath, cleaned);
  return { removed: true };
}

async function uninstall(options = {}) {
  const { projectDir, isGlobal, skipBackup } = options;

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

  try {
    const hookResult = uninstallHook(settingsPath, hooksDir, skipBackup);
    result.hookRemoved = hookResult.removed;
    if (hookResult.reason) result.hookReason = hookResult.reason;
  } catch (err) {
    result.hookError = err.message;
  }

  try {
    const rulesResult = uninstallRules(claudeMdPath, skipBackup);
    result.rulesRemoved = rulesResult.removed;
    if (rulesResult.reason) result.rulesReason = rulesResult.reason;
  } catch (err) {
    result.rulesError = err.message;
  }

  return result;
}

module.exports = { uninstall };
