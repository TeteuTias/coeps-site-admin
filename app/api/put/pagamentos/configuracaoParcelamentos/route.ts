import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  assertLoadedActiveConfig,
  PaymentConfigError,
} from "@/app/lib/payments/payment-config-repository";
import type { IParcelamento } from "@/app/lib/types/payments/payment.t";

function parseParcelamentos(value: unknown): IParcelamento[] | null {
  if (!Array.isArray(value)) return null;
  const seenCodes = new Set<number>();
  const parsed: IParcelamento[] = [];

  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const item = raw as Record<string, unknown>;
    if (
      !Number.isInteger(item.codigo) ||
      (item.codigo as number) < 0 ||
      seenCodes.has(item.codigo as number) ||
      !Number.isInteger(item.totalParcelas) ||
      (item.totalParcelas as number) <= 0 ||
      typeof item.valorCadaParcela !== "number" ||
      !Number.isFinite(item.valorCadaParcela) ||
      item.valorCadaParcela < 0
    ) {
      return null;
    }
    seenCodes.add(item.codigo as number);
    parsed.push({
      codigo: item.codigo as number,
      totalParcelas: item.totalParcelas as number,
      valorCadaParcela: item.valorCadaParcela,
    });
  }
  return parsed;
}

export async function PUT(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const configId = typeof body._id === "string" ? body._id : "";
    const parcelamentos = parseParcelamentos(body.parcelamentos);
    if (!parcelamentos) {
      return Response.json(
        {
          error: "invalid_installments",
          message: "O formato dos parcelamentos legados é inválido.",
        },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const activeConfig = await assertLoadedActiveConfig(db, configId);
    const result = await db.collection("ingressos_config").updateOne(
      { _id: activeConfig._id },
      {
        $set: {
          parcelamentos,
          updatedAt: new Date(),
          updatedBy: authorization.identity.userId,
        },
      },
    );
    if (result.matchedCount !== 1) {
      return Response.json(
        { error: "config_changed", message: "A configuração mudou. Recarregue a página." },
        { status: 409 },
      );
    }

    return Response.json({
      message: "Parcelamentos legados atualizados com sucesso.",
      data: { parcelamentos },
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Erro ao atualizar parcelamentos legados:", error);
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível atualizar os parcelamentos." },
      { status: 500 },
    );
  }
}
