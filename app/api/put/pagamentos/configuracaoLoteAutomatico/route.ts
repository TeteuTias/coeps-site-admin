import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  PaymentConfigError,
  updateAutomaticLot,
} from "@/app/lib/payments/payment-config-repository";

export async function PUT(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json();
    const { db } = await connectToDatabase();
    const lote = await updateAutomaticLot(
      db,
      body,
      authorization.identity.userId,
    );

    return Response.json({
      message: "Lote automático atualizado com sucesso.",
      data: { lote },
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Erro ao atualizar lote automático:", error);
    return Response.json(
      {
        error: "invalid_request",
        message: "Não foi possível atualizar o lote automático.",
      },
      { status: 400 },
    );
  }
}
