import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import { connectToDatabase } from '@/app/lib/mongodb';
import { withApiAuthRequired } from "@/app/lib/auth0";

function validNonNegativeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

//
//
export const PUT = withApiAuthRequired(async function PUT(req: Request) {
    // 1. Validar o método da requisição (opcional, mas boa prática)
    if (req.method !== 'PUT') {
        return Response.json({ error: 'Método não permitido' }, { status: 405 });
    }

    try {
        // 2. Extrair os dados do corpo da requisição
        const body = await req.json();
        const { nome, valorAVista, _id, valorBoleto, valorDebito, valorPix } = body as {
            nome: string;
            _id: string;
            valorAVista: number;
            valorBoleto: number;
            valorDebito: number;
            valorPix: number;
        }
        // 3. Autenticar e validar os dados recebidos

        if (!ObjectId.isValid(_id)) {
            return Response.json({ error: '_id não válido.' }, { status: 400 });
        }

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

    } catch {
        // Captura erros de parsing do JSON ou outros erros inesperados
        return Response.json(
            { error: "invalid_request", message: "Não foi possível validar os dados enviados." },
            { status: 400 }
        );
    }
})
