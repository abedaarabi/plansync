#!/usr/bin/env bash
# Stage Tailwind v4 Linux GNU natives without mutating the workspace lockfile tree.
set -eu

if [ -f node_modules/lightningcss/lightningcss.linux-x64-gnu.node ] \
  && [ -d node_modules/@tailwindcss/oxide-linux-x64-gnu ]; then
  echo "Linux Tailwind native bindings already present"
  exit 0
fi

LC_VER=$(node -p "require('./package-lock.json').packages['node_modules/lightningcss']?.version ?? ''")
OX_VER=$(node -p "require('./package-lock.json').packages['node_modules/@tailwindcss/oxide']?.version ?? ''")
if [ -z "$LC_VER" ] || [ -z "$OX_VER" ]; then
  echo "Could not read lightningcss / @tailwindcss/oxide versions from package-lock.json"
  exit 1
fi

NATIVES=$(mktemp -d)
npm install --prefix "$NATIVES" --no-save --no-package-lock --no-audit --no-fund \
  "lightningcss-linux-x64-gnu@${LC_VER}" \
  "@tailwindcss/oxide-linux-x64-gnu@${OX_VER}"
cp -R "$NATIVES/node_modules/lightningcss-linux-x64-gnu" node_modules/
mkdir -p node_modules/@tailwindcss
cp -R "$NATIVES/node_modules/@tailwindcss/oxide-linux-x64-gnu" node_modules/@tailwindcss/
cp node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node \
  node_modules/lightningcss/lightningcss.linux-x64-gnu.node
