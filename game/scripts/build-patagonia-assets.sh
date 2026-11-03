#!/usr/bin/env bash
# Optimizes the Blender-exported Patagonia tiles (../models) into web-ready GLBs.
# Meshopt geometry + WebP textures. Keeps meshes/materials separate so the demo can
# swap materials (ground) per primitive.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=../models
OUT=public/assets/patagonia
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for tile in pradera bosque caserio montana; do
  # Blender exports COLOR_0 as normalized u16; meshopt re-quantization turns those into
  # flat white unless the source is dequantized to float first.
  pnpm exec gltf-transform dequantize "$SRC/glb/$tile.glb" "$TMP/$tile.glb" >/dev/null
  pnpm exec gltf-transform optimize "$TMP/$tile.glb" "$OUT/$tile.glb" \
    --compress meshopt --texture-compress webp --texture-size 1024 \
    --flatten false --join false --instance false --palette false --simplify false >/dev/null
  echo "$tile: $(du -h "$OUT/$tile.glb" | cut -f1)"
done
cp "$SRC/manifest.json" "$OUT/manifest.json"
