import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import { evaluateEditionCleanup } from "@/app/lib/payments/payment-history-cleanup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const url = new URL(request.url);
    const rawEdition = url.searchParams.get("edicaoId");
    if (!rawEdition) {
      return Response.json(
        {
          error: "edition_required",
          message: "Informe explicitamente a edição que deseja consultar.",
        },
        { status: 409 },
      );
    }

    const { db } = await connectToDatabase();
    const evaluation = await evaluateEditionCleanup(db, rawEdition);
    if (!evaluation) {
      return Response.json(
        { error: "invalid_edition", message: "O identificador da edição é inválido." },
        { status: 400 },
      );
    }

    return Response.json(evaluation);
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_EDITION_NOT_CONFIGURED") {
      return Response.json(
        {
          error: "active_edition_not_configured",
          message: "Configure PAYMENT_EDITION_ID antes de consultar a limpeza anual.",
        },
        { status: 409 },
      );
    }

    console.error("Erro ao calcular prévia da limpeza anual:", error);
    return Response.json(
      {
        error: "internal_server_error",
        message: "Não foi possível calcular a prévia da limpeza.",
      },
      { status: 500 },
    );
  }
}
