// Shared filesystem utilities for ahmad-awais-deepseek-v4-toolrepair
const fs = require('fs');
const path = require('path');

function backupFile(filePath, skipBackup) {
  if (skipBackup || !fs.existsSync(filePath)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  if (filePath.endsWith('.json')) {
    JSON.parse(content);
  }
  fs.renameSync(tmpPath, filePath);
}

module.exports = { backupFile, atomicWrite };
