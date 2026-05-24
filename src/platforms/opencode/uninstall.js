// OpenCode uninstaller
const path = require('path');
const os = require('os');
const fs = require('fs');
const { backupFile, atomicWrite } = require('../../utils/fs-utils');
const { RULES_MARKER_START, RULES_MARKER_END, PLUGIN_NAME } = require('../../constants');

function uninstallPlugin(opencodeConfigPath, projectDir, skipBackup) {
  if (!fs.existsSync(opencodeConfigPath)) {
    return { removed: false, reason: 'config-not-found' };
  }

  backupFile(opencodeConfigPath, skipBackup);
  const config = JSON.parse(fs.readFileSync(opencodeConfigPath, 'utf8'));

  if (!config.plugin || !config.plugin.includes(PLUGIN_NAME)) {
    return { removed: false, reason: 'plugin-not-found' };
  }

  config.plugin = config.plugin.filter(p => p !== PLUGIN_NAME);
  atomicWrite(opencodeConfigPath, JSON.stringify(config, null, 2));

  // Remove plugin file and its repair engine dependency
  const pluginPath = path.join(projectDir, '.opencode', 'plugin', 'tool-repair-plugin.js');
  const repairDir = path.join(projectDir, '.opencode', 'plugin', 'repair');
  if (fs.existsSync(pluginPath)) {
    fs.unlinkSync(pluginPath);
  }
  if (fs.existsSync(repairDir)) {
    fs.rmSync(repairDir, { recursive: true, force: true });
  }

  return { removed: true };
}

function uninstallRules(agentsMdPath, claudeMdPath, skipBackup) {
  const paths = [agentsMdPath, claudeMdPath].filter(p => fs.existsSync(p));

  for (const filePath of paths) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(RULES_MARKER_START)) continue;

    backupFile(filePath, skipBackup);

    const startIdx = content.indexOf(RULES_MARKER_START);
    const endIdx = content.indexOf(RULES_MARKER_END, startIdx);
    if (endIdx === -1) continue;

    let endPos = endIdx + RULES_MARKER_END.length;
    if (content[endPos] === '\n') endPos++;
    if (content[endPos] === '\n') endPos++;

    const before = content.substring(0, startIdx);
    const after = content.substring(endPos);
    const cleaned = (before + after).trimEnd() + '\n';

    atomicWrite(filePath, cleaned);
    return { removed: true };
  }

  return { removed: false, reason: 'rules-not-found' };
}

async function uninstall(options = {}) {
  const { projectDir, isGlobal, skipBackup } = options;

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

  const result = {};

  try {
    const pluginResult = uninstallPlugin(opencodeConfigPath, projectDir, skipBackup);
    result.pluginRemoved = pluginResult.removed;
    if (pluginResult.reason) result.pluginReason = pluginResult.reason;
  } catch (err) {
    result.pluginError = err.message;
  }

  try {
    const rulesResult = uninstallRules(agentsMdPath, claudeMdPath, skipBackup);
    result.rulesRemoved = rulesResult.removed;
    if (rulesResult.reason) result.rulesReason = rulesResult.reason;
  } catch (err) {
    result.rulesError = err.message;
  }

  return result;
}

module.exports = { uninstall };
