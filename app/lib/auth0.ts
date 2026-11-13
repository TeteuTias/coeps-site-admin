import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { connectToDatabase } from "@/app/lib/mongodb";
import {
  gravarLog,
  ipDaRequisicao,
  lerAnotacao,
  lerCorpoParaLog,
  METODOS_AUDITADOS,
  montarLogDePedido,
} from "@/app/lib/auditoria/registro";

type ApiRouteHandler = (
  request: Request,
  context?: any,
) => Response | Promise<Response>;

function normalizeDomain(value?: string) {
  return value
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function normalizeAppBaseUrl(value?: string) {
  return value?.trim().replace(/\/+$/, "");
}

const domain =
  normalizeDomain(process.env.AUTH0_DOMAIN) ||
  normalizeDomain(process.env.AUTH0_ISSUER_BASE_URL);

const appBaseUrl =
  normalizeAppBaseUrl(process.env.APP_BASE_URL) ||
  normalizeAppBaseUrl(process.env.AUTH0_BASE_URL);

export const isAuth0Configured = Boolean(domain);

export const auth0 = isAuth0Configured
  ? new Auth0Client({
      domain,
      appBaseUrl,
    })
  : null;

export function getAuth0Client() {
  if (!auth0) {
    throw new Error("Auth0 is not configured.");
  }

  return auth0;
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: code, message }, { status });
}

function isConfigurationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name.toLowerCase().includes("configuration") ||
    /missing|required|domain/i.test(error.message)
  );
}

export const getSession = (...args: any[]) => {
  return (getAuth0Client().getSession as any)(...args);
};

export const getAccessToken = async (...args: any[]) => {
  const result = await (getAuth0Client().getAccessToken as any)(...args);

  return {
    ...result,
    accessToken: result?.token,
  };
};

export function withApiAuthRequired<T extends ApiRouteHandler>(handler: T): T {
  if (!auth0) {
    return (() =>
      jsonError(
        500,
        "auth_configuration_error",
        "O serviço de autenticação não está configurado.",
      )) as unknown as T;
  }

  return (async (request: Request, context?: any) => {
    let sessionUser: { sub?: unknown; email?: unknown; name?: unknown } | null = null;
    try {
      const session = await (getAuth0Client().getSession as any)(request);
      sessionUser = session?.user ?? null;
      if (!session?.user?.sub) {
        return jsonError(
          401,
          "not_authenticated",
          "É necessário iniciar uma sessão para acessar este recurso.",
        );
      }
    } catch (error) {
      if (isConfigurationError(error)) {
        return jsonError(
          500,
          "auth_configuration_error",
          "O serviço de autenticação não está disponível.",
        );
      }

      return jsonError(
        401,
        "authentication_error",
        "Não foi possível validar a sessão.",
      );
    }

    // Aba Logs: toda ação que muda dado (POST/PUT/PATCH/DELETE) vira uma linha de auditoria.
    const auditar = METODOS_AUDITADOS.has(request.method.toUpperCase());
    const inicio = Date.now();
    const corpoParaLog = auditar ? await lerCorpoParaLog(request) : null;
    const registrar = async (status: number | null, erro?: string) => {
      if (!auditar) return;
      try {
        const { db } = await connectToDatabase();
        await gravarLog(db, montarLogDePedido({
          metodo: request.method.toUpperCase(),
          rota: new URL(request.url).pathname,
          corpo: corpoParaLog,
          status,
          usuario: sessionUser,
          ip: ipDaRequisicao(request.headers),
          userAgent: request.headers.get("user-agent"),
          inicio,
          fim: Date.now(),
          anotacao: lerAnotacao(request),
          erro,
        }));
      } catch (error) {
        console.error("auditoria: falha ao registrar pedido", error);
      }
    };

    try {
      const response = await handler(request, context);
      await registrar(response instanceof Response ? response.status : null);

      if (!(response instanceof Response)) {
        return jsonError(
          500,
          "invalid_api_response",
          "A API produziu uma resposta inválida.",
        );
      }

      if (response.status === 204) {
        return response;
      }

      if (response.status >= 500) {
        return jsonError(
          500,
          "internal_server_error",
          "Não foi possível concluir a solicitação.",
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/\bapplication\/(?:[\w.+-]*\+)?json\b/i.test(contentType)) {
        return jsonError(
          response.ok ? 500 : response.status,
          "invalid_api_response",
          "A API produziu uma resposta em formato inesperado.",
        );
      }

      return response;
    } catch (error) {
      await registrar(500, error instanceof Error ? error.message : String(error));
      return jsonError(
        500,
        "internal_server_error",
        "Não foi possível concluir a solicitação.",
      );
    }
  }) as T;
}
