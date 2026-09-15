import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  createUniqueDiscountCodeDocuments,
  normalizeEditionId,
  parseDiscountPercentage,
  parseDiscountQuantity,
} from "@/app/lib/payments/payment-code-repository";
import { getActivePaymentConfig } from "@/app/lib/payments/payment-config-repository";

export async function POST(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const edicaoId = normalizeEditionId(body.edicaoId);
    if (
      body.perfilUtilizador !== undefined &&
      body.perfilUtilizador !== "ORGANIZADOR" &&
      body.perfilUtilizador !== "CONGRESSISTA"
    ) {
      return Response.json(
        {
          error: "invalid_user_profile",
          message: "O perfil deve ser CONGRESSISTA ou ORGANIZADOR.",
        },
        { status: 400 },
      );
    }
    const perfilUtilizador =
      body.perfilUtilizador === "ORGANIZADOR" ||
      body.isOrganizer === "true" ||
      body.isOrganizer === true
        ? "ORGANIZADOR"
        : "CONGRESSISTA";
    const quantidade = parseDiscountQuantity(body.quantidade ?? 1);
    if (!edicaoId) {
      return Response.json(
        {
          error: "edition_required",
          message: "Informe explicitamente a edição ativa para gerar o código.",
        },
        { status: 409 },
      );
    }

    if (quantidade === null) {
      return Response.json(
        {
          error: "invalid_quantity",
          message: "A quantidade deve ser um número inteiro entre 1 e 500.",
        },
        { status: 400 },
      );
    }

    const percentualDesconto = perfilUtilizador === "CONGRESSISTA"
      ? parseDiscountPercentage(body.percentualDesconto)
      : undefined;
    if (perfilUtilizador === "CONGRESSISTA" && percentualDesconto === null) {
      return Response.json(
        {
          error: "invalid_discount_percentage",
          message: "O desconto deve ser um percentual inteiro entre 1% e 99%.",
        },
        { status: 400 },
      );
    }

    const { client, db } = await connectToDatabase();
    let codes = [] as Awaited<ReturnType<typeof createUniqueDiscountCodeDocuments>>;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const session = client.startSession();
      try {
        const created = await session.withTransaction(async () => {
          const activeConfig = await getActivePaymentConfig(db, session);
          const activeEditionId = normalizeEditionId(activeConfig?.edicaoId);
          if (!activeEditionId || activeEditionId !== edicaoId) {
            throw Object.assign(new Error("inactive_edition"), { activeEditionId });
          }
          if (
            perfilUtilizador === "ORGANIZADOR" &&
            (!Number.isInteger(activeConfig?.configuracaoOrganizador?.valorFinalCentavos) ||
              Number(activeConfig?.configuracaoOrganizador?.valorFinalCentavos) <= 0)
          ) {
            throw new Error("organizer_price_not_configured");
          }
          return createUniqueDiscountCodeDocuments(
            db,
            {
              edicaoId,
              quantidade,
              ...(typeof percentualDesconto === "number" ? { percentualDesconto } : {}),
              perfilUtilizador,
              createdBy: authorization.identity.userId,
            },
            session,
          );
        });
        codes = created ?? [];
        break;
      } catch (error) {
        if (error instanceof Error && error.message === "inactive_edition") {
          return Response.json(
            {
              error: "inactive_edition",
              message: "Códigos só podem ser criados para a edição ativa configurada.",
              activeEditionId: (error as Error & { activeEditionId?: string }).activeEditionId,
            },
            { status: 409 },
          );
        }
        if (error instanceof Error && error.message === "organizer_price_not_configured") {
          return Response.json(
            {
              error: "organizer_price_not_configured",
              message: "Configure o preço de organizador antes de gerar esses códigos.",
            },
            { status: 409 },
          );
        }
        if ((error as { code?: number })?.code === 11000 && attempt < 2) continue;
        throw error;
      } finally {
        await session.endSession();
      }
    }
    if (codes.length !== quantidade) throw new Error("O lote não foi criado por completo.");

    const serializedCodes = codes.map((code) => ({
      id: code._id?.toHexString(),
      edicaoId: code.edicaoId,
      codigo: code.codigo,
      codigoNormalizado: code.codigoNormalizado,
      tipo: code.tipo,
      percentualDesconto: code.percentualDesconto,
      perfilUtilizador: code.perfilUtilizador,
      status: code.status,
      createdAt: code.createdAt.toISOString(),
    }));
    return Response.json(
      {
        message: quantidade === 1
          ? "Código de desconto gerado com sucesso."
          : `${quantidade} códigos de desconto gerados com sucesso.`,
        total: serializedCodes.length,
        codes: serializedCodes,
        ...(quantidade === 1 ? { code: serializedCodes[0] } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro ao gerar código de desconto:", error);
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível gerar o código." },
      { status: 500 },
    );
  }
}
