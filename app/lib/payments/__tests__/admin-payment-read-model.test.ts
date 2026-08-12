import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAdminUserPaymentsResponse,
  buildLedgerBacklogSummary,
  FINANCIAL_RISK_TEXT_FIELDS,
  isFinanciallyAtRisk,
  PAYMENT_FINANCIAL_RISK_EXPRESSION,
} from "../admin-payment-read-model.ts";
import { isFinanceAdminSubject } from "../finance-admin-policy.ts";
import { getActiveEditionId } from "../payment-code-repository.ts";
import { getPaymentStatusTone } from "../payment-status-appearance.ts";

test("autoriza somente o administrador financeiro configurado", () => {
  assert.equal(isFinanceAdminSubject("auth0|admin-1", "admin-1,admin-2"), true);
  assert.equal(isFinanceAdminSubject("admin-2", "admin-1,admin-2"), true);
  assert.equal(isFinanceAdminSubject("auth0|outsider", "admin-1,admin-2"), false);
  assert.equal(isFinanceAdminSubject(undefined, "admin-1"), false);
});

test("classifica estados financeiros sem confundir recebimento desfeito com sucesso", () => {
  assert.equal(getPaymentStatusTone("PAYMENT_RECEIVED"), "success");
  assert.equal(getPaymentStatusTone("PAYMENT_CONFIRMED"), "success");
  assert.equal(getPaymentStatusTone("PAYMENT_RECEIVED_IN_CASH_UNDONE"), "danger");
  assert.equal(getPaymentStatusTone("PAYMENT_REFUNDED"), "danger");
  assert.equal(getPaymentStatusTone("PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"), "danger");
  assert.equal(getPaymentStatusTone("PAYMENT_PARTIALLY_REFUNDED"), "warning");
  assert.equal(getPaymentStatusTone("PAYMENT_REFUND_DENIED"), "warning");
  assert.equal(getPaymentStatusTone("PAYMENT_CHARGEBACK_DISPUTE"), "warning");
  assert.equal(getPaymentStatusTone(undefined), "neutral");
});

test("edicao configurada tem precedencia e falha fechada no admin", async () => {
  const previousEdition = process.env.PAYMENT_EDITION_ID;
  const filters: unknown[] = [];
  const fakeDb = {
    collection: () => ({
      findOne: async (filter: unknown) => {
        filters.push(filter);
        return null;
      },
    }),
  };
  process.env.PAYMENT_EDITION_ID = "CIEPS-2026";
  try {
    assert.equal(await getActiveEditionId(fakeDb as never), null);
    assert.deepEqual(filters, [{ ativo: true, edicaoId: "CIEPS-2026" }]);
  } finally {
    if (previousEdition === undefined) delete process.env.PAYMENT_EDITION_ID;
    else process.env.PAYMENT_EDITION_ID = previousEdition;
  }
});

test("o predicado único cobre todos os estados de risco exigidos", () => {
  for (const refundStatus of ["PARTIAL", "PARTIAL_PLAN", "IN_PROGRESS", "DENIED"]) {
    assert.equal(isFinanciallyAtRisk({ refundStatus }), true, refundStatus);
  }
  for (const field of FINANCIAL_RISK_TEXT_FIELDS) {
    assert.equal(isFinanciallyAtRisk({ [field]: "REVIEW_VALUE" }), true, field);
  }
  assert.equal(isFinanciallyAtRisk({ reviewRequiredAt: new Date() }), true);
  assert.equal(isFinanciallyAtRisk({ refundStatus: "FULL" }), false);
  const serializedExpression = JSON.stringify(PAYMENT_FINANCIAL_RISK_EXPRESSION);
  assert.match(serializedExpression, /PARTIAL_PLAN/);
  assert.match(serializedExpression, /DENIED/);
  assert.match(serializedExpression, /financialReviewEvent/);
  assert.match(serializedExpression, /cashReceiptStatus/);
  assert.match(serializedExpression, /paymentFailureStatus/);
});

