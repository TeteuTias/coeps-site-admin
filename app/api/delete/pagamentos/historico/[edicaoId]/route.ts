import { connectToDatabase } from "@/app/lib/mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import { evaluateEditionCleanup } from "@/app/lib/payments/payment-history-cleanup";
import {
  PAYMENT_ATTRIBUTIONS_COLLECTION,
  PAYMENT_AUDIT_COLLECTION,
  PAYMENT_CODES_COLLECTION,
} from "@/app/lib/payments/payment-code-repository";

class CleanupEligibilityChangedError extends Error {
  constructor(public readonly reason: string | null) {
    super("CLEANUP_ELIGIBILITY_CHANGED");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ edicaoId: string }> },
) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const { edicaoId: rawEdition } = await params;
    if (!rawEdition) {
      return Response.json(
        {
          error: "edition_required",
          message: "Informe explicitamente a edição que deseja apagar.",
        },
        { status: 409 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { client, db } = await connectToDatabase();
    const evaluation = await evaluateEditionCleanup(db, rawEdition);

    if (!evaluation) {
      return Response.json(
        { error: "invalid_edition", message: "O identificador da edição é inválido." },
        { status: 400 },
      );
    }

    if (!evaluation.eligible) {
      return Response.json(
        {
          error: "edition_not_eligible",
          message: evaluation.reason,
          preview: evaluation,
        },
        { status: 409 },
      );
    }

    if (body.confirmation !== evaluation.expectedConfirmation) {
      return Response.json(
        {
          error: "invalid_confirmation",
          message: `Digite exatamente: ${evaluation.expectedConfirmation}`,
        },
        { status: 400 },
      );
    }

    const session = client.startSession();
    let deletedCodes = 0;
    let deletedAttributions = 0;

    try {
      await session.withTransaction(async () => {
        const currentEvaluation = await evaluateEditionCleanup(db, rawEdition, session);
        if (!currentEvaluation?.eligible) {
          throw new CleanupEligibilityChangedError(
            currentEvaluation?.reason ?? "A edição deixou de ser elegível para limpeza.",
          );
        }

        // Cria conflito de escrita caso outra transação tente ativar esta ou outra
        // configuração enquanto a limpeza está em andamento.
        await db.collection("ingressos_config").updateMany(
          {
            $or: [{ edicaoId: currentEvaluation.edicaoId }, { ativo: true }],
          },
          { $set: { paymentHistoryCleanupCheckedAt: new Date() } },
          { session },
        );

        const attributionsResult = await db
          .collection(PAYMENT_ATTRIBUTIONS_COLLECTION)
          .deleteMany({ edicaoId: currentEvaluation.edicaoId }, { session });
        const codesResult = await db
          .collection(PAYMENT_CODES_COLLECTION)
          .deleteMany({ edicaoId: currentEvaluation.edicaoId }, { session });

        deletedAttributions = attributionsResult.deletedCount;
        deletedCodes = codesResult.deletedCount;

        await db.collection(PAYMENT_AUDIT_COLLECTION).insertOne(
          {
            action: "DELETE_PAYMENT_CODE_HISTORY",
            edicaoId: currentEvaluation.edicaoId,
            operatorId: authorization.identity.userId,
            createdAt: new Date(),
            deleted: {
              codigos: deletedCodes,
              atribuicoes: deletedAttributions,
            },
            retentionDays: currentEvaluation.retentionDays,
            latestRelevantDate: currentEvaluation.latestRelevantDate,
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    return Response.json({
      message: "Histórico da edição apagado com sucesso.",
      edicaoId: evaluation.edicaoId,
      deleted: {
        codigos: deletedCodes,
        atribuicoes: deletedAttributions,
        total: deletedCodes + deletedAttributions,
      },
    });
  } catch (error) {
    if (error instanceof CleanupEligibilityChangedError) {
      return Response.json(
        {
          error: "edition_not_eligible",
          message: error.reason,
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "ACTIVE_EDITION_NOT_CONFIGURED") {
      return Response.json(
        {
          error: "active_edition_not_configured",
          message: "Configure PAYMENT_EDITION_ID antes de executar a limpeza anual.",
        },
        { status: 409 },
      );
    }

    console.error("Erro ao apagar histórico de códigos:", error);
    return Response.json(
      {
        error: "internal_server_error",
        message: "A limpeza não foi concluída e nenhuma exclusão parcial foi confirmada.",
      },
      { status: 500 },
    );
  }
}
