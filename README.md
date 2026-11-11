# CIEPS Site Admin

Painel administrativo do CIEPS, construído com Next.js 16 e Auth0 v4.

## Ambiente local

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Em `.env.local`,
`AUTH0_DOMAIN` deve conter somente o hostname do tenant, sem protocolo ou barra
final. Não versione credenciais.

Os endpoints de autenticação são `/auth/login` e `/auth/logout`. Os antigos
`/api/auth/login` e `/api/auth/logout` continuam funcionando por redirect de
compatibilidade.

## Verificação

```powershell
npm run typecheck
npm run lint
npm run test:payments-admin
npm run build
```

## Leitura administrativa de pagamentos

O painel financeiro une `pagamentos.atribuicoes` por `usuarioId` com
`pagamentos.sessoes` por `owner`. Ele também consulta somente os campos raiz
sanitizados do ledger v2; o `payload` do webhook nunca faz parte da resposta.

Antes do rollout, execute no repositório do site a migração de índices que cria,
no mínimo:

- `pagamentos.sessoes`: `{ owner: 1, createdAt: -1 }`;
- `pagamentos.webhook_eventos_v2`: `{ purchaseId: 1, status: 1, receivedAt: -1 }`;
- `pagamentos.webhook_eventos_v2`: `{ paymentId: 1, status: 1, receivedAt: -1 }`;
- `pagamentos.webhook_eventos_v2`: `{ installmentId: 1, status: 1, receivedAt: -1 }`,
  com filtro parcial para `installmentId` string.

O admin não cria índices e não deve compensar índice ausente consultando
`payload.*`. A ausência desses índices é bloqueador operacional para produção.

Consulte [docs/auth0-v4-next16-migration.md](docs/auth0-v4-next16-migration.md)
para o contrato de erros e os detalhes da migração.
