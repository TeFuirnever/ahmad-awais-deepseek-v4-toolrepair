#!/usr/bin/env node
// Zero-dependency CLI for ahmad-awais-deepseek-v4-toolrepair

const MIN_NODE_MAJOR = 18;
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < MIN_NODE_MAJOR) {
  console.error(`toolrepair: requires Node.js >=${MIN_NODE_MAJOR}, found v${process.versions.node}. Upgrade Node.js: https://nodejs.org`);
  process.exit(1);
}

const pkg = require('../package.json');

const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args) {
  const flags = {};
  let positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.substring(2, eq)] = a.substring(eq + 1);
      } else {
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          flags[a.substring(2)] = next;
          i++;
        } else {
          flags[a.substring(2)] = true;
        }
      }
    } else if (a.startsWith('-')) {
      flags[a.substring(1)] = true;
    } else {
      positional.push(a);
    }
  }
  flags._ = positional;
  return flags;
}

function showHelp() {
  console.log(`
ahmad-awais-deepseek-v4-toolrepair v${pkg.version}
Auto-repair DeepSeek V4 tool-calling quirks for Claude Code and OpenCode.

USAGE:
  npx ahmad-awais-deepseek-v4-toolrepair <command> [options]

COMMANDS:
  install     Install toolrepair rules and hooks/plugins
  uninstall   Uninstall toolrepair
  verify      Verify installation integrity
  help        Show this help

INSTALL OPTIONS:
  --platform <p>   Target: claude-code, opencode (default: auto-detect)
  --project <dir>  Project directory (default: current)
  --rules-only     Only install instruction rules
  --plugin-only    Only install hook/plugin
  --force, -f      Reinstall even if already present (overwrites)
  --dry-run        Show what would be done without changes
  --skip-backup    Skip creating backups (not recommended)

UNINSTALL OPTIONS:
  --platform <p>   Target: claude-code, opencode
  --project <dir>  Project directory
  --dry-run        Show what would be removed

EXAMPLES:
  npx ahmad-awais-deepseek-v4-toolrepair install
  npx ahmad-awais-deepseek-v4-toolrepair install --platform claude-code --rules-only
  npx ahmad-awais-deepseek-v4-toolrepair install --project ./my-project
  npx ahmad-awais-deepseek-v4-toolrepair verify
  npx ahmad-awais-deepseek-v4-toolrepair uninstall

Based on Ahmad Awais's research: making DeepSeek V4 beat Opus 4.7 by auto-repairing tool-calling quirks.
`);
  process.exit(0);
}

const flags = parseFlags(args.slice(1));

switch (command) {
  case 'version':
  case '--version':
  case '-v':
    console.log(pkg.version);
    process.exit(0);

  case 'install': {
    const run = async () => {
      if (flags.force || flags.f) {
        const { uninstall } = require('../src/uninstall');
        await uninstall({
          platform: flags.platform,
          project: flags.project,
          skipBackup: flags['skip-backup'],
          dryRun: flags['dry-run'],
        }).catch(() => {});
      }
      const { install } = require('../src/install');
      return install({
        platform: flags.platform,
        project: flags.project,
        rulesOnly: flags['rules-only'] || flags.r,
        pluginOnly: flags['plugin-only'] || flags.p,
        skipBackup: flags['skip-backup'],
        dryRun: flags['dry-run'],
      });
    };
    run().catch(err => {
      console.error(`toolrepair: install failed: ${err.message}`);
      process.exit(1);
    });
    break;
  }

  case 'uninstall': {
    const { uninstall } = require('../src/uninstall');
    uninstall({
      platform: flags.platform,
      project: flags.project,
      skipBackup: flags['skip-backup'],
      dryRun: flags['dry-run'],
    }).catch(err => {
      console.error(`toolrepair: uninstall failed: ${err.message}`);
      process.exit(1);
    });
    break;
  }

  case 'verify': {
    const { verify } = require('../src/verify');
    verify({
      platform: flags.platform,
      project: flags.project,
    }).catch(err => {
      console.error(`toolrepair: verify failed: ${err.message}`);
      process.exit(1);
    });
    break;
  }

  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp();
    break;
}
