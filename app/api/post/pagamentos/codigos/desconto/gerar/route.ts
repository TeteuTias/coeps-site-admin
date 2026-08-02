import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  createUniqueCodeDocument,
  getActiveEditionId,
  normalizeEditionId,
  parseDiscountPercentage,
} from "@/app/lib/payments/payment-code-repository";

export async function POST(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const edicaoId = normalizeEditionId(body.edicaoId);
    if (!edicaoId) {
      return Response.json(
        {
          error: "edition_required",
          message: "Informe explicitamente a edição ativa para gerar o código.",
        },
        { status: 409 },
      );
    }

    const percentualDesconto = parseDiscountPercentage(body.percentualDesconto);
    if (percentualDesconto === null) {
      return Response.json(
        {
          error: "invalid_discount_percentage",
          message: "O desconto deve ser um percentual inteiro entre 1% e 99%.",
        },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const activeEditionId = await getActiveEditionId(db);
    if (!activeEditionId || activeEditionId !== edicaoId) {
      return Response.json(
        {
          error: "inactive_edition",
          message: "Códigos só podem ser criados para a edição ativa configurada.",
          activeEditionId,
        },
        { status: 409 },
      );
    }

    const code = await createUniqueCodeDocument(db, {
      edicaoId,
      tipo: "DESCONTO",
      percentualDesconto,
      createdBy: authorization.identity.userId,
    });

    return Response.json(
      {
        message: "Código de desconto gerado com sucesso.",
        code: {
          id: code._id?.toHexString(),
          edicaoId: code.edicaoId,
          codigo: code.codigo,
          codigoNormalizado: code.codigoNormalizado,
          tipo: code.tipo,
          percentualDesconto: code.percentualDesconto,
          status: code.status,
          createdAt: code.createdAt.toISOString(),
        },
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
