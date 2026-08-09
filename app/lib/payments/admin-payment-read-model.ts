import type {
  AdminInstallmentPlan,
  AdminModernPayment,
  AdminPaymentLedgerBacklog,
  AdminRefundsSnapshot,
  AdminUserPaymentsResponse,
  AdminWebhookIssue,
} from "../types/payments/payment-admin.t.ts";

type PaymentRecord = Record<string, unknown>;

export const FINANCIAL_RISK_REFUND_STATUSES = [
  "PARTIAL",
  "PARTIAL_PLAN",
  "IN_PROGRESS",
  "DENIED",
] as const;

export const FINANCIAL_RISK_TEXT_FIELDS = [
  "financialReviewEvent",
  "reconciliationReason",
  "cashReceiptStatus",
  "paymentFailureStatus",
  "restorationStatus",
  "pixSettlementStatus",
  "chargebackStatus",
] as const;

function nonEmptyMongoField(field: string) {
  return {
    $and: [
      { $ne: [{ $ifNull: [`$${field}`, null] }, null] },
      { $ne: [{ $ifNull: [`$${field}`, ""] }, ""] },
    ],
  };
}

// Esta expressão é a única definição de risco usada nas agregações e nos counts.
export const PAYMENT_FINANCIAL_RISK_EXPRESSION = {
  $or: [
    {
      $in: [
        { $ifNull: ["$refundStatus", ""] },
        [...FINANCIAL_RISK_REFUND_STATUSES],
      ],
    },
    ...FINANCIAL_RISK_TEXT_FIELDS.map(nonEmptyMongoField),
    { $ne: [{ $ifNull: ["$reviewRequiredAt", null] }, null] },
  ],
};

export const PAYMENT_RECOGNIZED_SALE_EXPRESSION = {
  $in: ["$status", ["CONFIRMADA", "ESTORNADA"]],
};

export const PAYMENT_GROSS_AMOUNT_EXPRESSION = {
  $max: [
    0,
    {
      $ifNull: [
        "$valorSelecionadoCentavos.final",
        {
          $cond: [
            { $isNumber: "$valoresCentavos.final" },
            "$valoresCentavos.final",
            {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$pagamento.metodo", "PIX"] },
                    then: { $ifNull: ["$valoresCentavos.final.PIX", 0] },
                  },
                  {
                    case: { $eq: ["$pagamento.metodo", "BOLETO"] },
                    then: { $ifNull: ["$valoresCentavos.final.BOLETO", 0] },
                  },
                  {
                    case: { $eq: ["$pagamento.metodo", "DEBIT_CARD"] },
                    then: { $ifNull: ["$valoresCentavos.final.DEBIT_CARD", 0] },
                  },
                  {
                    case: { $eq: ["$pagamento.metodo", "CREDIT_CARD"] },
                    then: { $ifNull: ["$valoresCentavos.final.CREDIT_CARD", 0] },
                  },
                ],
                default: 0,
              },
            },
          ],
        },
      ],
    },
  ],
};

export const PAYMENT_RECORDED_REFUND_EXPRESSION = {
  $max: [
    0,
    {
      $ifNull: [
        "$installmentPlan.refundTotalDoneCentavos",
        { $ifNull: ["$refundsSnapshot.totalDoneCentavos", 0] },
      ],
    },
  ],
};

export const PAYMENT_EFFECTIVE_REFUND_EXPRESSION = {
  $min: [
    PAYMENT_GROSS_AMOUNT_EXPRESSION,
    {
      $cond: [
        {
          $or: [
            { $eq: ["$status", "ESTORNADA"] },
            { $eq: ["$refundStatus", "FULL"] },
          ],
        },
        PAYMENT_GROSS_AMOUNT_EXPRESSION,
        PAYMENT_RECORDED_REFUND_EXPRESSION,
      ],
    },
  ],
};

export const PAYMENT_NET_AMOUNT_EXPRESSION = {
  $max: [
    0,
    {
      $subtract: [
        PAYMENT_GROSS_AMOUNT_EXPRESSION,
        PAYMENT_EFFECTIVE_REFUND_EXPRESSION,
      ],
    },
  ],
};

