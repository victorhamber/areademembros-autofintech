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

No Oráculo a barra mede 186 px no desktop e no monitor comum, e 210 px no notebook. Cada peça pede dois arquivos: monitores em 340×400 px (aparece em 170×200) e desktop em 340×760 px (aparece em 170×380). O notebook usa a imagem dos monitores.

## Fila do suporte

Um endereço só, neste painel. O Forex Rendimento não tem outra fila.

`POST https://app.autofintech.com.br/api/oraculo/v1/support-contact`

Sem corpo. O IP é o da conexão. O mesmo IP recebe sempre o mesmo contato. IP novo anda a fila: AutoFintech (`af-contato`), Forex Rendimento (`fx-contato`), e repete. A resposta não entra em cache.

```json
{ "status": "success", "provider": "autofintech", "url": "https://go.trajettu.com/af-contato" }
```

Quem já tem cadastro não usa esta fila. O programa abre o contato do servidor daquela pessoa.

## No programa

O desktop consulta o sininho em `ORACULO_NOTIFICATIONS_URL` e a barra em `ORACULO_ADS_URL`. Sem essas URLs, o Oráculo não busca o servidor. Os dois endereços acima são os que valem neste painel AutoFintech.
