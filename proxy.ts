import { NextResponse, type NextRequest } from "next/server";
import {
  getAuth0Client,
  isAuth0Configured,
} from "./app/lib/auth0";
import checkUserPermission from "./app/lib/user/userPermissionsServerSide";

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
