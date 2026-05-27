// Cursor uninstaller
const path = require('path');
const os = require('os');
const fs = require('fs');
const { backupFile, atomicWrite } = require('../../utils/fs-utils');
const { RULES_MARKER_START, RULES_MARKER_END } = require('../../constants');

function uninstallRules(cursorRulesPath, skipBackup) {
  if (!fs.existsSync(cursorRulesPath)) {
    return { removed: false, reason: 'cursorrules-not-found' };
  }

  const content = fs.readFileSync(cursorRulesPath, 'utf8');
  if (!content.includes(RULES_MARKER_START)) {
    return { removed: false, reason: 'rules-not-found' };
  }

  backupFile(cursorRulesPath, skipBackup);

  const startIdx = content.indexOf(RULES_MARKER_START);
  const endIdx = content.indexOf(RULES_MARKER_END, startIdx);

  if (endIdx === -1) {
    return { removed: false, reason: 'marker-mismatch' };
  }

  let endPos = endIdx + RULES_MARKER_END.length;
  if (content[endPos] === '\n') endPos++;
  if (content[endPos] === '\n') endPos++;

  const before = content.substring(0, startIdx);
  const after = content.substring(endPos);
  const cleaned = (before + after).trimEnd() + '\n';

  atomicWrite(cursorRulesPath, cleaned);
  return { removed: true };
}

async function uninstall(options = {}) {
  const { projectDir, isGlobal, skipBackup } = options;

  const cursorRulesPath = isGlobal
    ? path.join(os.homedir(), '.cursorrules')
    : path.join(projectDir, '.cursorrules');

  const result = {};

  try {
    const rulesResult = uninstallRules(cursorRulesPath, skipBackup);
    result.rulesRemoved = rulesResult.removed;
    if (rulesResult.reason) result.rulesReason = rulesResult.reason;
  } catch (err) {
    result.rulesError = err.message;
  }

  return result;
}

module.exports = { uninstall };
