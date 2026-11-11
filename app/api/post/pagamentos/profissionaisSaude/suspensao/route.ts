import type { Db } from "mongodb";
import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import { getActiveEditionId } from "@/app/lib/payments/payment-code-repository";
import {
  countHealthSuspension,
  reactivateHealthProfessionals,
  suspendHealthProfessionals,
} from "@/app/lib/payments/health-suspension";

const noEdition = () =>
  Response.json(
    { error: "edition_required", message: "Nenhuma edição ativa configurada." },
    { status: 409 },
  );

export async function GET(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const { db: untypedDb } = await connectToDatabase();
    const db = untypedDb as Db;
    const edicaoId = await getActiveEditionId(db);
    if (!edicaoId) return noEdition();

    return Response.json({ edicaoId, ...(await countHealthSuspension(db, edicaoId)) });
  } catch {
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível consultar a suspensão." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.acao !== "SUSPENDER" && body.acao !== "REATIVAR") {
      return Response.json(
        { error: "invalid_action", message: "A ação deve ser SUSPENDER ou REATIVAR." },
        { status: 400 },
      );
    }

    const { db: untypedDb } = await connectToDatabase();
    const db = untypedDb as Db;
    const edicaoId = await getActiveEditionId(db);
    if (!edicaoId) return noEdition();

    const adminId = authorization.identity.userId;
    const result = body.acao === "SUSPENDER"
      ? await suspendHealthProfessionals(db, edicaoId, adminId)
      : await reactivateHealthProfessionals(db, edicaoId, adminId);

    return Response.json({ acao: body.acao, edicaoId, ...result });
  } catch {
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível alterar a suspensão." },
      { status: 500 },
    );
  }
}
