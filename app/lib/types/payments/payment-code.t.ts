import type { ObjectId } from "mongodb";

export const PAYMENT_CODE_TYPES = ["DESCONTO", "RASTREIO"] as const;
export const PAYMENT_CODE_STATUSES = ["ATIVO", "RESERVADO", "INATIVO", "USADO"] as const;
export const PAYMENT_ATTRIBUTION_STATUSES = [
  "ABERTA",
  "PAGAMENTO_PENDENTE",
  "CONFIRMADA",
  "CANCELADA",
  "EXPIRADA",
  "ESTORNADA",
] as const;

export type PaymentCodeType = (typeof PAYMENT_CODE_TYPES)[number];
export type PaymentCodeStatus = (typeof PAYMENT_CODE_STATUSES)[number];
export type PaymentAttributionStatus =
  (typeof PAYMENT_ATTRIBUTION_STATUSES)[number];

export interface PaymentCodeResponsible {
  nome: string;
  email?: string;
}

export interface PaymentCodeReservation {
  compraId: string | ObjectId;
  usuarioId: string | ObjectId;
  reservadoEm: Date;
  reservadoAte: Date | null;
  cobrancaExternaCriada: boolean;
}

export interface PaymentCodeDocument {
  _id?: ObjectId;
  edicaoId: string;
  codigoNormalizado: string;
  codigo: string;
  tipo: PaymentCodeType;
  percentualDesconto?: number;
  responsavel?: PaymentCodeResponsible;
  status: PaymentCodeStatus;
  reserva?: PaymentCodeReservation;
  usedAt?: Date;
  usedPurchaseId?: ObjectId | string;
  perfilUtilizador: "ORGANIZADOR" | "CONGRESSISTA";
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface PaymentCodeSnapshot {
  codigoId?: ObjectId | string;
  codigo: string;
  codigoNormalizado: string;
  tipo?: PaymentCodeType;
  percentualDesconto?: number;
  responsavel?: PaymentCodeResponsible;
}

export interface SelectedPaymentAmountsInCents {
  original: number;
  desconto: number;
  final: number;
}

export interface PaymentAmountsByMethod {
  PIX: number;
  BOLETO: number;
  DEBIT_CARD: number;
  CREDIT_CARD: number;
}

export interface PaymentAmountsInCents {
  original: PaymentAmountsByMethod;
  desconto: PaymentAmountsByMethod;
  final: PaymentAmountsByMethod;
}

export interface PaymentAttributionDocument {
  _id?: ObjectId;
  compraId: string | ObjectId;
  edicaoId: string;
  usuarioId: ObjectId | string;
  codigoDesconto?: PaymentCodeSnapshot;
  codigoRastreio?: PaymentCodeSnapshot;
  valoresCentavos: PaymentAmountsInCents;
  valorSelecionadoCentavos?: SelectedPaymentAmountsInCents;
  pagamento?: {
    metodo?: "PIX" | "BOLETO" | "DEBIT_CARD" | "CREDIT_CARD" | string;
    checkoutId?: string;
    paymentId?: string;
    invoiceNumber?: string;
  };
  refundStatus?: "PARTIAL" | "IN_PROGRESS" | "FULL" | string;
  refundsSnapshot?: PaymentRefundsSnapshot;
  chargebackStatus?: "REQUESTED" | "DISPUTED" | string;
  status: PaymentAttributionStatus;
  createdAt: Date;
  confirmedAt?: Date;
  updatedAt: Date;
}

export interface PaymentRefundItem {
  value: number;
  valueCentavos: number;
  status: string;
  dateCreated: string | null;
  transactionReceiptUrl: string | null;
}

export interface PaymentRefundsSnapshot {
  items: PaymentRefundItem[];
  totalDone: number;
  totalDoneCentavos: number;
  capturedAt: Date;
}

export interface PaymentCodeMetrics {
  confirmadas: number;
  confirmadasBrutas: number;
  pendentes: number;
  estornadas: number;
  canceladasOuExpiradas: number;
  emRevisaoFinanceira: number;
  valorConfirmadoCentavos: number;
  valorBrutoConfirmadoCentavos: number;
  valorEstornadoDoneCentavos: number;
  valorEmRiscoCentavos: number;
  valorLiquidoCentavos: number;
}

export interface PaymentCodeListItem {
  id: string | null;
  edicaoId: string;
  codigo: string;
  codigoNormalizado: string;
  tipo: PaymentCodeType;
  percentualDesconto?: number;
  responsavel?: PaymentCodeResponsible;
  status: PaymentCodeStatus | "CONSUMIDO";
  historico: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  metrics: PaymentCodeMetrics;
}
