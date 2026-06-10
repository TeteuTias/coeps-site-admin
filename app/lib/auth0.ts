import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL,
  appBaseUrl: process.env.APP_BASE_URL ?? process.env.AUTH0_BASE_URL,
});

type ApiRouteHandler = (...args: any[]) => Response | Promise<Response>;

export function withApiAuthRequired<T extends ApiRouteHandler>(handler: T): T {
  return auth0.withApiAuthRequired(handler) as T;
}
