#!/bin/sh
# Boot do banco em produção.
# Em produção o banco já está em sincronia (foi populado/mantido via prisma db push).
# `prisma migrate deploy` deixa o histórico em estado inconsistente quando o banco
# foi criado sem `_prisma_migrations`, então usamos `db push` direto — idempotente
# e silencioso quando o schema já bate.

set -u
echo "[db-boot] Sincronizando schema com prisma db push..."
if npx prisma db push --accept-data-loss; then
  echo "[db-boot] OK."
else
  echo "[db-boot] AVISO: db push falhou — API continua subindo."
fi
exit 0
