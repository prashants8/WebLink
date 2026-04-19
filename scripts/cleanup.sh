#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
REINSTALL=0

if [ "${1:-}" = "--reinstall" ]; then
  REINSTALL=1
fi

echo "Stopping Node.js processes..."
pkill -f "node|next" 2>/dev/null || true

remove_if_present() {
  TARGET_PATH="$1"
  if [ -e "$TARGET_PATH" ]; then
    echo "Removing $TARGET_PATH"
    rm -rf "$TARGET_PATH"
  fi
}

remove_if_present "$ROOT_DIR/.next"
remove_if_present "$ROOT_DIR/node_modules/.cache"
remove_if_present "$ROOT_DIR/.next/lock"
remove_if_present "$ROOT_DIR/.next/trace"
remove_if_present "$ROOT_DIR/node_modules/.cache/webpack"

if [ "$REINSTALL" -eq 1 ]; then
  remove_if_present "$ROOT_DIR/node_modules"
  remove_if_present "$ROOT_DIR/package-lock.json"
fi

echo "Cleanup complete."
