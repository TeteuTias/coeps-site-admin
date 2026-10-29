import { ObjectId, type Db } from "mongodb";
import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  buildUsageLimitUpdate,
  getActiveEditionId,
  parseUsageLimit,
  PAYMENT_CODES_COLLECTION,
} from "@/app/lib/payments/payment-code-repository";
import type { PaymentCodeDocument } from "@/app/lib/types/payments/payment-code.t";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ codigoId: string }> },
) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const { codigoId } = await params;
    if (!ObjectId.isValid(codigoId)) {
      return Response.json(
        { error: "invalid_code_id", message: "O identificador do código é inválido." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const limiteUsos = parseUsageLimit(body.limiteUsos);
    if (limiteUsos === null) {
      return Response.json(
        {
          error: "invalid_usage_limit",
          message: "O limite de usos deve ser um número inteiro entre 1 e 5000.",
        },
        { status: 400 },
      );
    }

    const { db: untypedDb } = await connectToDatabase();
    const db = untypedDb as Db;
    const collection = db.collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION);
    const code = await collection.findOne({ _id: new ObjectId(codigoId) });
    if (!code) {
      return Response.json(
        { error: "code_not_found", message: "Código não encontrado." },
        { status: 404 },
      );
    }

    const activeEditionId = await getActiveEditionId(db);
    if (!activeEditionId || code.edicaoId !== activeEditionId) {
      return Response.json(
        {
          error: "inactive_edition",
          message: "Somente códigos da edição ativa podem ser alterados.",
        },
        { status: 409 },
      );
    }

    if (code.tipo !== "DESCONTO" || code.perfilUtilizador !== "PROFISSIONAL_SAUDE") {
      return Response.json(
        {
          error: "usage_limit_not_supported",
          message: "Só códigos de profissionais da saúde têm limite de usos.",
        },
        { status: 400 },
      );
    }

    const usos = Number(code.usosRealizados ?? 0);
    if (limiteUsos < usos) {
      return Response.json(
        {
          error: "limit_below_usage",
          message: `O limite não pode ser menor que os ${usos} usos já feitos.`,
        },
        { status: 409 },
      );
    }

    const { filter, update } = buildUsageLimitUpdate(code._id as ObjectId, limiteUsos);
    const result = await collection.findOneAndUpdate(filter, update, { returnDocument: "after" });
    if (!result) {
      return Response.json(
        {
          error: "code_state_changed",
          message: "O estado do código mudou. Atualize a página e tente novamente.",
        },
        { status: 409 },
      );
    }

    return Response.json({
      message: "Limite de usos atualizado.",
      code: {
        id: String(result._id),
        status: result.status,
        limiteUsos: result.limiteUsos,
        usosRealizados: result.usosRealizados ?? 0,
      },
    });
  } catch (error) {
    console.error("Erro ao alterar limite do código:", error);
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível alterar o limite." },
      { status: 500 },
    );
  }
}
