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
  CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir
  touch dist/.metadata_never_index

  APP="dist/mac-arm64/Top5.app"
  if [ ! -d "$APP" ]; then
    echo "❌ App not found at $APP"
    exit 1
  fi

  echo "✅ Ready: $APP"
  echo "📦 Opening app..."
  open "$APP"
fi
