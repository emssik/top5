#!/bin/bash
set -e

echo "🧹 Cleaning old builds..."
rm -rf dist/

echo "🔨 Building Top5..."
npm run build
npx electron-builder --mac
touch dist/.metadata_never_index

DMG=$(ls -t dist/*.dmg 2>/dev/null | head -1)

if [ -z "$DMG" ]; then
  echo "❌ DMG not found in dist/"
  exit 1
fi

echo "✅ Ready: $DMG"
echo "📦 Opening installer..."
open "$DMG"
