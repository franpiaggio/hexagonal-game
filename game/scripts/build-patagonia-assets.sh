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
# Standalone houses (models/casas_5). The demo merges each one into a single vertex-coloured
# mesh and ignores its normal maps, so textures are shrunk to a token size.
mkdir -p "$OUT/casas"
for glb in "$SRC"/casas_5/glb/0*.glb; do
  name=$(basename "$glb")
  pnpm exec gltf-transform optimize "$glb" "$OUT/casas/$name" \
    --compress meshopt --texture-compress webp --texture-size 16 \
    --flatten false --join false --instance false --palette false --simplify false >/dev/null
  echo "casas/$name: $(du -h "$OUT/casas/$name" | cut -f1)"
done
