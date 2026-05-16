# Migrar dados do SQLite local para PostgreSQL (EasyPanel)

## O que foi exportado do `prisma/dev.db`

Execute localmente (já feito uma vez):

```bash
npm run db:export:sqlite
```

Gera `tmp/sqlite-export.json` com usuários, licenças, produtos, links, cursos, etc.

## Por que não importa direto do seu PC

A URL interna `autofintech_areademembros-db` só funciona **dentro da rede Docker do EasyPanel**, não no Windows.

## Opção A — Terminal do app no EasyPanel (recomendado)

1. Envie o arquivo `tmp/sqlite-export.json` para o servidor (SFTP / gerenciador de arquivos) e copie para dentro do container do app em `/app/tmp/sqlite-export.json`.
2. No EasyPanel, abra o **terminal** do serviço **area-de-membros-autofintech** (mesmo projeto do Postgres).
3. Rode:

```bash
cd /app
npm run db:import:postgres
```

O `DATABASE_URL` já está nas variáveis do app.

## Opção B — Postgres com porta pública (temporária)

1. No EasyPanel, exponha o PostgreSQL na internet (porta pública) **só para migrar**.
2. No PC, com o export já gerado:

```powershell
$env:DATABASE_URL="postgresql://postgres:SENHA@IP_PUBLICO:5432/autofintech?sslmode=disable"
npm run db:import:postgres
```

3. Feche a porta pública depois.

## Opção C — Tudo em um comando (PC com acesso à rede interna via VPN/SSH)

Se tiver túnel SSH para o host:

```bash
npm run db:migrate:sqlite-to-pg
```

(com `DATABASE_URL` apontando para o destino acessível)

## Depois da importação

- Confira `/admin` (Segurança EA, produtos, clientes).
- Teste login de um usuário conhecido.
- Faça backup do Postgres no EasyPanel.
