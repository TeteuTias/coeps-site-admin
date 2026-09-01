import type {
    ILoteAutomatico,
    IPaymentConfig,
    IParcelamento,
} from "../types/payments/payment.t"

type UnknownRecord = Record<string, unknown>

const PAYMENT_METHODS = ["PIX", "BOLETO", "CREDIT_CARD", "DEBIT_CARD"] as const

function asRecord(value: unknown): UnknownRecord | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as UnknownRecord
        : null
}

function nonNegativeNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null
}

function parseInstallments(value: unknown): IParcelamento[] | null {
    if (!Array.isArray(value)) return null

    const installments: IParcelamento[] = []
    for (const rawInstallment of value) {
        const installment = asRecord(rawInstallment)
        const codigo = installment?.codigo
        const totalParcelas = installment?.totalParcelas
        const valorCadaParcela = nonNegativeNumber(installment?.valorCadaParcela)
        if (
            !Number.isInteger(codigo) ||
            (codigo as number) < 0 ||
            !Number.isInteger(totalParcelas) ||
            (totalParcelas as number) < 1 ||
            valorCadaParcela === null
        ) {
            return null
        }
        installments.push({
            codigo: codigo as number,
            totalParcelas: totalParcelas as number,
            valorCadaParcela,
        })
    }
    return installments
}

function parsePaymentMethods(value: unknown): IPaymentConfig["pagamentosAceitos"] | null {
    if (!Array.isArray(value)) return null
    if (!value.every((item) => PAYMENT_METHODS.includes(item as typeof PAYMENT_METHODS[number]))) {
        return null
    }
    return [...new Set(value)] as IPaymentConfig["pagamentosAceitos"]
}

export function parseAdminPaymentConfigPayload(value: unknown): IPaymentConfig | null {
    const payload = asRecord(value)
    if (!payload || typeof payload._id !== "string" || !payload._id.trim()) return null

    const valorAVista = nonNegativeNumber(payload.valorAVista)
    const valorBoleto = nonNegativeNumber(payload.valorBoleto)
    const valorDebito = nonNegativeNumber(payload.valorDebito)
    const valorPix = nonNegativeNumber(payload.valorPix)
    const parcelamentos = parseInstallments(payload.parcelamentos)
    const pagamentosAceitos = parsePaymentMethods(payload.pagamentosAceitos)
    if (
        valorAVista === null ||
        valorBoleto === null ||
        valorDebito === null ||
        valorPix === null ||
        parcelamentos === null ||
        pagamentosAceitos === null
    ) {
        return null
    }

    const rawAutomaticConfig = asRecord(payload.configuracaoLotesAutomaticos)
    const automaticLots = Array.isArray(rawAutomaticConfig?.lotes)
        ? rawAutomaticConfig.lotes as ILoteAutomatico[]
        : undefined
    const modo = payload.modo === "automatico" || payload.modo === "manual"
        ? payload.modo
        : undefined

    return {
        _id: payload._id.trim() as IPaymentConfig["_id"],
        edicaoId: typeof payload.edicaoId === "string" ? payload.edicaoId : undefined,
        ativo: typeof payload.ativo === "boolean" ? payload.ativo : undefined,
        pagantesLegados: typeof payload.pagantesLegados === "number" &&
            Number.isInteger(payload.pagantesLegados) && payload.pagantesLegados >= 0
            ? payload.pagantesLegados
            : undefined,
        dataInit: typeof payload.dataInit === "string" ? payload.dataInit : "",
        dataEnd: typeof payload.dataEnd === "string" ? payload.dataEnd : "",
        parcelamentos,
        nome: typeof payload.nome === "string" && payload.nome.trim()
            ? payload.nome
            : "Configuração financeira",
        valorAVista,
        valorBoleto,
        valorDebito,
        valorPix,
        pagamentosAceitos,
        modo,
        configuracaoLotesAutomaticos: automaticLots ? { lotes: automaticLots } : undefined,
    }
}

export function parseAdminPaymentConfigHttpResponse(
    ok: boolean,
    value: unknown,
): IPaymentConfig | null {
    return ok ? parseAdminPaymentConfigPayload(value) : null
}
