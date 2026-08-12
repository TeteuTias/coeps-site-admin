export type PaymentStatusTone = "success" | "danger" | "warning" | "neutral";

const SUCCESS_STATUSES = new Set([
  "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "CONFIRMED",
  "RECEIVED",
]);

const DANGER_STATUSES = new Set([
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  "PAYMENT_DELETED",
  "PAYMENT_OVERDUE",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  "PAYMENT_REFUNDED",
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
  "OVERDUE",
  "REFUNDED",
]);

const WARNING_STATUSES = new Set([
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_AWAITING_RISK_ANALYSIS",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUND_DENIED",
  "PAYMENT_REFUND_IN_PROGRESS",
  "PENDING",
]);

export function getPaymentStatusTone(status?: string): PaymentStatusTone {
  const normalized = status?.trim().toUpperCase();
  if (!normalized) return "neutral";
  if (DANGER_STATUSES.has(normalized)) return "danger";
  if (WARNING_STATUSES.has(normalized)) return "warning";
  if (SUCCESS_STATUSES.has(normalized)) return "success";
  return "neutral";
}
