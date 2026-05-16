# Migração a partir de backup `.wpress`

Este projeto permite importar os dados essenciais do WordPress (licenças/produtos/trial), descartando a parte de IA do robô.

## 1) Extrair o `.wpress`

Na raiz do workspace:

```bash
npx wpress-extract "autofintech-com-br-20260513-153302-hmtofdihh398.wpress" --out "wp_extract" --force
```

Saída esperada: pasta `wp_extract` contendo `database.sql`, `uploads`, `themes` e `plugins`.

## 2) Importar banco limpo (sem IA)

Dentro de `Biblioteca de Ebooks`:

```bash
npm run db:import:wpress-sql
```

Esse comando:

- lê `../wp_extract/database.sql`;
- gera `./tmp/wp-clean-export.json` (export limpo);
- importa no Prisma (`Product`, `License`, `TrialForm`, `TrialHistory`);
- descarta dados de IA (`ia_aprendizado` e `ia_dados_detalhados`).
- por padrão, ignora dados de trial/formulário.

Se quiser importar trial também:

```bash
node scripts/import-clean-wpress-sql.mjs ../wp_extract/database.sql --out ./tmp/wp-clean-export.json --apply --include-trial
```

## 2.1) Limpeza periódica do banco (recomendado)

Para manter o banco enxuto:

```bash
npm run db:prune
```

Modo agressivo (remove também histórico de trial, wishlists, highlights e webhooks auxiliares):

```bash
npm run db:prune:aggressive
```

## 3) Ajustar aparência final ao estilo do WordPress

Para aproximar o visual final:

- reutilize imagens de `wp_extract/uploads`;
- use `wp_extract/themes/hello-elementor` como referência de tipografia/spacing;
- replique textos e estrutura das páginas no front (`src/pages`), mantendo o fluxo de login e acesso atual.
