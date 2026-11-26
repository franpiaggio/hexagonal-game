#!/usr/bin/env bash
# Rebuild only the small web library; source .blend files are read-only.
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER_BIN="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
"$BLENDER_BIN" --background --python scripts/export-atlas-assets.py
pnpm exec gltf-transform dequantize .cache/atlas/atlas-source.glb .cache/atlas/dequantized.glb
pnpm exec gltf-transform optimize .cache/atlas/dequantized.glb public/assets/atlas/atlas.glb \
  --compress meshopt --texture-compress webp --texture-size 512 \
  --flatten false --join false --instance false --palette false --simplify false