function asRecord(value: unknown): PaymentRecord | null {
  return value && typeof value === "object" ? (value as PaymentRecord) : null;
}

export function stringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  const record = asRecord(value);
  if (record && typeof record.toHexString === "function") {
    const result = (record.toHexString as () => unknown)();
    return typeof result === "string" && result ? result : null;
  }
  return null;
}

function dateToIso(value: unknown): string | null {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown): number | null {
  const number = numberOrNull(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const number = integerOrNull(value);
  return number !== null && number >= 0 ? number : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const candidate = stringOrNull(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const isAsaasHost = url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com");
    return url.protocol === "https:" && isAsaasHost ? url.toString() : null;
  } catch {
    return null;
  }
}

export function operationalReason(value: unknown, fallback: string): string {
  const candidate = stringOrNull(value);
  if (!candidate) return fallback;
  return /^[A-Z0-9_:-]+(?:,[A-Z0-9_:-]+)*$/.test(candidate) && candidate.length <= 200
    ? candidate
    : fallback;
}

export function sanitizeRefundsSnapshot(value: unknown): AdminRefundsSnapshot | null {
  const snapshot = asRecord(value);
  if (!snapshot) return null;
  const items = Array.isArray(snapshot.items)
    ? snapshot.items.slice(0, 100).flatMap((rawItem) => {
        const item = asRecord(rawItem);
        if (!item) return [];
        const refundValue = numberOrNull(item.value);
        const refundValueCentavos = nonNegativeInteger(item.valueCentavos);
        if (refundValue === null || refundValueCentavos === null) return [];
        return [
          {
            value: refundValue,
            valueCentavos: refundValueCentavos,
            status: operationalReason(item.status, "UNKNOWN"),
            dateCreated: dateToIso(item.dateCreated) ?? stringOrNull(item.dateCreated),
            transactionReceiptUrl: safeHttpsUrl(item.transactionReceiptUrl),
          },
        ];
      })
    : [];

  const totalDone = numberOrNull(snapshot.totalDone) ?? 0;
  const totalDoneCentavos = nonNegativeInteger(snapshot.totalDoneCentavos) ?? 0;
  if (items.length === 0 && totalDone === 0 && totalDoneCentavos === 0) return null;

  return {
    items,
    totalDone,
    totalDoneCentavos,
    capturedAt: dateToIso(snapshot.capturedAt),
  };
}

export function sanitizeInstallmentPlan(value: unknown): AdminInstallmentPlan | null {
  const plan = asRecord(value);
  if (!plan) return null;
  const installmentId = stringOrNull(plan.installmentId);
  const count = nonNegativeInteger(plan.count);
  const totalValueCentavos = nonNegativeInteger(plan.totalValueCentavos);
  const installmentValueCentavos = nonNegativeInteger(plan.installmentValueCentavos);
  if (!installmentId || !count || totalValueCentavos === null || installmentValueCentavos === null) {
    return null;
  }

  const observedPayments = Array.isArray(plan.observedPayments)
    ? plan.observedPayments.slice(0, 100).flatMap((rawPayment) => {
        const payment = asRecord(rawPayment);
        if (!payment) return [];
        const paymentId = stringOrNull(payment.paymentId);
        const value = numberOrNull(payment.value);
        const valueCentavos = nonNegativeInteger(payment.valueCentavos);
        if (!paymentId || value === null || valueCentavos === null) return [];
        return [{
          paymentId,
          invoiceNumber: stringOrNull(payment.invoiceNumber),
          installmentNumber: nonNegativeInteger(payment.installmentNumber),
          status: operationalReason(payment.status, "UNKNOWN"),
          value,
          valueCentavos,
          lastEvent: operationalReason(payment.lastEvent, "UNKNOWN"),
          lastEventId: stringOrNull(payment.lastEventId),
          observedAt: dateToIso(payment.observedAt),
        }];
      })
    : [];

  const refundsByPayment = Array.isArray(plan.refundsByPayment)
    ? plan.refundsByPayment.slice(0, 100).flatMap((rawRefund) => {
        const refund = asRecord(rawRefund);
        if (!refund) return [];
        const paymentId = stringOrNull(refund.paymentId);
        const refundsSnapshot = sanitizeRefundsSnapshot(refund.refundsSnapshot);
        return paymentId && refundsSnapshot ? [{ paymentId, refundsSnapshot }] : [];
      })
    : [];

  return {
    installmentId,
    count,
    totalValueCentavos,
    installmentValueCentavos,
    observedPayments,
    refundsByPayment,
    refundTotalDoneCentavos:
      nonNegativeInteger(plan.refundTotalDoneCentavos) ??
      refundsByPayment.reduce(
        (total, refund) => total + refund.refundsSnapshot.totalDoneCentavos,
        0,
      ),
  };
}

function nestedRecord(record: PaymentRecord | undefined, field: string) {
  return record ? asRecord(record[field]) : null;
}

function selectedAmounts(
  assignment: PaymentRecord | undefined,
  session: PaymentRecord | undefined,
  method: string | null,
  installmentPlan: AdminInstallmentPlan | null,
) {
  const selected = nestedRecord(assignment, "valorSelecionadoCentavos");
  if (selected) {
    return {
      original: nonNegativeInteger(selected.original),
      desconto: nonNegativeInteger(selected.desconto),
      final: nonNegativeInteger(selected.final),
    };
  }

  if (installmentPlan) {
    return {
      original: installmentPlan.totalValueCentavos,
      desconto: 0,
      final: installmentPlan.totalValueCentavos,
    };
  }

  const amounts = nestedRecord(assignment, "valoresCentavos") ?? nestedRecord(session, "valoresCentavos");
  const methodKey = method === "BILLING_TYPE_BOLETO" ? "BOLETO" : method;
  if (!amounts || !methodKey) return { original: null, desconto: null, final: null };
  const byMethod = (bucket: unknown) => {
    if (typeof bucket === "number") return nonNegativeInteger(bucket);
    const values = asRecord(bucket);
    return values ? nonNegativeInteger(values[methodKey]) : null;
  };
  return {
    original: byMethod(amounts.original),
    desconto: byMethod(amounts.desconto),
    final: byMethod(amounts.final),
  };
}

function fieldFrom(
  assignment: PaymentRecord | undefined,
  session: PaymentRecord | undefined,
  field: string,
) {
  return assignment?.[field] ?? session?.[field];
}

export function isFinanciallyAtRisk(record: PaymentRecord | undefined): boolean {
  if (!record) return false;
  const refundStatus = stringOrNull(record.refundStatus);
  if (refundStatus && FINANCIAL_RISK_REFUND_STATUSES.includes(
    refundStatus as (typeof FINANCIAL_RISK_REFUND_STATUSES)[number],
  )) return true;
  if (record.reviewRequiredAt !== null && record.reviewRequiredAt !== undefined) return true;
  return FINANCIAL_RISK_TEXT_FIELDS.some((field) => Boolean(stringOrNull(record[field])));
}

function ledgerIssue(event: PaymentRecord): AdminWebhookIssue {
  const status = event.status === "FAILED" ? "FAILED" : "REVIEW_REQUIRED";
  return {
    eventId: stringOrNull(event.eventId) ?? "unknown_event",
    eventType: stringOrNull(event.eventType) ?? "UNKNOWN",
    paymentId: stringOrNull(event.paymentId),
    installmentId: stringOrNull(event.installmentId),
    status,
    attempts: nonNegativeInteger(event.attempts) ?? 0,
    reason:
      status === "REVIEW_REQUIRED"
        ? operationalReason(event.reviewReason, "REVIEW_REQUIRED")
        : operationalReason(event.lastError, "PROCESSING_ERROR"),
    receivedAt: dateToIso(event.receivedAt),
    updatedAt: dateToIso(event.updatedAt),
    nextAttemptAt: dateToIso(event.nextAttemptAt),
  };
}

function timestamp(value: unknown): number {
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildAdminUserPaymentsResponse(
  rawAssignments: PaymentRecord[],
  rawSessions: PaymentRecord[],
  rawLedgerEvents: PaymentRecord[],
): AdminUserPaymentsResponse {
  const assignmentsByPurchase = new Map<string, PaymentRecord>();
  for (const assignment of rawAssignments) {
    const purchaseId = stringOrNull(assignment.compraId);
    if (purchaseId) assignmentsByPurchase.set(purchaseId, assignment);
  }
  const sessionsByPurchase = new Map<string, PaymentRecord>();
  for (const session of rawSessions) {
    const purchaseId = stringOrNull(session._id);
    if (purchaseId) sessionsByPurchase.set(purchaseId, session);
  }
  const purchaseIds = [...new Set([...assignmentsByPurchase.keys(), ...sessionsByPurchase.keys()])];
  const paymentToPurchase = new Map<string, string>();
  const installmentToPurchase = new Map<string, string>();

  for (const purchaseId of purchaseIds) {
    const assignment = assignmentsByPurchase.get(purchaseId);
    const session = sessionsByPurchase.get(purchaseId);
    const assignmentPayment = nestedRecord(assignment, "pagamento");
    const installmentPlan = sanitizeInstallmentPlan(
      fieldFrom(assignment, session, "installmentPlan"),
    );
    const paymentIds = [
      stringOrNull(assignmentPayment?.paymentId),
      stringOrNull(session?.paymentId),
      ...(installmentPlan?.observedPayments.map((payment) => payment.paymentId) ?? []),
    ].filter((value): value is string => Boolean(value));
    for (const paymentId of paymentIds) paymentToPurchase.set(paymentId, purchaseId);
    if (installmentPlan?.installmentId) {
      installmentToPurchase.set(installmentPlan.installmentId, purchaseId);
    }
  }

  const issuesByPurchase = new Map<string, AdminWebhookIssue[]>();
  for (const event of rawLedgerEvents) {
    if (event.status !== "FAILED" && event.status !== "REVIEW_REQUIRED") continue;
    const ledgerPurchaseId = stringOrNull(event.purchaseId);
    const paymentId = stringOrNull(event.paymentId);
    const installmentId = stringOrNull(event.installmentId);
    const purchaseId =
      (ledgerPurchaseId && purchaseIds.includes(ledgerPurchaseId) ? ledgerPurchaseId : null) ??
      (paymentId ? paymentToPurchase.get(paymentId) ?? null : null) ??
      (installmentId ? installmentToPurchase.get(installmentId) ?? null : null);
    if (!purchaseId) continue;
    const issues = issuesByPurchase.get(purchaseId) ?? [];
    issues.push(ledgerIssue(event));
    issuesByPurchase.set(purchaseId, issues);
  }

  const payments: AdminModernPayment[] = purchaseIds.map((compraId) => {
    const assignment = assignmentsByPurchase.get(compraId);
    const session = sessionsByPurchase.get(compraId);
    const assignmentPayment = nestedRecord(assignment, "pagamento");
    const installmentPlan = sanitizeInstallmentPlan(
      fieldFrom(assignment, session, "installmentPlan"),
    );
    const method =
      stringOrNull(assignmentPayment?.metodo) ?? stringOrNull(session?.metodoPagamento);
    const amounts = selectedAmounts(assignment, session, method, installmentPlan);
    const refundsSnapshot =
      sanitizeRefundsSnapshot(assignment?.refundsSnapshot) ??
      sanitizeRefundsSnapshot(session?.refundsSnapshot);
    const refundDone =
      installmentPlan?.refundTotalDoneCentavos ?? refundsSnapshot?.totalDoneCentavos ?? 0;
    const net = amounts.final === null
      ? null
      : Math.max(amounts.final - Math.min(refundDone, amounts.final), 0);
    return {
      compraId,
      edicaoId: stringOrNull(assignment?.edicaoId) ?? stringOrNull(session?.edicaoId),
      attributionStatus: stringOrNull(assignment?.status),
      sessionStatus: stringOrNull(session?.status),
      missingAssignment: !assignment,
      missingSession: !session,
      gatewayState:
        stringOrNull(assignment?.gatewayState) ?? stringOrNull(session?.gatewayState),
      method,
      paymentId:
        stringOrNull(assignmentPayment?.paymentId) ?? stringOrNull(session?.paymentId),
      checkoutId:
        stringOrNull(assignmentPayment?.checkoutId) ?? stringOrNull(session?.orderId),
      invoiceNumber:
        stringOrNull(assignmentPayment?.invoiceNumber) ?? stringOrNull(session?.invoiceNumber),
      amountCentavos: { ...amounts, refundDone, net },
      installmentPlan,
      refundStatus: stringOrNull(fieldFrom(assignment, session, "refundStatus")),
      refundsSnapshot,
      chargebackStatus: stringOrNull(fieldFrom(assignment, session, "chargebackStatus")),
      chargebackResolution: stringOrNull(fieldFrom(assignment, session, "chargebackResolution")),
      financialReviewEvent: stringOrNull(fieldFrom(assignment, session, "financialReviewEvent")),
      cashReceiptStatus: stringOrNull(fieldFrom(assignment, session, "cashReceiptStatus")),
      paymentFailureStatus: stringOrNull(fieldFrom(assignment, session, "paymentFailureStatus")),
      restorationStatus: stringOrNull(fieldFrom(assignment, session, "restorationStatus")),
      pixSettlementStatus: stringOrNull(fieldFrom(assignment, session, "pixSettlementStatus")),
      financialRisk: isFinanciallyAtRisk(assignment) || isFinanciallyAtRisk(session),
      reconciliationReason: fieldFrom(assignment, session, "reconciliationReason")
        ? operationalReason(fieldFrom(assignment, session, "reconciliationReason"), "REVIEW_REQUIRED")
        : null,
      reviewRequiredAt: dateToIso(fieldFrom(assignment, session, "reviewRequiredAt")),
      createdAt: dateToIso(assignment?.createdAt ?? session?.createdAt),
      confirmedAt: dateToIso(assignment?.confirmedAt ?? session?.confirmedAt),
      terminalAt: dateToIso(session?.terminalAt),
      updatedAt: dateToIso(assignment?.updatedAt ?? session?.updatedAt),
      webhookIssues: issuesByPurchase.get(compraId) ?? [],
    };
  }).sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt));

  const issueCounts = payments.reduce(
    (counts, payment) => {
      for (const issue of payment.webhookIssues) {
        if (issue.status === "FAILED") counts.failed += 1;
        else counts.reviewRequired += 1;
      }
      return counts;
    },
    { reviewRequired: 0, failed: 0 },
  );

  return { payments, issueCounts };
}

