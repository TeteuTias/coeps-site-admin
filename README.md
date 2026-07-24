# COEPS Site Admin

Painel administrativo do COEPS, construído com Next.js 16 e Auth0 v4.

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
npm run build
```

Consulte [docs/auth0-v4-next16-migration.md](docs/auth0-v4-next16-migration.md)
para o contrato de erros e os detalhes da migração.
