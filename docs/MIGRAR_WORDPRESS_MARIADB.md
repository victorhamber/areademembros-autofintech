# Migrar WordPress (MariaDB) → App (PostgreSQL)

## Pré-requisitos

- App e Postgres no **mesmo projeto** EasyPanel (rede interna).
- Variáveis no serviço do **app**:
  - `DATABASE_URL` = Postgres do app
  - `WP_DATABASE_URL` = MariaDB do WordPress

Exemplo:

```env
WP_DATABASE_URL=mariadb://mariadb:SENHA@autofintech_wordpress-db:3306/autofintech
DATABASE_URL=postgresql://postgres:SENHA@autofintech_areademembros-db:5432/autofintech?sslmode=disable
```

## O que é importado

| Origem (WordPress) | Destino (app) |
|--------------------|---------------|
| `*_forex_products` | `Product` |
| `*_forex_licenses` | `License` |
| `*_forex_ranking` | `RankingEntry` |
| `*_wplm_links` / `wplm_links` | `ShortLink` |
| `*_wplm_stats` / `wplm_stats` | `ShortLinkClick` |
| `*_forex_form_builder` | `TrialForm` |
| `*_forex_trial_history` | `TrialHistory` |
| `*_forex_outgoing_webhooks` | `OutgoingWebhook` |
| `*_forex_webhook_logs` | `LicenseWebhookRawLog` |
| `*_users` | `User` (senha = hash WP) |
| `wp_options` (forex_*, member_*, carousel, e-mail) | `Setting` |
| `*_ia_*` | **ignorado** |

**Mídia / EAD / ebooks** do plugin antigo não ficam no MariaDB do Gerenciador de Licenças — cadastre no admin do app se precisar.

## Executar (terminal do app no EasyPanel)

1. **Redeploy** do app (código com o script).
2. Adicione `WP_DATABASE_URL` nas variáveis de ambiente.
3. Abra o **terminal** do container do app:

```bash
cd /app
npm run db:migrate:wordpress:dry
```

Confira as contagens. Depois:

```bash
npm run db:migrate:wordpress
```

4. Reinicie o app se necessário.
5. Teste login com um usuário que já existia no WordPress (mesma senha).

## Senhas

- Usuários do WordPress vêm com o **hash** (`$P$…` ou `$2y$…`).
- O login da app foi ajustado para validar esses hashes.
- Quem só tinha licença e não tinha conta WP entra com **primeiro acesso** (define senha no login), como antes.

## Observação

O script **limpa** o Postgres do app antes de importar (exceto com `--no-clear`). Faça backup se já tiver dados manuais no Postgres.