export function buildLedgerBacklogSummary(
  statusRows: PaymentRecord[],
  lock: PaymentRecord | null,
  now = new Date(),
): AdminPaymentLedgerBacklog {
  const counts = { pending: 0, processing: 0, failed: 0, reviewRequired: 0 };
  let oldest: Date | null = null;
  for (const row of statusRows) {
    const count = nonNegativeInteger(row.count) ?? 0;
    if (row._id === "PENDING") counts.pending = count;
    else if (row._id === "PROCESSING") counts.processing = count;
    else if (row._id === "FAILED") counts.failed = count;
    else if (row._id === "REVIEW_REQUIRED") counts.reviewRequired = count;
    const rowOldest = dateToIso(row.oldestReceivedAt);
    if (rowOldest) {
      const date = new Date(rowOldest);
      if (!oldest || date < oldest) oldest = date;
    }
  }

  const leaseUntilIso = dateToIso(lock?.leaseUntil);
  const leaseUntil = leaseUntilIso ? new Date(leaseUntilIso) : null;
  const hasOwner = Boolean(stringOrNull(lock?.owner));
  const locked = Boolean(hasOwner && leaseUntil && leaseUntil > now);
  return {
    counts,
    oldestOutstandingAt: oldest?.toISOString() ?? null,
    oldestOutstandingAgeSeconds: oldest
      ? Math.max(Math.floor((now.getTime() - oldest.getTime()) / 1000), 0)
      : null,
    worker: {
      locked,
      leaseUntil: leaseUntilIso,
      leaseExpired: Boolean(leaseUntil && leaseUntil <= now),
      blockedByFailedEvent: lock?.blockedByFailedEvent === true,
      updatedAt: dateToIso(lock?.updatedAt),
    },
  };
}