test("une atribuições e sessões órfãs e correlaciona purchase, payment e installment", () => {
  const response = buildAdminUserPaymentsResponse(
    [{
      compraId: "purchase-assignment-only",
      edicaoId: "CIEPS-2026",
      status: "CONFIRMADA",
      pagamento: { paymentId: "pay_assignment", metodo: "CREDIT_CARD" },
      valorSelecionadoCentavos: { final: 500 },
      createdAt: new Date("2026-08-08T10:00:00.000Z"),
    }],
    [{
      _id: "purchase-session-only",
      owner: "user-1",
      edicaoId: "CIEPS-2026",
      status: "PAYMENT_REVIEW_REQUIRED",
      paymentId: "pay_session",
      installmentPlan: {
        installmentId: "inst_1",
        count: 2,
        totalValueCentavos: 1000,
        installmentValueCentavos: 500,
        observedPayments: [{
          paymentId: "pay_installment_1",
          invoiceNumber: "invoice_1",
          installmentNumber: 1,
          status: "CONFIRMED",
          value: 5,
          valueCentavos: 500,
          lastEvent: "PAYMENT_CONFIRMED",
          lastEventId: "evt_installment",
          observedAt: new Date("2026-08-08T11:00:00.000Z"),
        }],
      },
      createdAt: new Date("2026-08-08T11:00:00.000Z"),
    }],
    [
      {
        eventId: "evt_purchase",
        eventType: "PAYMENT_REFUND_DENIED",
        purchaseId: "purchase-assignment-only",
        paymentId: "pay_assignment",
        status: "REVIEW_REQUIRED",
        attempts: 1,
        reviewReason: "PAYMENT_REFUND_DENIED",
        payload: { customer: { cpf: "must-not-leak" } },
      },
      {
        eventId: "evt_installment",
        eventType: "PAYMENT_CONFIRMED",
        installmentId: "inst_1",
        paymentId: "unknown_payment",
        status: "FAILED",
        attempts: 2,
        lastError: "INTERNAL_FAILURE",
      },
      {
        eventId: "evt_observed_payment",
        eventType: "PAYMENT_CONFIRMED",
        paymentId: "pay_installment_1",
        status: "REVIEW_REQUIRED",
        attempts: 1,
        reviewReason: "PAYMENT_INSTALLMENT_MISMATCH",
      },
    ],
  );

  assert.equal(response.payments.length, 2);
  const assignmentOnly = response.payments.find(
    (payment) => payment.compraId === "purchase-assignment-only",
  );
  const sessionOnly = response.payments.find(
    (payment) => payment.compraId === "purchase-session-only",
  );
  assert.equal(assignmentOnly?.missingSession, true);
  assert.equal(assignmentOnly?.missingAssignment, false);
  assert.equal(assignmentOnly?.webhookIssues[0]?.eventId, "evt_purchase");
  assert.equal(sessionOnly?.missingAssignment, true);
  assert.equal(sessionOnly?.missingSession, false);
  assert.deepEqual(
    sessionOnly?.webhookIssues.map((issue) => issue.eventId).sort(),
    ["evt_installment", "evt_observed_payment"],
  );
  const serialized = JSON.stringify(response);
  assert.doesNotMatch(serialized, /payload/);
  assert.doesNotMatch(serialized, /must-not-leak/);
});

test("preserva parcelamento sanitizado e calcula refund acumulado sem zerar a venda", () => {
  const response = buildAdminUserPaymentsResponse(
    [{
      compraId: "purchase-plan",
      status: "CONFIRMADA",
      refundStatus: "PARTIAL_PLAN",
      refundsSnapshot: {
        items: [],
        totalDone: 0.5,
        totalDoneCentavos: 50,
        capturedAt: new Date(),
      },
      installmentPlan: {
        installmentId: "inst_plan",
        count: 2,
        totalValueCentavos: 10000,
        installmentValueCentavos: 5000,
        observedPayments: [],
        refundsByPayment: [{
          paymentId: "pay_1",
          refundsSnapshot: {
            items: [{
              value: 1,
              valueCentavos: 100,
              status: "DONE",
              dateCreated: "2026-08-08",
              transactionReceiptUrl: "https://www.asaas.com/comprovantes/123",
            }],
            totalDone: 1,
            totalDoneCentavos: 100,
            capturedAt: new Date(),
          },
        }],
        refundTotalDoneCentavos: 100,
      },
      createdAt: new Date(),
    }],
    [{ _id: "purchase-plan", status: "CONFIRMED", createdAt: new Date() }],
    [],
  );
  const payment = response.payments[0];
  assert.equal(payment.installmentPlan?.refundTotalDoneCentavos, 100);
  assert.equal(payment.amountCentavos.final, 10000);
  assert.equal(payment.amountCentavos.refundDone, 100);
  assert.equal(payment.amountCentavos.net, 9900);
  assert.equal(payment.financialRisk, true);
});

test("resume backlog, idade mais antiga e lease do worker", () => {
  const now = new Date("2026-08-08T12:00:00.000Z");
  const summary = buildLedgerBacklogSummary(
    [
      { _id: "PENDING", count: 4, oldestReceivedAt: new Date("2026-08-08T11:00:00.000Z") },
      { _id: "PROCESSING", count: 2, oldestReceivedAt: new Date("2026-08-08T11:30:00.000Z") },
      { _id: "FAILED", count: 1, oldestReceivedAt: new Date("2026-08-08T10:00:00.000Z") },
      { _id: "REVIEW_REQUIRED", count: 3, oldestReceivedAt: new Date("2026-08-08T09:00:00.000Z") },
    ],
    {
      owner: "worker-1",
      leaseUntil: new Date("2026-08-08T12:05:00.000Z"),
      blockedByFailedEvent: true,
      updatedAt: new Date("2026-08-08T11:59:00.000Z"),
    },
    now,
  );
  assert.deepEqual(summary.counts, {
    pending: 4,
    processing: 2,
    failed: 1,
    reviewRequired: 3,
  });
  assert.equal(summary.oldestOutstandingAgeSeconds, 10800);
  assert.equal(summary.worker.locked, true);
  assert.equal(summary.worker.blockedByFailedEvent, true);
  assert.equal(summary.worker.leaseExpired, false);
});

test("painel global trata atribuicao e sessao orfas como revisao financeira", async () => {
  const routeSource = await readFile(
    new URL("../../../api/get/pagamentos/codigos/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(routeSource, /from:\s*"pagamentos\.sessoes"/);
  assert.match(routeSource, /linkedSessionCount/);
  assert.match(routeSource, /atribuicoesSemSessao/);
  assert.match(routeSource, /sessoesSemAtribuicao/);
  assert.match(routeSource, /compraId:\s*\{\s*\$in:\s*sessionIds\s*\}/);
});
