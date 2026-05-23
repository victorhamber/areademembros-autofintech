# Deploy EasyPanel — uploads e erro 502

## Erro 502 ao enviar mídia

HTTP **502** significa que o proxy (Traefik/Nginx do EasyPanel) **não recebeu resposta** do container Node — não é validação de WebP no código.

### Checklist

1. **Variável de ambiente**
   - `UPLOAD_DIR=/app/uploads` (mesmo caminho do volume)

2. **Volume persistente**
   - Um volume basta: destino no container **`/app/uploads`** (como no EasyPanel)

3. **Deploy**
   - Após cada deploy, aguarde ~30s (migração Prisma no boot) antes de testar upload.

4. **Health**
   - Abra: `https://app.autofintech.com.br/api/health`
   - Deve retornar `"uploadsWritable": true` e `"uploadDir": "/app/uploads"`.

5. **Proxy**
   - Todo tráfego `https://app…/` deve ir para a **porta 3000** do container (um único serviço Node serve API + frontend).
   - Não use um serviço só estático para `/` e outro morto para `/api`.

6. **Limites do proxy** (se ainda der 502 em arquivos grandes)
   - `client_max_body_size 80m;`
   - `proxy_read_timeout 120s;`
   - `proxy_send_timeout 120s;`

### Comando de migração manual (SSH/console do container)

```bash
npx prisma migrate deploy
```
