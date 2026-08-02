import { getSession } from "@/app/lib/auth0";

const DEFAULT_FINANCE_ADMIN_ID = "67098341f7397b370e9cb8ba";

export interface FinanceAdminIdentity {
  userId: string;
  subject: string;
}

type FinanceAdminResult =
  | { authorized: true; identity: FinanceAdminIdentity }
  | { authorized: false; response: Response };

function jsonError(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status });
}

function configuredAdminIds() {
  const configured = (process.env.FINANCE_ADMIN_USER_IDS ?? "")
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(
    configured.length > 0 ? configured : [DEFAULT_FINANCE_ADMIN_ID],
  );
}

export async function requireFinanceAdmin(
  request: Request,
): Promise<FinanceAdminResult> {
  let session;

  try {
    session = await getSession(request);
  } catch {
    return {
      authorized: false,
      response: jsonError(
        401,
        "authentication_error",
        "Não foi possível validar a sessão administrativa.",
      ),
    };
  }

  const subject = session?.user?.sub;
  if (typeof subject !== "string" || subject.trim() === "") {
    return {
      authorized: false,
      response: jsonError(
        401,
        "not_authenticated",
        "É necessário iniciar uma sessão para acessar este recurso.",
      ),
    };
  }

  const userId = subject.replace(/^auth0\|/, "");
  const allowedIds = configuredAdminIds();

  if (!allowedIds.has(subject) && !allowedIds.has(userId)) {
    return {
      authorized: false,
      response: jsonError(
        403,
        "finance_admin_required",
        "Somente administradores financeiros podem executar esta operação.",
      ),
    };
  }

  return {
    authorized: true,
    identity: { userId, subject },
  };
}
