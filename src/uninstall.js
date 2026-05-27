const path = require('path');
const { ALLOWED_PLATFORMS } = require('./constants');

async function uninstall(options = {}) {
  const cwd = process.cwd();
  const projectDir = options.project ? path.resolve(options.project) : cwd;
  const isGlobal = !options.project;

  // Determine target platforms
  let platforms;
  if (options.platform) {
    platforms = [options.platform];
  } else {
    platforms = ['claude-code', 'opencode', 'cursor', 'gemini'];
  }

  console.error(`toolrepair: uninstalling from platforms: ${platforms.join(', ')}`);

  const results = [];
  for (const platform of platforms) {
    let uninstaller;
    try {
      if (!ALLOWED_PLATFORMS.includes(platform)) {
        console.error(`toolrepair: invalid platform "${platform}" — skipping`);
        continue;
      }
      uninstaller = require(`./platforms/${platform}/uninstall`);
    } catch (e) {
      console.error(`toolrepair: no uninstaller for platform "${platform}" — skipping`);
      continue;
    }

    if (options.dryRun) {
      console.error(`toolrepair: [DRY-RUN] would uninstall from ${platform}`);
      results.push({ platform, dryRun: true });
      continue;
    }

    try {
      const result = await uninstaller.uninstall({
        projectDir,
        isGlobal,
        skipBackup: options.skipBackup,
      });
      results.push({ platform, ...result });
    } catch (err) {
      console.error(`toolrepair: ${platform} uninstall failed: ${err.message}`);
      results.push({ platform, error: err.message });
    }
  }

  // Print summary
  for (const r of results) {
    if (r.error) {
      console.error(`  ${r.platform}: FAILED — ${r.error}`);
    } else if (r.dryRun) {
      console.error(`  ${r.platform}: DRY-RUN`);
    } else {
      const removed = [];
      if (r.hookRemoved) removed.push('hook');
      if (r.rulesRemoved) removed.push('rules');
      if (r.pluginRemoved) removed.push('plugin');
      console.error(`  ${r.platform}: removed ${removed.join(', ') || 'nothing (not found)'}`);
    }
  }
}

module.exports = { uninstall };
