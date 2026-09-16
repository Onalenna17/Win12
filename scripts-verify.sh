#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB="$ROOT/app/src/main/assets/web"
cd "$WEB"
if [ ! -d node_modules/react ] || [ ! -x node_modules/.bin/vite ]; then
  npm ci
fi
npm run build
cd "$ROOT"
./gradlew :app:assembleDebug
printf '\nWIN12 verification completed. APKs are under app/build/outputs/apk/.\n'
