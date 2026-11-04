# Oráculo — sininho e publicidade

Dois canais separados. Não misture mensagem de produto com anúncio da barra.

Este painel (AutoFintech) só alcança o Oráculo autenticado neste servidor. Quem entrou pela Forex Rendimento não lê estes JSON.

## Sininho (marketing)

Admin: **Sininho Oráculo**.

JSON público (sem login, sem dado de conta):

`GET https://app.autofintech.com.br/api/oraculo/v1/notifications`

```json
{
  "messages": [
    {
      "id": "aviso-abc1",
      "title": "Atualização disponível",
      "body": "Consulte o canal oficial para atualizar.",
      "starts_at": "2026-11-04T00:00:00Z",
      "expires_at": "2026-11-18T00:00:00Z",
      "url": "https://exemplo.com/aviso",
      "media_url": "https://app.autofintech.com.br/uploads/aviso.png",
      "popup": true,
      "silent": false,
      "kind": "marketing"
    }
  ]
}
```

O Oráculo lê `id`, `title`, `body`, `starts_at`, `expires_at`, `url`, `media_url`, `popup`, `silent`, `kind`. Imagem (png, jpg, gif, webp) ou vídeo (mp4, webm). Teto: 30 mensagens, 100 KB.

## Publicidade (card da barra)

Admin: **Publicidade Oráculo**.

JSON público:

`GET https://app.autofintech.com.br/api/oraculo/v1/ads`

```json
{
  "ads": [
    {
      "id": "peca-abc1",
      "image_url": "https://app.autofintech.com.br/uploads/peca.webp",
      "url": "https://exemplo.com/oferta",
      "starts_at": "2026-11-04T00:00:00Z",
      "expires_at": "2026-11-18T00:00:00Z"
    }
  ]
}
```

Só imagem e link. Vídeo fica no sininho.

No Oráculo a barra mede 210 px no notebook, 220 px no monitor comum e cresce até 340 px no desktop. A imagem entra inteira, alinhada no topo, sem corte. A prévia do admin usa os 220 px do monitor comum.

## No programa

O desktop consulta o sininho em `ORACULO_NOTIFICATIONS_URL` e a barra em `ORACULO_ADS_URL`. Sem essas URLs, o Oráculo não busca o servidor. Os dois endereços acima são os que valem neste painel AutoFintech.
