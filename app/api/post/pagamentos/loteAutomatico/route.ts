import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  PaymentConfigError,
  createAutomaticLot,
} from "@/app/lib/payments/payment-config-repository";

export async function POST(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json();
    const { db } = await connectToDatabase();
    const lote = await createAutomaticLot(
      db,
      body,
      authorization.identity.userId,
    );

    return Response.json(
      { message: "Lote automático criado com sucesso.", data: { lote } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Erro ao criar lote automático:", error);
    return Response.json(
      {
        error: "invalid_request",
        message: "Não foi possível criar o lote automático.",
      },
      { status: 400 },
    );
  }
}
