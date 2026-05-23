#!/bin/sh
# Boot do banco em produção (Docker / EasyPanel).
# 1) Tenta `prisma migrate deploy` normal.
# 2) Se falhar com P3005 (banco já populado, sem histórico), faz baseline
#    marcando todas as migrações existentes como aplicadas e tenta de novo.
# 3) Último recurso: `prisma db push --accept-data-loss` para manter a API no ar.

set -u

log() {
  echo "[db-boot] $*"
}

run_migrate_deploy() {
  npx prisma migrate deploy 2>&1
}

log "Tentando prisma migrate deploy..."
OUTPUT="$(run_migrate_deploy)"
STATUS=$?
echo "$OUTPUT"

if [ $STATUS -eq 0 ]; then
  log "migrate deploy concluído com sucesso."
  exit 0
fi

if echo "$OUTPUT" | grep -q "P3005"; then
  log "Detectado P3005 (schema já existe, sem histórico). Fazendo baseline..."

  MIGRATIONS=$(ls -1 prisma/migrations 2>/dev/null | grep -v '^migration_lock.toml$' | sort)

  if [ -z "$MIGRATIONS" ]; then
    log "Nenhuma migração encontrada para baseline. Fallback para db push."
    npx prisma db push --accept-data-loss || true
    exit 0
  fi

  for m in $MIGRATIONS; do
    log "  resolve --applied $m"
    npx prisma migrate resolve --applied "$m" || true
  done

  log "Re-executando migrate deploy após baseline..."
  if npx prisma migrate deploy; then
    log "Baseline OK, migrate deploy concluído."
    exit 0
  fi

  log "migrate deploy falhou após baseline. Fallback para db push."
  npx prisma db push --accept-data-loss || true
  exit 0
fi

log "migrate deploy falhou por outro motivo. Fallback para db push."
npx prisma db push --accept-data-loss || true
exit 0
