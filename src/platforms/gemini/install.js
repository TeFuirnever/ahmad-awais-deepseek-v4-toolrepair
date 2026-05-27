// Gemini CLI installer — GEMINI.md passive prevention layer
const path = require('path');
const os = require('os');
const fs = require('fs');
const { backupFile, atomicWrite } = require('../../utils/fs-utils');
const { RULES_MARKER_START, RULES_MARKER_END } = require('../../constants');

function installRules(geminiMdPath, sourceDir, skipBackup) {
  backupFile(geminiMdPath, skipBackup);

  const rulesSrc = path.join(sourceDir, 'src', 'rules', 'deepseek-rules.md');
  let rulesContent = fs.readFileSync(rulesSrc, 'utf8');
  rulesContent = rulesContent.replace('TIMESTAMP', new Date().toISOString().split('T')[0]);

  let existing = '';
  if (fs.existsSync(geminiMdPath)) {
    existing = fs.readFileSync(geminiMdPath, 'utf8');
  }

  if (existing.includes(RULES_MARKER_START)) {
    const startIdx = existing.indexOf(RULES_MARKER_START);
    const endIdx = existing.indexOf(RULES_MARKER_END, startIdx);
    if (endIdx !== -1) {
      const before = existing.substring(0, startIdx);
      const after = existing.substring(endIdx + RULES_MARKER_END.length);
      const updated = before + rulesContent.trim() + after;
      atomicWrite(geminiMdPath, updated);
      return { installed: true, updated: true };
    }
  }

  const separator = existing && !existing.endsWith('\n') ? '\n\n' : '\n';
  const updated = existing + separator + rulesContent.trim() + '\n';
  atomicWrite(geminiMdPath, updated);
  return { installed: true, updated: false };
}

async function install(options = {}) {
  const { projectDir, isGlobal, rulesOnly, skipBackup, sourceDir } = options;

  const geminiMdPath = isGlobal
    ? path.join(os.homedir(), '.gemini', 'GEMINI.md')
    : path.join(projectDir, 'GEMINI.md');

  const result = {};

  try {
    const rulesResult = installRules(geminiMdPath, sourceDir, skipBackup);
    result.rulesInstalled = rulesResult.installed;
    if (rulesResult.updated) result.rulesUpdated = true;
    result.rulesPath = geminiMdPath;
  } catch (err) {
    result.rulesError = err.message;
    console.error(`toolrepair: gemini rules install error: ${err.message}`);
  }

  return result;
}

module.exports = { install };
