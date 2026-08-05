import { ObjectId, type Db } from "mongodb";
import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  buildAttributionFilter,
  getActiveEditionId,
  PAYMENT_ATTRIBUTIONS_COLLECTION,
  PAYMENT_CODES_COLLECTION,
} from "@/app/lib/payments/payment-code-repository";
import type {
  PaymentAttributionDocument,
  PaymentCodeDocument,
} from "@/app/lib/types/payments/payment-code.t";

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
    if (body.status !== "ATIVO" && body.status !== "INATIVO") {
      return Response.json(
        {
          error: "invalid_status",
          message: "O administrador só pode ativar ou desativar um código.",
        },
        { status: 400 },
      );
    }

    const { db: untypedDb } = await connectToDatabase();
    const db = untypedDb as Db;
    const code = await db
      .collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION)
      .findOne({ _id: new ObjectId(codigoId) });

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

    if (code.status === "RESERVADO") {
      return Response.json(
        {
          error: "reserved_code",
          message: "O código está reservado por uma compra e não pode ser alterado.",
        },
        { status: 409 },
      );
    }

    if (code.tipo === "DESCONTO") {
      const hasUsage = await db
        .collection<PaymentAttributionDocument>(PAYMENT_ATTRIBUTIONS_COLLECTION)
        .countDocuments(buildAttributionFilter(code), { limit: 1 });
      if (hasUsage > 0) {
        return Response.json(
          {
            error: "code_already_used",
            message: "Descontos vinculados a uma compra não podem ser alterados.",
          },
          { status: 409 },
        );
      }
    }

    const result = await db.collection(PAYMENT_CODES_COLLECTION).findOneAndUpdate(
      { _id: code._id, status: { $ne: "RESERVADO" } },
      { $set: { status: body.status, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

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
      message: body.status === "ATIVO" ? "Código ativado." : "Código desativado.",
      code: {
        id: String(result._id),
        status: result.status,
        updatedAt:
          result.updatedAt instanceof Date ? result.updatedAt.toISOString() : result.updatedAt,
      },
    });
  } catch (error) {
    console.error("Erro ao alterar código:", error);
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível alterar o código." },
      { status: 500 },
    );
  }
}
