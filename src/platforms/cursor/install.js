// Cursor installer — .cursorrules passive prevention layer
const path = require('path');
const os = require('os');
const fs = require('fs');
const { backupFile, atomicWrite } = require('../../utils/fs-utils');
const { RULES_MARKER_START, RULES_MARKER_END } = require('../../constants');

function installRules(cursorRulesPath, sourceDir, skipBackup) {
  backupFile(cursorRulesPath, skipBackup);

  const rulesSrc = path.join(sourceDir, 'src', 'rules', 'deepseek-rules.md');
  let rulesContent = fs.readFileSync(rulesSrc, 'utf8');
  rulesContent = rulesContent.replace('TIMESTAMP', new Date().toISOString().split('T')[0]);

  let existing = '';
  if (fs.existsSync(cursorRulesPath)) {
    existing = fs.readFileSync(cursorRulesPath, 'utf8');
  }

  if (existing.includes(RULES_MARKER_START)) {
    const startIdx = existing.indexOf(RULES_MARKER_START);
    const endIdx = existing.indexOf(RULES_MARKER_END, startIdx);
    if (endIdx !== -1) {
      const before = existing.substring(0, startIdx);
      const after = existing.substring(endIdx + RULES_MARKER_END.length);
      const updated = before + rulesContent.trim() + after;
      atomicWrite(cursorRulesPath, updated);
      return { installed: true, updated: true };
    }
  }

  const separator = existing && !existing.endsWith('\n') ? '\n\n' : '\n';
  const updated = existing + separator + rulesContent.trim() + '\n';
  atomicWrite(cursorRulesPath, updated);
  return { installed: true, updated: false };
}

async function install(options = {}) {
  const { projectDir, isGlobal, rulesOnly, skipBackup, sourceDir } = options;

  const cursorRulesPath = isGlobal
    ? path.join(os.homedir(), '.cursorrules')
    : path.join(projectDir, '.cursorrules');

  const result = {};

  try {
    const rulesResult = installRules(cursorRulesPath, sourceDir, skipBackup);
    result.rulesInstalled = rulesResult.installed;
    if (rulesResult.updated) result.rulesUpdated = true;
    result.rulesPath = cursorRulesPath;
  } catch (err) {
    result.rulesError = err.message;
    console.error(`toolrepair: cursor rules install error: ${err.message}`);
  }

  return result;
}

module.exports = { install };
