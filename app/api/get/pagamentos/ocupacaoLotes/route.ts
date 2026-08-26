import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from "@/app/lib/mongodb";
import { getAutomaticLotOccupancy } from "@/app/lib/payments/automatic-lot-occupancy";
import {
  assertLoadedActiveConfig,
  PaymentConfigError,
} from "@/app/lib/payments/payment-config-repository";

export const dynamic = "force-dynamic";

export const GET = withApiAuthRequired(async function GET(request: Request) {
  try {
    const configId = new URL(request.url).searchParams.get("configId") ?? "";
    const { db } = await connectToDatabase();
    const config = await assertLoadedActiveConfig(db, configId);
    const occupancy = await getAutomaticLotOccupancy(db, config);

    return Response.json(occupancy, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    console.error("Erro ao calcular ocupação dos lotes:", error);
    return Response.json(
      {
        error: "internal_server_error",
        message: "Não foi possível calcular a ocupação dos lotes.",
      },
      { status: 500 },
    );
  }
});
