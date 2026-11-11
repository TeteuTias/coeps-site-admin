import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from "@/app/lib/mongodb";
import {
  getActivePaymentConfig,
  serializePaymentConfig,
} from "@/app/lib/payments/payment-config-repository";

export const dynamic = "force-dynamic";

export const GET = withApiAuthRequired(async function GET() {
  try {
    const { db } = await connectToDatabase();
    const config = await getActivePaymentConfig(db);
    if (!config) {
      return Response.json(
        {
          error: "config_not_found",
          message: "Nenhuma configuração financeira ativa foi encontrada.",
        },
        { status: 404 },
      );
    }

    return Response.json(serializePaymentConfig(config));
  } catch (error) {
    console.error("Erro ao carregar configuração financeira:", error);
    return Response.json(
      {
        error: "internal_server_error",
        message: "Não foi possível carregar a configuração financeira.",
      },
      { status: 500 },
    );
  }
});
