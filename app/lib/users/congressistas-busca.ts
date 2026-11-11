export const CONGRESSISTAS_MIN_QUERY_LENGTH = 4
export const CONGRESSISTAS_MAX_QUERY_LENGTH = 80
export const CONGRESSISTAS_PAGE_SIZE = 12

const PARTICIPATION_MODES = ["REGULAR", "REMOTE", "BOTH", "NONE"] as const
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface CongressistasBuscaParams {
    q: string
    status: string
    paymentType: string
    mode: string
    startDate: string
    endDate: string
    page: number
}

export type CongressistasBuscaParse =
    | { ok: true, value: CongressistasBuscaParams }
    | { ok: false, message: string }

export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function hasOtherFilter(params: Omit<CongressistasBuscaParams, "q" | "page">): boolean {
    return Boolean(params.status || params.paymentType || params.mode || params.startDate || params.endDate)
}

export function parseCongressistasBuscaParams(searchParams: URLSearchParams): CongressistasBuscaParse {
    const q = (searchParams.get("q") ?? "").trim()
    const status = (searchParams.get("status") ?? "").trim()
    const paymentType = (searchParams.get("paymentType") ?? "").trim()
    const mode = (searchParams.get("mode") ?? "").trim()
    const startDate = (searchParams.get("startDate") ?? "").trim()
    const endDate = (searchParams.get("endDate") ?? "").trim()
    const rawPage = searchParams.get("page")

    if (q.length > CONGRESSISTAS_MAX_QUERY_LENGTH) {
        return { ok: false, message: `A busca aceita no máximo ${CONGRESSISTAS_MAX_QUERY_LENGTH} caracteres.` }
    }
    if (status !== "" && !/^[0-3]$/.test(status)) {
        return { ok: false, message: "Status de inscrição inválido." }
    }
    if (paymentType.length > CONGRESSISTAS_MAX_QUERY_LENGTH) {
        return { ok: false, message: "Tipo de pagamento inválido." }
    }
    if (mode !== "" && !(PARTICIPATION_MODES as readonly string[]).includes(mode)) {
        return { ok: false, message: "Modalidade de participação inválida." }
    }
    for (const day of [startDate, endDate]) {
        if (day !== "" && (!DAY_PATTERN.test(day) || Number.isNaN(new Date(`${day}T00:00:00Z`).getTime()))) {
            return { ok: false, message: "Data inválida." }
        }
    }
    let page = 1
    if (rawPage !== null && rawPage !== "") {
        if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || !Number.isSafeInteger(Number(rawPage))) {
            return { ok: false, message: "Página inválida." }
        }
        page = Number(rawPage)
    }
    if (q.length < CONGRESSISTAS_MIN_QUERY_LENGTH && !hasOtherFilter({ status, paymentType, mode, startDate, endDate })) {
        return { ok: false, message: `Digite pelo menos ${CONGRESSISTAS_MIN_QUERY_LENGTH} letras para buscar.` }
    }
    return { ok: true, value: { q, status, paymentType, mode, startDate, endDate, page } }
}

// Filtro Mongo para busca textual, status e tipo de pagamento. Modalidade e datas
// são aplicadas depois, com filterAdminUsers, para manter a mesma semântica da lista antiga.
export function buildCongressistasMongoFilter(params: Pick<CongressistasBuscaParams, "q" | "status" | "paymentType">): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = []
    if (params.q) {
        const pattern = escapeRegex(params.q)
        conditions.push({
            $or: [
                { "informacoes_usuario.nome": { $regex: pattern, $options: "i" } },
                { "informacoes_usuario.email": { $regex: pattern, $options: "i" } },
                { "informacoes_usuario.numero_telefone": { $regex: pattern, $options: "i" } },
                { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: pattern, options: "i" } } },
            ],
        })
    }
    if (params.status !== "") conditions.push({ "pagamento.situacao": Number(params.status) })
    if (params.paymentType !== "") conditions.push({ "pagamento.tipo_pagamento": params.paymentType })
    return conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions }
}
