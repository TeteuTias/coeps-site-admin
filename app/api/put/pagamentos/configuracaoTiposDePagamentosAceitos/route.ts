import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  assertLoadedActiveConfig,
  PaymentConfigError,
} from "@/app/lib/payments/payment-config-repository";
import type { IPaymentConfig } from "@/app/lib/types/payments/payment.t";

const ALLOWED_PAYMENT_TYPES: IPaymentConfig["pagamentosAceitos"] = [
  "PIX",
  "BOLETO",
  "CREDIT_CARD",
  "DEBIT_CARD",
];

function parsePaymentTypes(value: unknown): IPaymentConfig["pagamentosAceitos"] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.filter(
    (item): item is IPaymentConfig["pagamentosAceitos"][number] =>
      typeof item === "string" &&
      ALLOWED_PAYMENT_TYPES.includes(
        item as IPaymentConfig["pagamentosAceitos"][number],
      ),
  );
  if (parsed.length !== value.length || new Set(parsed).size !== parsed.length) {
    return null;
  }
  return parsed;
}

export async function PUT(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const configId = typeof body._id === "string" ? body._id : "";
    const pagamentosAceitos = parsePaymentTypes(body.parcelamentos);
    if (!pagamentosAceitos) {
      return Response.json(
        {
          error: "invalid_payment_types",
          message: "A lista de formas de pagamento é inválida.",
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
          pagamentosAceitos,
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
      message: "Formas de pagamento atualizadas com sucesso.",
      data: { pagamentosAceitos },
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Erro ao atualizar formas de pagamento:", error);
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível atualizar os tipos de pagamento." },
      { status: 500 },
    );
  }
}
