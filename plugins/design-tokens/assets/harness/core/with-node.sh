#!/bin/bash
# Runs a gate script from this folder under Node, from the repository root.
# Claude Code's hooks inherit the app's environment, which may not have a
# version manager on PATH; when `node` is missing, nvm's default (or the
# project's .nvmrc) is loaded first.
#
#   .claude/hooks/design-tokens/with-node.sh check-on-edit.mjs   (the hook's JSON on stdin)
set -eo pipefail
cd "$(dirname "$0")/../../.."
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 && nvm use --silent >/dev/null 2>&1
fi
exec node ".claude/hooks/design-tokens/$1"
