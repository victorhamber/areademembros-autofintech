# Matriz de paridade: Gerenciador de Licenças (WordPress) → Área de membros (Node/React)

Legenda de status: `feito` | `parcial` | `pendente` | `N/A`

| Origem (PHP / WP) | Destino (stack) | Critério de aceite | Prioridade | Status |
|-------------------|-----------------|-------------------|--------------|--------|
| `LicenseValidator` + v2 | `server/forex/routes.ts` → `POST /api/forex-rendimento/v1\|v2/validate_license` | Mesma resposta HTTP/corpo para email+conta+system_id; API Key em `X-API-Key`; rate limit 60/min/IP; cache 5 min | EA | feito |
| `WebhookHandler` + `WebhookProcessor` | `POST /api/forex-rendimento/v1/webhook` | Token obrigatório (`hottok` / `x-hotmart-hottok` / `x-webhook-token`); ativar/desativar licença; idempotência `eventId`; log bruto | Vendas | feito |
| `PerformanceEndpoint` | `POST /api/forex-rendimento/v1/submit_performance` | Mesmos campos; cálculo `lucro_percent` e drawdown máximo; períodos 7/15/30 dias | EA | feito |
| `RankingEndpoint` | `GET /api/forex-rendimento/v1/get_ranking` | Top 10 por período 7/15/30; hash de email igual ao PHP | Site/EA | feito |
| `SetupDownloadEndpoint` | `GET /api/forex-rendimento/v1/download_setup` | Download `.set` Windows-1252 por `id` | EA | feito |
| `Tables` (licenças, produtos, …) | `prisma/schema.prisma` | Modelos equivalentes + índices de validação | Core | feito |
| `gu_handle_expired_licenses` | `server/jobs/scheduler.ts` | Licenças `ativa` com `dataExpiracao` &lt; agora → `expirada`; opcional POST robot deactivate | Core | feito |
| `RankingSettings::clean_old_data` | `server/jobs/scheduler.ts` | Remove ranking com mais de 30 dias | Core | feito |
| `IA_Aprendizado_Endpoint` | Removido por desuso | Funcionalidade de IA descontinuada neste projeto | Opcional | N/A |
| Hotmart ebooks (existente) | `server/index.ts` `/api/webhooks/hotmart` | Mantido; convive com webhook de licença | Vendas | feito |
| `PageAccessManager` / login redirect | `App.tsx` + `Login.tsx` + `/api/auth/login` | Login obrigatório na SPA; token JWT; bloqueio se sem compra e sem licença ativa | Membros | feito |
| Shortcode `user_licenses` + AJAX conta MT5 | `GET /api/me/licenses` + `PUT /api/me/licenses/:id/account` | Lista licenças por email do usuário; atualiza `numeroConta` | Membros | feito |
| `CarouselWidget` | `GET /api/public/carousel` + UI | Slides em `Setting` JSON `carousel_slides`; filtro por `licenseSystemId` no cliente | Site | parcial |
| `TrialForm` / `AutoTrial` / anti-trial | `TrialForm`, `TrialHistory` + `POST /api/public/trial` | Trial 7 dias; bloqueio email+systemId | Captura | feito |
| Admin licenças/produtos/webhooks/segurança | `Admin.tsx` + rotas `/api/admin/licenses`… | CRUD e export JSON | Admin | feito |
| EAD trilhas | `Course` / `Module` / `Lesson` / `LessonProgress` + página Cursos | Progresso por aula; aula pode apontar para `ebookId` | EAD | feito |
| Webhooks de saída | `OutgoingWebhook` modelo | Persistência; disparo em eventos = pendente (somente modelo) | Integração | parcial |
| `ElementorFix` | CORS / proxy dev | Não aplicável ao React | N/A | N/A |
| Migração WP → PG | `scripts/migrate-from-wp-export.mjs` | Importa JSON exportado | Cutover | feito |

## Endpoints antigos (WP) → novos (app)

| Antigo (`/wp-json/...`) | Novo (API da app) |
|-------------------------|-------------------|
| `forex-rendimento/v1/validate_license` | `/api/forex-rendimento/v1/validate_license` |
| `forex-rendimento/v2/validate_license` | `/api/forex-rendimento/v2/validate_license` |
| `forex-rendimento/v1/webhook` | `/api/forex-rendimento/v1/webhook` |
| `forex-rendimento/v1/submit_performance` | `/api/forex-rendimento/v1/submit_performance` |
| `forex-rendimento/v1/get_ranking` | `/api/forex-rendimento/v1/get_ranking` |
| `forex-rendimento/v1/download_setup` | `/api/forex-rendimento/v1/download_setup?id=` |

Configurar no EA a **base URL** do servidor da biblioteca + prefixo `/api`.
