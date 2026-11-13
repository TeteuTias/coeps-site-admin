import { NextResponse, type NextRequest } from "next/server";
import {
  getAuth0Client,
  isAuth0Configured,
} from "./app/lib/auth0";
import checkUserPermission from "./app/lib/user/userPermissionsServerSide";
import { connectToDatabase } from "./app/lib/mongodb";
import { registrarEvento, registrarLogin } from "./app/lib/auditoria/acesso";

async function bancoDeLogs() {
  try {
    return (await connectToDatabase()).db;
  } catch (error) {
    console.error("auditoria: banco indisponível no proxy", error);
    return null;
  }
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status });
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const routeType = pathname.startsWith("/api/") ? "api" : "page";

  if (!isAuth0Configured) {
    return jsonError(
      500,
      "auth_configuration_error",
      "O serviço de autenticação não está configurado.",
    );
  }

  const auth0 = getAuth0Client();

  if (pathname.startsWith("/auth/")) {
    // Saída de conta: grava antes de o Auth0 apagar a sessão.
    if (pathname === "/auth/logout") {
      const sessaoAtual = await auth0.getSession(req).catch(() => null);
      const db = sessaoAtual?.user?.sub ? await bancoDeLogs() : null;
      if (db) {
        await registrarEvento(db, sessaoAtual, { acao: "acesso.logout", resumo: "Saiu do Admin", sucesso: true, metodo: req.method, rota: pathname, headers: req.headers });
      }
    }
    return auth0.middleware(req);
  }

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  let authResponse: NextResponse;
  try {
    authResponse = await auth0.middleware(req);
  } catch {
    return jsonError(
      500,
      "auth_configuration_error",
      "O serviço de autenticação não está disponível.",
    );
  }

  let session;
  try {
    session = await auth0.getSession(req);
  } catch {
    return routeType === "api"
      ? jsonError(401, "authentication_error", "Não foi possível validar a sessão.")
      : auth0.startInteractiveLogin({ returnTo: `${pathname}${search}` });
  }

  if (!session?.user?.sub) {
    return routeType === "api"
      ? jsonError(
          401,
          "not_authenticated",
          "É necessário iniciar uma sessão para acessar este recurso.",
        )
      : auth0.startInteractiveLogin({ returnTo: `${pathname}${search}` });
  }

  // Entrada na conta: uma linha por sessão do Auth0, com IP e navegador.
  const dbLogs = await bancoDeLogs();
  if (dbLogs) await registrarLogin(dbLogs, session, req.method, pathname, req.headers);

  if (pathname === "/not-allowed") {
    return authResponse;
  }
  const userId = session.user.sub.replace(/^auth0\|/, "");
  let canUserAccess = false;  
  try {
    canUserAccess = await checkUserPermission(
      new URL(req.url),
      routeType,
      userId,
    );
  } catch {
    return jsonError(
      500,
      "authorization_error",
      "Não foi possível verificar as permissões.",
    );
  }

  if (!canUserAccess) {
    // Tentativa de ação sem permissão fica registrada (leituras negadas não, para não encher o log).
    if (routeType === "api" && req.method !== "GET" && req.method !== "HEAD" && dbLogs) {
      await registrarEvento(dbLogs, session, { acao: "acesso.negado", resumo: `Tentou ${req.method} ${pathname} sem permissão`, sucesso: false, status: 403, metodo: req.method, rota: pathname, headers: req.headers });
    }
    if (routeType === "api") {
      return jsonError(
        403,
        "forbidden",
        "Você não tem permissão para acessar este recurso.",
      );
    }

    const notAllowedUrl = req.nextUrl.clone();
    notAllowedUrl.pathname = "/not-allowed";
    notAllowedUrl.search = "";
    return NextResponse.rewrite(notAllowedUrl);
  }

  return authResponse;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|sitemap.xml|robots.txt).*)"],
};
