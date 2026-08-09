export interface AdminRefundItem {
  value: number;
  valueCentavos: number;
  status: string;
  dateCreated: string | null;
  transactionReceiptUrl: string | null;
}

export interface AdminRefundsSnapshot {
  items: AdminRefundItem[];
  totalDone: number;
  totalDoneCentavos: number;
  capturedAt: string | null;
}

export interface AdminWebhookIssue {
  eventId: string;
  eventType: string;
  paymentId: string | null;
  installmentId: string | null;
  status: "FAILED" | "REVIEW_REQUIRED";
  attempts: number;
  reason: string;
  receivedAt: string | null;
  updatedAt: string | null;
  nextAttemptAt: string | null;
}

export interface AdminInstallmentObservedPayment {
  paymentId: string;
  invoiceNumber: string | null;
  installmentNumber: number | null;
  status: string;
  value: number;
  valueCentavos: number;
  lastEvent: string;
  lastEventId: string | null;
  observedAt: string | null;
}

export interface AdminInstallmentRefund {
  paymentId: string;
  refundsSnapshot: AdminRefundsSnapshot;
}

export interface AdminInstallmentPlan {
  installmentId: string;
  count: number;
  totalValueCentavos: number;
  installmentValueCentavos: number;
  observedPayments: AdminInstallmentObservedPayment[];
  refundsByPayment: AdminInstallmentRefund[];
  refundTotalDoneCentavos: number;
}

export interface AdminModernPayment {
  compraId: string;
  edicaoId: string | null;
  attributionStatus: string | null;
  sessionStatus: string | null;
  missingAssignment: boolean;
  missingSession: boolean;
  gatewayState: string | null;
  method: string | null;
  paymentId: string | null;
  checkoutId: string | null;
  invoiceNumber: string | null;
  amountCentavos: {
    original: number | null;
    desconto: number | null;
    final: number | null;
    refundDone: number;
    net: number | null;
  };
  installmentPlan: AdminInstallmentPlan | null;
  refundStatus: string | null;
  refundsSnapshot: AdminRefundsSnapshot | null;
  chargebackStatus: string | null;
  chargebackResolution: string | null;
  financialReviewEvent: string | null;
  cashReceiptStatus: string | null;
  paymentFailureStatus: string | null;
  restorationStatus: string | null;
  pixSettlementStatus: string | null;
  financialRisk: boolean;
  reconciliationReason: string | null;
  reviewRequiredAt: string | null;
  createdAt: string | null;
  confirmedAt: string | null;
  terminalAt: string | null;
  updatedAt: string | null;
  webhookIssues: AdminWebhookIssue[];
}

export interface AdminPaymentLedgerBacklog {
  counts: {
    pending: number;
    processing: number;
    failed: number;
    reviewRequired: number;
  };
  oldestOutstandingAt: string | null;
  oldestOutstandingAgeSeconds: number | null;
  worker: {
    locked: boolean;
    leaseUntil: string | null;
    leaseExpired: boolean;
    blockedByFailedEvent: boolean;
    updatedAt: string | null;
  };
}

export interface AdminUserPaymentsResponse {
  payments: AdminModernPayment[];
  issueCounts: {
    reviewRequired: number;
    failed: number;
  };
}
