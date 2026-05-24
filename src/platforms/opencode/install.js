// OpenCode installer — AGENTS.md rules + tool.execute.before plugin
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

function installPlugin(opencodeConfigPath, projectDir, sourceDir, skipBackup) {
  const pluginName = 'ahmad-awais-deepseek-v4-toolrepair/opencode';

  // Ensure .opencode directory exists in project
  const opencodeDir = path.join(projectDir, '.opencode');
  const pluginDir = path.join(opencodeDir, 'plugin');
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  // Copy plugin
  const pluginSrc = path.join(sourceDir, 'src', 'platforms', 'opencode', 'plugin', 'tool-repair-plugin.js');
  const pluginDest = path.join(pluginDir, 'tool-repair-plugin.js');
  fs.copyFileSync(pluginSrc, pluginDest);
  fs.chmodSync(pluginDest, 0o444);

  // Update opencode.json
  backupFile(opencodeConfigPath, skipBackup);

  let config;
  if (fs.existsSync(opencodeConfigPath)) {
    config = JSON.parse(fs.readFileSync(opencodeConfigPath, 'utf8'));
  } else {
    config = {};
  }

  if (!config.plugin) config.plugin = [];
  if (!config.plugin.includes(pluginName)) {
    config.plugin.push(pluginName);
    atomicWrite(opencodeConfigPath, JSON.stringify(config, null, 2));
    return { installed: true, path: pluginDest };
  }

  return { installed: false, reason: 'already-present' };
}

function installRules(agentsMdPath, claudeMdPath, sourceDir, skipBackup) {
  // OpenCode reads AGENTS.md first, falls back to CLAUDE.md
  const rulesSrc = path.join(sourceDir, 'src', 'rules', 'deepseek-rules.md');
  let rulesContent = fs.readFileSync(rulesSrc, 'utf8');
  rulesContent = rulesContent.replace('TIMESTAMP', new Date().toISOString().split('T')[0]);

  // Try AGENTS.md first (OpenCode's primary rules file)
  let targetPath = agentsMdPath;
  if (!fs.existsSync(targetPath)) {
    // Fall back to CLAUDE.md
    targetPath = claudeMdPath;
  }

  backupFile(targetPath, skipBackup);

  let existing = '';
  if (fs.existsSync(targetPath)) {
    existing = fs.readFileSync(targetPath, 'utf8');
  }

  if (existing.includes(RULES_MARKER_START)) {
    const startIdx = existing.indexOf(RULES_MARKER_START);
    const endIdx = existing.indexOf(RULES_MARKER_END, startIdx);
    if (endIdx !== -1) {
      const before = existing.substring(0, startIdx);
      const after = existing.substring(endIdx + RULES_MARKER_END.length);
      const updated = before + rulesContent.trim() + after;
      atomicWrite(targetPath, updated);
      return { installed: true, updated: true, path: targetPath };
    }
  }

  const separator = existing && !existing.endsWith('\n') ? '\n\n' : '\n';
  const updated = existing + separator + rulesContent.trim() + '\n';
  atomicWrite(targetPath, updated);
  return { installed: true, updated: false, path: targetPath };
}

async function install(options = {}) {
  const { projectDir, isGlobal, rulesOnly, pluginOnly, skipBackup, sourceDir } = options;

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

  // Install plugin (unless rules-only)
  if (!rulesOnly) {
    try {
      // Ensure opencode config directory exists
      const configDir = path.dirname(opencodeConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const pluginResult = installPlugin(opencodeConfigPath, projectDir, sourceDir, skipBackup);
      result.pluginInstalled = pluginResult.installed;
      if (pluginResult.reason) result.pluginReason = pluginResult.reason;
      result.pluginPath = pluginResult.path;
    } catch (err) {
      result.pluginError = err.message;
      console.error(`toolrepair: opencode plugin install error: ${err.message}`);
    }
  }

  // Install rules (unless plugin-only)
  if (!pluginOnly) {
    try {
      const rulesResult = installRules(agentsMdPath, claudeMdPath, sourceDir, skipBackup);
      result.rulesInstalled = rulesResult.installed;
      if (rulesResult.updated) result.rulesUpdated = true;
      result.rulesPath = rulesResult.path;
    } catch (err) {
      result.rulesError = err.message;
      console.error(`toolrepair: opencode rules install error: ${err.message}`);
    }
  }

  return result;
}

module.exports = { install };
