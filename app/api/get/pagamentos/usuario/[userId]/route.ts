import { connectToDatabase } from "@/app/lib/mongodb";
import {
  buildAdminUserPaymentsResponse,
  stringOrNull,
} from "@/app/lib/payments/admin-payment-read-model";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import { ObjectId, type Db, type Document } from "mongodb";

export const dynamic = "force-dynamic";

const ASSIGNMENTS_COLLECTION = "pagamentos.atribuicoes";
const SESSIONS_COLLECTION = "pagamentos.sessoes";
const WEBHOOK_EVENTS_COLLECTION = "pagamentos.webhook_eventos_v2";
const VISIBLE_LEDGER_STATUSES = ["FAILED", "REVIEW_REQUIRED"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function collectCorrelationKeys(assignments: Document[], sessions: Document[]) {
  const purchaseValues = new Map<string, unknown>();
  const paymentIds = new Set<string>();
  const installmentIds = new Set<string>();

  for (const assignment of assignments) {
    const purchaseId = stringOrNull(assignment.compraId);
    if (purchaseId) purchaseValues.set(purchaseId, assignment.compraId);
    const payment = asRecord(assignment.pagamento);
    const paymentId = stringOrNull(payment?.paymentId);
    if (paymentId) paymentIds.add(paymentId);
    const plan = asRecord(assignment.installmentPlan);
    const installmentId = stringOrNull(plan?.installmentId);
    if (installmentId) installmentIds.add(installmentId);
    if (Array.isArray(plan?.observedPayments)) {
      for (const rawObserved of plan.observedPayments) {
        const observed = asRecord(rawObserved);
        const observedPaymentId = stringOrNull(observed?.paymentId);
        if (observedPaymentId) paymentIds.add(observedPaymentId);
      }
    }
  }

  for (const session of sessions) {
    const purchaseId = stringOrNull(session._id);
    if (purchaseId) purchaseValues.set(purchaseId, session._id);
    const paymentId = stringOrNull(session.paymentId);
    if (paymentId) paymentIds.add(paymentId);
    const plan = asRecord(session.installmentPlan);
    const installmentId = stringOrNull(plan?.installmentId);
    if (installmentId) installmentIds.add(installmentId);
    if (Array.isArray(plan?.observedPayments)) {
      for (const rawObserved of plan.observedPayments) {
        const observed = asRecord(rawObserved);
        const observedPaymentId = stringOrNull(observed?.paymentId);
        if (observedPaymentId) paymentIds.add(observedPaymentId);
      }
    }
  }

  return { purchaseValues, paymentIds, installmentIds };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return Response.json(
      { error: "invalid_user_id", message: "O identificador do usuário é inválido." },
      { status: 400 },
    );
  }

  try {
    const { db: untypedDb } = await connectToDatabase();
    const db = untypedDb as Db;
    const owner = new ObjectId(userId);
    const sharedProjection = {
      edicaoId: 1,
      status: 1,
      gatewayState: 1,
      metodoPagamento: 1,
      paymentId: 1,
      orderId: 1,
      invoiceNumber: 1,
      pagamento: 1,
      valoresCentavos: 1,
      valorSelecionadoCentavos: 1,
      installmentPlan: 1,
      refundStatus: 1,
      refundsSnapshot: 1,
      chargebackStatus: 1,
      chargebackResolution: 1,
      financialReviewEvent: 1,
      reconciliationReason: 1,
      reviewRequiredAt: 1,
      cashReceiptStatus: 1,
      paymentFailureStatus: 1,
      restorationStatus: 1,
      pixSettlementStatus: 1,
      createdAt: 1,
      confirmedAt: 1,
      terminalAt: 1,
      updatedAt: 1,
    };

    const [assignments, sessions] = await Promise.all([
      db.collection(ASSIGNMENTS_COLLECTION)
        .find(
          { usuarioId: owner },
          { projection: { ...sharedProjection, compraId: 1 } },
        )
        .sort({ createdAt: -1 })
        .toArray(),
      db.collection(SESSIONS_COLLECTION)
        .find(
          { owner },
          { projection: sharedProjection },
        )
        .sort({ createdAt: -1 })
        .toArray(),
    ]);

    const { purchaseValues, paymentIds, installmentIds } = collectCorrelationKeys(
      assignments,
      sessions,
    );
    const correlationFilters: Document[] = [];
    if (purchaseValues.size) {
      correlationFilters.push({ purchaseId: { $in: [...purchaseValues.values()] } });
    }
    if (paymentIds.size) correlationFilters.push({ paymentId: { $in: [...paymentIds] } });
    if (installmentIds.size) {
      correlationFilters.push({ installmentId: { $in: [...installmentIds] } });
    }

    const ledgerEvents = correlationFilters.length
      ? await db.collection(WEBHOOK_EVENTS_COLLECTION)
          .find(
            {
              status: { $in: [...VISIBLE_LEDGER_STATUSES] },
              $or: correlationFilters,
            },
            {
              projection: {
                eventId: 1,
                eventType: 1,
                paymentId: 1,
                purchaseId: 1,
                installmentId: 1,
                status: 1,
                attempts: 1,
                receivedAt: 1,
                updatedAt: 1,
                nextAttemptAt: 1,
                lastError: 1,
                reviewReason: 1,
              },
            },
          )
          .sort({ receivedAt: -1 })
          .limit(200)
          .toArray()
      : [];

    return Response.json(
      buildAdminUserPaymentsResponse(assignments, sessions, ledgerEvents),
    );
  } catch (error) {
    console.error("Erro ao consultar pagamentos modernos do usuário:", error);
    return Response.json(
      {
        error: "internal_server_error",
        message: "Não foi possível consultar os pagamentos modernos do usuário.",
      },
      { status: 500 },
    );
  }
}
