import type { Db } from "mongodb";
import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import { getActiveEditionId } from "@/app/lib/payments/payment-code-repository";
import {
  deleteUnusedCodes,
  MAX_BULK_CODE_DELETION,
  parseCodeIds,
} from "@/app/lib/payments/code-deletion";

/** Exclusão em lote dos códigos selecionados, com as mesmas regras da exclusão individual. */
export async function DELETE(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ids = parseCodeIds(body.ids);
    if (!ids) {
      return Response.json(
        {
          error: "invalid_code_ids",
          message: `Selecione de 1 a ${MAX_BULK_CODE_DELETION} códigos válidos.`,
        },
        { status: 400 },
      );
    }

    const { db: untypedDb } = await connectToDatabase();
    const db = untypedDb as Db;
    const activeEditionId = await getActiveEditionId(db);
    if (!activeEditionId) {
      return Response.json(
        { error: "inactive_edition", message: "Nenhuma edição ativa configurada." },
        { status: 409 },
      );
    }

    const result = await deleteUnusedCodes(db, ids, activeEditionId);
    return Response.json({
      ...result,
      message: result.ignorados.length
        ? `${result.excluidos} código(s) excluído(s); ${result.ignorados.length} não puderam ser excluídos.`
        : `${result.excluidos} código(s) excluído(s).`,
    });
  } catch (error) {
    console.error("Erro ao excluir códigos em lote:", error);
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível excluir os códigos." },
      { status: 500 },
    );
  }
}
