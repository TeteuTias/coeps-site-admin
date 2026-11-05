import { getPaymentStatusTone } from "@/app/lib/payments/payment-status-appearance"
import type { TomSelo } from "@/app/components/ui"
import { formatarData, formatarDataHora } from "@/app/lib/formatar"
import { capitalizar } from "./comuns"

// Situações do Asaas (eventos de webhook e estados de cobrança) em português para a primeira leitura.
const SITUACAO: Record<string, string> = {
    PAYMENT_CREATED: "Gerada",
    PAYMENT_AWAITING_RISK_ANALYSIS: "Em análise de risco",
    PAYMENT_APPROVED_BY_RISK_ANALYSIS: "Análise aprovada",
    PAYMENT_REPROVED_BY_RISK_ANALYSIS: "Análise reprovada",
    PAYMENT_AUTHORIZED: "Autorizada",
    PAYMENT_UPDATED: "Atualizada",
    PAYMENT_CONFIRMED: "Confirmada",
    PAYMENT_RECEIVED: "Recebida",
    PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "Cartão recusado",
    PAYMENT_ANTICIPATED: "Antecipada",
    PAYMENT_OVERDUE: "Vencida",
    PAYMENT_DELETED: "Removida",
    PAYMENT_RESTORED: "Restaurada",
    PAYMENT_REFUNDED: "Estornada",
    PAYMENT_PARTIALLY_REFUNDED: "Estorno parcial",
    PAYMENT_REFUND_IN_PROGRESS: "Estorno em andamento",
    PAYMENT_REFUND_DENIED: "Estorno negado",
    PAYMENT_RECEIVED_IN_CASH_UNDONE: "Recebimento em dinheiro desfeito",
    PAYMENT_CHARGEBACK_REQUESTED: "Contestação solicitada",
    PAYMENT_CHARGEBACK_DISPUTE: "Contestação em disputa",
    PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão da contestação",
    PAYMENT_DUNNING_RECEIVED: "Negativação recebida",
    PAYMENT_DUNNING_REQUESTED: "Negativação solicitada",
    PAYMENT_BANK_SLIP_VIEWED: "Boleto visualizado",
    PAYMENT_CHECKOUT_VIEWED: "Fatura visualizada",
    PAYMENT_SPLIT_CANCELLED: "Divisão cancelada",
    PAYMENT_SPLIT_DIVERGENCE_BLOCK: "Bloqueada por divergência na divisão",
    PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED: "Bloqueio por divergência encerrado",
    CONFIRMED: "Confirmada",
    RECEIVED: "Recebida",
    PENDING: "Pendente",
    OVERDUE: "Vencida",
    REFUNDED: "Estornada",
}

export function situacaoPagamento(status?: string | null): string {
    if (!status) return "Não informada"
    return SITUACAO[status] ?? capitalizar(status)
}

const TOM: Record<ReturnType<typeof getPaymentStatusTone>, TomSelo> = { success: "ok", danger: "erro", warning: "alerta", neutral: "neutro" }
export const tomPagamento = (status?: string | null): TomSelo => TOM[getPaymentStatusTone(status ?? undefined)]

const ESTORNO: Record<string, string> = {
    DONE: "Concluído",
    PENDING: "Pendente",
    CANCELLED: "Cancelado",
    AWAITING_CRITICAL_ACTION: "Aguardando ação",
    AWAITING_CUSTOMER_EXTERNAL_AUTHORIZATION: "Aguardando autorização",
}
export const situacaoEstorno = (s?: string | null) => (s ? ESTORNO[s] ?? capitalizar(s) : "Registrado")

export const situacaoAtribuicao = (s?: string | null) => (s ? capitalizar(s) : "Sem atribuição")
export const situacaoFalha = (s: string) => (s === "FAILED" ? "Falhou" : s === "REVIEW_REQUIRED" ? "Em revisão" : capitalizar(s))

const METODO: Record<string, string> = { PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito" }
export const metodoPagamento = (m?: string | null) => (m ? METODO[m] ?? capitalizar(m) : "Não informado")

/** A data de criação do estorno vem do Asaas, às vezes só com o dia: sem hora não há fuso para converter. */
export function dataEstorno(valor: string | null): string {
    if (!valor) return "data não informada"
    return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? formatarData(`${valor}T12:00:00-03:00`) : formatarDataHora(valor, valor)
}

export const dataOuNaoInformado = (v: string | null) => formatarDataHora(v, "Não informado")
