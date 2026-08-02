import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import { normalizeEditionId } from "@/app/lib/payments/payment-code-repository";

function validNonNegativeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function PUT(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body._id === "string" ? body._id : "";
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const explicitEdition = body.edicaoId !== undefined;
    const edicaoId = explicitEdition ? normalizeEditionId(body.edicaoId) : null;

    if (!ObjectId.isValid(id)) {
      return Response.json(
        { error: "invalid_config_id", message: "O identificador da configuração é inválido." },
        { status: 400 },
      );
    }
    if (!nome) {
      return Response.json(
        { error: "invalid_name", message: "O nome do lote é obrigatório." },
        { status: 400 },
      );
    }
    if (explicitEdition && !edicaoId) {
      return Response.json(
        { error: "invalid_edition", message: "O identificador da edição é inválido." },
        { status: 400 },
      );
    }

    const amounts = {
      valorAVista: validNonNegativeAmount(body.valorAVista),
      valorBoleto: validNonNegativeAmount(body.valorBoleto),
      valorDebito: validNonNegativeAmount(body.valorDebito),
      valorPix: validNonNegativeAmount(body.valorPix),
    };
    if (Object.values(amounts).some((value) => value === null)) {
      return Response.json(
        {
          error: "invalid_amount",
          message: "Todos os valores devem ser números maiores ou iguais a zero.",
        },
        { status: 400 },
      );
    }

    const { client, db } = await connectToDatabase();
    const objectId = new ObjectId(id);
    const currentConfig = await db.collection("ingressos_config").findOne(
      { _id: objectId },
      { projection: { edicaoId: 1, pagantesLegados: 1, ativo: 1 } },
    );
    if (!currentConfig) {
      return Response.json(
        { error: "config_not_found", message: "Configuração financeira não encontrada." },
        { status: 404 },
      );
    }

    const editionChanged = Boolean(
      explicitEdition &&
        edicaoId &&
        currentConfig.edicaoId &&
        currentConfig.edicaoId !== edicaoId,
    );
    const updatedAt = new Date();
    const updateFields: Record<string, unknown> = {
      nome,
      ...amounts,
      updatedAt,
      updatedBy: authorization.identity.userId,
    };

    if (explicitEdition && edicaoId) {
      updateFields.edicaoId = edicaoId;
      updateFields.ativo = true;

      // Uma nova edição começa sem carregar o snapshot legado da anterior.
      // Salvar novamente a mesma edição preserva o valor já migrado.
      if (editionChanged) updateFields.pagantesLegados = 0;
    }

    if (explicitEdition && edicaoId) {
      const session = client.startSession();

      try {
        await session.withTransaction(async () => {
          await db.collection("ingressos_config").updateMany(
            { _id: { $ne: objectId }, ativo: true },
            {
              $set: {
                ativo: false,
                updatedAt,
                updatedBy: authorization.identity.userId,
              },
            },
            { session },
          );

          await db.collection("ingressos_config").updateOne(
            { _id: objectId },
            { $set: updateFields },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
    } else {
      await db.collection("ingressos_config").updateOne(
        { _id: objectId },
        { $set: updateFields },
      );
    }

    return Response.json({
      message: editionChanged
        ? "Configuração salva e nova edição iniciada com zero pagantes legados."
        : "Configuração financeira salva com sucesso.",
      data: {
        _id: id,
        nome,
        ...amounts,
        edicaoId: explicitEdition ? edicaoId : currentConfig.edicaoId,
        ativo: explicitEdition ? true : currentConfig.ativo,
        pagantesLegados: editionChanged ? 0 : currentConfig.pagantesLegados,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar configuração financeira:", error);
    return Response.json(
      { error: "invalid_request", message: "Não foi possível validar os dados enviados." },
      { status: 400 },
    );
  }
}
