// OpenCode uninstaller
const path = require('path');
const os = require('os');
const fs = require('fs');

const RULES_MARKER_START = '<!-- TOOLREPAIR-START -->';
const RULES_MARKER_END = '<!-- TOOLREPAIR-END -->';
const PLUGIN_NAME = 'ahmad-awais-deepseek-v4-toolrepair/opencode';

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

  // Remove plugin file
  const pluginPath = path.join(projectDir, '.opencode', 'plugin', 'tool-repair-plugin.js');
  if (fs.existsSync(pluginPath)) {
    fs.unlinkSync(pluginPath);
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
