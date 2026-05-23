#!/bin/sh
# Boot do banco em produção (Docker / EasyPanel).
# - Exige migration.sql em cada pasta antes de usar migrate.
# - Baseline (P3005): marca migrações em ordem; se uma falhar, não continua.
# - Corrige baseline parcial (ex.: migrações 2/3 aplicadas sem a 1).

set -u

log() {
  echo "[db-boot] $*"
}

list_migrations() {
  for d in prisma/migrations/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    [ -f "${d}migration.sql" ] || continue
    echo "$name"
  done | sort
}

verify_migration_files() {
  missing=""
  for d in prisma/migrations/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    if [ ! -f "${d}migration.sql" ]; then
      missing="$missing $name"
    fi
  done
  if [ -n "$missing" ]; then
    log "ERRO: migration.sql ausente em:$missing"
    log "Usando apenas prisma db push (sem migrate deploy)."
    return 1
  fi
  return 0
}

baseline_all_migrations() {
  log "Baseline: marcando migrações como já aplicadas..."
  for name in $(list_migrations); do
    log "  resolve --applied $name"
    if ! npx prisma migrate resolve --applied "$name"; then
      log "Falha ao marcar $name como aplicada."
      return 1
    fi
  done
  return 0
}

# Remove registros de migrações posteriores quando a primeira não foi aplicada (estado quebrado).
repair_partial_baseline() {
  log "Tentando reparar baseline parcial..."
  reversed=$(list_migrations | sort -r)
  for name in $reversed; do
    npx prisma migrate resolve --rolled-back "$name" 2>/dev/null && log "  rolled-back $name"
  done
}

run_db_push() {
  npx prisma db push --accept-data-loss
}

log "Verificando arquivos de migração..."
if ! verify_migration_files; then
  run_db_push || true
  exit 0
fi

COUNT=$(list_migrations | wc -l | tr -d ' ')
log "Encontradas $COUNT migração(ões) com migration.sql."

log "Tentando prisma migrate deploy..."
if OUTPUT=$(npx prisma migrate deploy 2>&1); then
  echo "$OUTPUT"
  log "migrate deploy concluído com sucesso."
  exit 0
fi

echo "$OUTPUT"

if echo "$OUTPUT" | grep -q "P3005"; then
  log "Detectado P3005 (banco já populado, sem histórico)."
  if baseline_all_migrations && npx prisma migrate deploy; then
    log "Baseline OK."
    exit 0
  fi
  repair_partial_baseline
  if baseline_all_migrations && npx prisma migrate deploy; then
    log "Baseline OK após reparo."
    exit 0
  fi
fi

if echo "$OUTPUT" | grep -qE "P3015|P3017"; then
  log "Detectado estado inconsistente de migrações (P3015/P3017)."
  repair_partial_baseline
  if baseline_all_migrations && npx prisma migrate deploy; then
    log "migrate deploy OK após reparo."
    exit 0
  fi
fi

log "Fallback: prisma db push."
run_db_push || true
exit 0
