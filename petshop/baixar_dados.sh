#!/usr/bin/env bash
set -euo pipefail

DESTINO="$(cd "$(dirname "$0")" && pwd)/data"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --depth 1 https://github.com/amazon-science/petshop-root-cause-analysis.git "$TMP/petshop"

for cenario in low_traffic high_traffic temporal_traffic1; do
  mkdir -p "$DESTINO/$cenario"
  cp "$TMP/petshop/dataset/$cenario/noissue/metrics.csv" "$DESTINO/$cenario/metrics.csv"
  cp "$TMP/petshop/dataset/$cenario/graph.csv" "$DESTINO/$cenario/graph.csv"
done

echo "Dados copiados para $DESTINO"
