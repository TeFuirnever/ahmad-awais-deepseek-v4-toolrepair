#!/bin/sh
# toolrepair — one-shot installer for ahmad-awais-deepseek-v4-toolrepair.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/main/install.sh | sh
#
# What it does:
#   1. Verifies node >=18 is installed.
#   2. Clones the repo to ~/.toolrepair (or pulls if already cloned).
#   3. Symlinks bin/cli.js into a writable location on $PATH as `toolrepair`.
#   4. Runs `toolrepair install` against the auto-detected platform.
#
# Uninstall: rm -rf ~/.toolrepair ~/.local/bin/toolrepair

set -e

REPO_URL="https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair.git"
INSTALL_DIR="${TOOLREPAIR_HOME:-$HOME/.toolrepair}"
BIN_DIR="${TOOLREPAIR_BIN_DIR:-$HOME/.local/bin}"
LINK_NAME="toolrepair"

say() { printf "toolrepair: %s\n" "$1"; }
fail() { printf "toolrepair: error: %s\n" "$1" >&2; exit 1; }

# 1. node check
command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js >=18 first (https://nodejs.org)."
NODE_MAJOR=$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "node >=18 required, found v$NODE_MAJOR. Upgrade Node.js."
fi
say "node v$(node -v | sed 's/^v//') detected"

# 2. clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  say "updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only --quiet
else
  command -v git >/dev/null 2>&1 || fail "git not found. Install git first."
  say "cloning to $INSTALL_DIR"
  git clone --depth 1 --quiet "$REPO_URL" "$INSTALL_DIR"
fi

# 3. symlink
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/cli.js" "$BIN_DIR/$LINK_NAME"
chmod +x "$INSTALL_DIR/bin/cli.js"
say "linked $BIN_DIR/$LINK_NAME -> $INSTALL_DIR/bin/cli.js"

# PATH hint
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) say "WARN: $BIN_DIR is not on PATH — add it to your shell profile:";
     printf '  export PATH="%s:$PATH"\n' "$BIN_DIR" ;;
esac

# 4. auto-install for detected platform
say "running 'toolrepair install' (auto-detect platform)"
"$INSTALL_DIR/bin/cli.js" install || fail "install command failed — re-run manually after fixing PATH."

say "done. Run 'toolrepair verify' to confirm."
