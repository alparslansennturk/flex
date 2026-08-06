#!/usr/bin/env bash
# deploy-staging.sh — flex reposunu flexos-loadtest Vercel projesine deploy eder.
#
# Neden gerekli: flexos-loadtest, prod "flex" projesiyle AYNI repodan build ediliyor
# ama git-entegre DEĞİL (manuel deploy) — Vercel CLI proje kimliğini `.vercel/
# project.json`'dan okuyor, o da normalde prod "flex" projesine bağlı. Bu script
# geçici olarak flexos-loadtest'e bağlar, deploy eder, İŞ BİTİNCE (başarılı/başarısız
# fark etmez, `trap`) prod linkini GERİ YÜKLER — repo hep prod'a bağlı kalmalı.
#
# Kullanım: bash scripts/k6/deploy-staging.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGING_PROJECT_JSON='{"projectId":"prj_Eu80acrrc9oOuqohrXTuhp95bxXb","orgId":"team_wY5slMCYYR7PRKZzZrnLdpje","projectName":"flexos-loadtest"}'

if [[ ! -f "$REPO_ROOT/.vercel/project.json" ]]; then
  echo "HATA: $REPO_ROOT/.vercel/project.json yok — önce \`vercel link\` ile prod projesine bağlanmış olmalısın." >&2
  exit 1
fi

BACKUP="$(mktemp)"
cp "$REPO_ROOT/.vercel/project.json" "$BACKUP"
trap 'cp "$BACKUP" "$REPO_ROOT/.vercel/project.json"; rm -f "$BACKUP"; echo "→ .vercel/project.json prod (flex) projesine geri döndürüldü."' EXIT

echo "$STAGING_PROJECT_JSON" > "$REPO_ROOT/.vercel/project.json"
echo "→ Geçici olarak flexos-loadtest projesine bağlanıldı, deploy başlıyor (birkaç dakika sürebilir)..."

cd "$REPO_ROOT"
vercel --prod -y --force
