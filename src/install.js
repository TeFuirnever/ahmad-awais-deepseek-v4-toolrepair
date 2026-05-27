// Main installer — detects platform and delegates.
const path = require('path');
const os = require('os');
const fs = require('fs');
const { ALLOWED_PLATFORMS } = require('./constants');

const CLAUDE_CODE_PATHS = {
  settings: path.join(os.homedir(), '.claude', 'settings.json'),
  claudeMd: path.join(os.homedir(), '.claude', 'CLAUDE.md'),
  hooksDir: path.join(os.homedir(), '.claude', 'hooks'),
};

const OPENCODE_PATHS = {
  config: path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
  agentsMd: path.join(os.homedir(), '.config', 'opencode', 'AGENTS.md'),
  claudeMd: path.join(os.homedir(), '.claude', 'CLAUDE.md'),
};

function detectPlatforms() {
  // Both platforms are always available as install targets — installers create
  // their config directories on demand. Detection used to gate on existing
  // settings.json, but that wrongly excluded fresh-user installs.
  return ['claude-code', 'opencode', 'cursor'];
}

function detectProjectPlatforms(projectDir) {
  const platforms = [];
  if (fs.existsSync(path.join(projectDir, '.claude'))) platforms.push('claude-code');
  if (fs.existsSync(path.join(projectDir, '.opencode'))) platforms.push('opencode');
  if (fs.existsSync(path.join(projectDir, 'opencode.json'))) platforms.push('opencode');
  if (fs.existsSync(path.join(projectDir, '.cursorrules')) || fs.existsSync(path.join(projectDir, '.cursor'))) platforms.push('cursor');
  return platforms;
}

async function install(options = {}) {
  const cwd = process.cwd();
  const projectDir = options.project ? path.resolve(options.project) : cwd;
  const isGlobal = !options.project;

  // Determine target platforms
  let platforms;
  if (options.platform) {
    platforms = [options.platform];
  } else {
    platforms = isGlobal ? detectPlatforms() : detectProjectPlatforms(projectDir);
    if (platforms.length === 0) {
      // Try both — install will fail gracefully if config not found
      platforms = ['claude-code', 'opencode', 'cursor'];
    }
  }

  console.error(`toolrepair: installing for platforms: ${platforms.join(', ')}`);
  if (isGlobal) {
    console.error('toolrepair: global install');
  } else {
    console.error(`toolrepair: project install → ${projectDir}`);
  }

  const results = [];
  const rulesOnly = options.rulesOnly;
  const pluginOnly = options.pluginOnly;

  for (const platform of platforms) {
    if (!ALLOWED_PLATFORMS.includes(platform)) {
      console.error(`toolrepair: invalid platform "${platform}" — skipping`);
      continue;
    }
    let installer;
    try {
      installer = require(`./platforms/${platform}/install`);
    } catch (e) {
      console.error(`toolrepair: no installer for platform "${platform}" — skipping`);
      continue;
    }

    if (options.dryRun) {
      console.error(`toolrepair: [DRY-RUN] would install for ${platform}`);
      results.push({ platform, dryRun: true });
      continue;
    }

    try {
      const result = await installer.install({
        projectDir,
        isGlobal,
        rulesOnly,
        pluginOnly,
        skipBackup: options.skipBackup,
        sourceDir: path.resolve(__dirname, '..'),
      });
      results.push({ platform, ...result });
    } catch (err) {
      console.error(`toolrepair: ${platform} install failed: ${err.message}`);
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
      const parts = [];
      if (r.rulesInstalled) parts.push('rules');
      if (r.hookInstalled) parts.push('hook');
      if (r.pluginInstalled) parts.push('plugin');
      console.error(`  ${r.platform}: installed ${parts.join(', ') || 'nothing (already present)'}`);
    }
  }
}

module.exports = { install };
