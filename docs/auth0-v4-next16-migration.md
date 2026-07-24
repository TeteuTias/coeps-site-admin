# Migração para Auth0 v4 e Next.js 16

## Causa da regressão

O projeto atualizou `next` e `@auth0/nextjs-auth0`, mas manteve imports e
convenções da API Auth0 v3. O módulo `@auth0/nextjs-auth0/edge` foi removido,
`UserProvider` deixou de ser o provider do cliente e o Next 16 passou a usar
`proxy.ts` e parâmetros dinâmicos assíncronos. Como consequência, páginas e
APIs falhavam antes de executar os handlers e podiam devolver HTML para
consumidores que esperavam JSON.

## Variáveis de ambiente

As variáveis atuais são:

- `AUTH0_DOMAIN`: hostname do tenant, sem `https://` e sem barra final.
- `APP_BASE_URL`: URL da aplicação; localmente, `http://localhost:3000`.
- `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` e `AUTH0_SECRET`.

Durante a transição, `AUTH0_ISSUER_BASE_URL` e `AUTH0_BASE_URL` continuam
aceitas como fallback. As variáveis modernas têm precedência. Segredos,
cookies, tokens e `.env.local` não devem ser versionados ou registrados em
logs.

## URLs de autenticação

O Auth0 v4 monta login e logout em `/auth/login` e `/auth/logout`. A rota
`/api/auth/[auth0]` redireciona os URLs antigos para `/auth/[ação]`, preservando
query strings.

## Contrato JSON

APIs protegidas nunca redirecionam para páginas HTML:

- Sem sessão: `401 application/json`, código `not_authenticated`.
- Sem permissão: `403 application/json`, código `forbidden`.
- Falha de configuração/autenticação: JSON estruturado e mensagem segura.
- Falha interna: `500 application/json`, sem tokens, cookies ou detalhes
  sensíveis.

Os adaptadores locais ficam em `app/lib/auth0.ts`. O provider e `useUser` são
reexportados por `app/lib/auth0-client.ts`.

## De middleware para proxy

`middleware.js` foi substituído por `proxy.ts`. O proxy:

1. entrega `/auth/*` ao middleware do SDK;
2. deixa `/api/auth/*` chegar à rota de compatibilidade;
3. valida a sessão;
4. chama `checkUserPermission`;
5. retorna `401`/`403` JSON para APIs e inicia login ou reescreve
   `/not-allowed` para páginas.

O matcher exclui `_next`, favicon, sitemap e robots.

## Parâmetros dinâmicos

Route Handlers dinâmicos executam `await params`. Páginas client-side usam
`useParams`, que é a API apropriada para obter parâmetros já resolvidos sem
acessar diretamente a Promise de `params` do Next 16.

## Execução e verificação

```powershell
npm ci
npm run typecheck
npm run lint
npm run build
npm run dev
```

Sem autenticação, verifique:

```powershell
curl.exe -i http://localhost:3000/
curl.exe -i http://localhost:3000/api/get/todosCongressistas
```

A página deve iniciar login e a API deve responder `401 application/json`.
Com contas de teste, valide login/logout, congressistas, trabalhos, atividades,
pagamentos, rotas dinâmicas e o `403` de uma conta sem permissão.
