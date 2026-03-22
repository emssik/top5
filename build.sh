#!/bin/bash
set -e

# --release flag: build DMG with signing (slow, for distribution)
# default: quick build — unpacked .app, no signing (fast, for daily use)

if [ "$1" = "--release" ]; then
  echo "🧹 Cleaning old builds..."
  rm -rf dist/

  echo "🔨 Building Top5 (release)..."
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
else
  echo "🔨 Building Top5 (quick)..."
  npm run build
  CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir -c.mac.identity=null
  touch dist/.metadata_never_index

  APP="dist/mac-arm64/Top5.app"
  if [ ! -d "$APP" ]; then
    echo "❌ App not found at $APP"
    exit 1
  fi

  echo "📦 Installing to /Applications..."
  pkill -f "Top5.app" 2>/dev/null || true
  sleep 1
  rm -rf /Applications/Top5.app
  cp -R "$APP" /Applications/Top5.app
  echo "✅ Installed. Opening..."
  open /Applications/Top5.app
fi

# Build & install CLI
echo "🔧 Building CLI..."
(cd cli && npm run build && npm link --silent 2>/dev/null)
echo "✅ CLI ready (top5)"
