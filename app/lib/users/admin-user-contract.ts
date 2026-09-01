import type { IPayment } from "../types/payments/payment.t"

type UnknownRecord = Record<string, unknown>

export const ADMIN_USER_SUMMARY_PROJECTION = {
    _id: 1,
    id_api: 1,
    isPos_registration: 1,
    "informacoes_usuario.cpf": 1,
    "informacoes_usuario.numero_telefone": 1,
    "informacoes_usuario.nome": 1,
    "informacoes_usuario.email": 1,
    "informacoes_usuario.data_criacao": 1,
    "informacoes_usuario.titulo_honorario": 1,
    "pagamento.situacao": 1,
    "pagamento.situacao_animacao": 1,
    "pagamento.tipo_pagamento": 1,
} as const

export interface AdminUserProfile {
    cpf: string | null
    numero_telefone: string | null
    nome: string | null
    email: string | null
    data_criacao: string | null
    titulo_honorario: string | null
}

export interface AdminUserPaymentSummary {
    situacao: 0 | 1 | 2 | null
    situacao_animacao: boolean
    tipo_pagamento: string | null
}

export interface AdminUserSummary {
    _id: string
    id_api: string | null
    isPos_registration: boolean
    cadastroPendente: boolean
    informacoes_usuario: AdminUserProfile
    pagamento: AdminUserPaymentSummary
}

export interface AdminUserDetails extends Omit<AdminUserSummary, "pagamento"> {
    pagamento: AdminUserPaymentSummary & {
        lista_pagamentos: IPayment["lista_pagamentos"]
    }
}

export interface AdminUserFilters {
    searchTerm?: string
    selectedStatus?: string
    selectedPaymentType?: string
    startDate?: string
    endDate?: string
}

function asRecord(value: unknown): UnknownRecord | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as UnknownRecord
        : null
}

function stringOrNull(value: unknown): string | null {
    if (typeof value !== "string") return null
    const normalized = value.trim()
    return normalized || null
}

function idOrNull(value: unknown): string | null {
    const direct = stringOrNull(value)
    if (direct) return direct

    const candidate = asRecord(value)
    if (!candidate || typeof candidate.toHexString !== "function") return null

    try {
        return stringOrNull(candidate.toHexString())
    } catch {
        return null
    }
}

export function adminDateToIso(value: unknown): string | null {
    if (value === null || value === undefined) return null

    const date = value instanceof Date
        ? value
        : typeof value === "string" && value.trim()
            ? new Date(value)
            : null

    if (!date || Number.isNaN(date.getTime())) return null
    return date.toISOString()
}

function paymentStatus(value: unknown): 0 | 1 | 2 | null {
    return value === 0 || value === 1 || value === 2 ? value : null
}

function normalizeLegacyPayment(value: unknown): IPayment["lista_pagamentos"][number] | null {
    const payment = asRecord(value)
    if (!payment) return null

    const webhooks = payment._webhook
    const paymentDocumentId = idOrNull(payment._id)
    const eventId = idOrNull(payment._eventID)
    const valid = (
        paymentDocumentId !== null &&
        eventId !== null &&
        stringOrNull(payment.id) !== null &&
        typeof payment.description === "string" &&
        typeof payment.value === "number" &&
        Number.isFinite(payment.value) &&
        typeof payment.invoiceUrl === "string" &&
        (payment.status === undefined || typeof payment.status === "string") &&
        Array.isArray(webhooks) &&
        webhooks.every((webhook) => {
            const record = asRecord(webhook)
            return record !== null && typeof record.event === "string"
        })
    )
    if (!valid) return null

    return {
        ...payment,
        _id: paymentDocumentId,
        _eventID: eventId,
    } as IPayment["lista_pagamentos"][number]
}

function normalizeBaseUser(value: unknown): AdminUserSummary | null {
    const user = asRecord(value)
    if (!user) return null

    const _id = idOrNull(user._id)
    if (!_id) return null

    const rawProfile = asRecord(user.informacoes_usuario)
    const rawPayment = asRecord(user.pagamento)
    const informacoes_usuario: AdminUserProfile = {
        cpf: stringOrNull(rawProfile?.cpf),
        numero_telefone: stringOrNull(rawProfile?.numero_telefone),
        nome: stringOrNull(rawProfile?.nome),
        email: stringOrNull(rawProfile?.email),
        data_criacao: adminDateToIso(rawProfile?.data_criacao),
        titulo_honorario: stringOrNull(rawProfile?.titulo_honorario),
    }

    return {
        _id,
        id_api: stringOrNull(user.id_api),
        isPos_registration: user.isPos_registration === true,
        cadastroPendente: !(
            informacoes_usuario.nome &&
            informacoes_usuario.email &&
            informacoes_usuario.cpf &&
            informacoes_usuario.numero_telefone
        ),
        informacoes_usuario,
        pagamento: {
            situacao: paymentStatus(rawPayment?.situacao),
            situacao_animacao: rawPayment?.situacao_animacao === true,
            tipo_pagamento: stringOrNull(rawPayment?.tipo_pagamento),
        },
    }
}

export function normalizeAdminUserSummary(value: unknown): AdminUserSummary | null {
    return normalizeBaseUser(value)
}

export function normalizeAdminUserDetails(value: unknown): AdminUserDetails | null {
    const summary = normalizeBaseUser(value)
    const rawUser = asRecord(value)
    const rawPayment = asRecord(rawUser?.pagamento)
    if (!summary || !rawUser) return null

    const rawLegacyPayments = rawPayment?.lista_pagamentos
    const normalizedLegacyPayments = Array.isArray(rawLegacyPayments)
        ? rawLegacyPayments.map(normalizeLegacyPayment)
        : []
    const lista_pagamentos = normalizedLegacyPayments.every(
        (payment): payment is IPayment["lista_pagamentos"][number] => payment !== null,
    ) ? normalizedLegacyPayments : []

    return {
        ...summary,
        pagamento: {
            ...summary.pagamento,
            lista_pagamentos,
        },
    }
}

export function normalizeAdminUserList(value: unknown): AdminUserSummary[] | null {
    if (!Array.isArray(value)) return null

    const normalized = value.map(normalizeAdminUserSummary)
    return normalized.every((user): user is AdminUserSummary => user !== null)
        ? normalized
        : null
}

export function parseAdminUserListPayload(value: unknown): AdminUserSummary[] | null {
    const payload = asRecord(value)
    return normalizeAdminUserList(payload?.data)
}

export function parseAdminUserListHttpResponse(
    ok: boolean,
    value: unknown,
): AdminUserSummary[] | null {
    return ok ? parseAdminUserListPayload(value) : null
}

export function parseAdminUserDetailsPayload(value: unknown): AdminUserDetails | null {
    const payload = asRecord(value)
    return normalizeAdminUserDetails(payload?.data)
}

export function parseAdminUserDetailsHttpResponse(
    ok: boolean,
    value: unknown,
): AdminUserDetails | null {
    return ok ? parseAdminUserDetailsPayload(value) : null
}

export function displayUserName(user: AdminUserSummary): string {
    return user.informacoes_usuario.nome ?? "Cadastro pendente"
}

export function displayUserField(value: string | null): string {
    return value ?? "Não informado"
}

export function adminUserInitial(user: AdminUserSummary): string {
    return user.informacoes_usuario.nome?.charAt(0).toLocaleUpperCase("pt-BR") || "?"
}

export function adminUserCreationDay(value: string | null): string | null {
    const iso = adminDateToIso(value)
    return iso?.split("T")[0] ?? null
}

export function filterAdminUsers(
    users: AdminUserSummary[],
    filters: AdminUserFilters,
): AdminUserSummary[] {
    const term = filters.searchTerm?.trim().toLocaleLowerCase("pt-BR") ?? ""
    const selectedStatus = filters.selectedStatus ?? ""
    const selectedPaymentType = filters.selectedPaymentType ?? ""
    const startDate = filters.startDate ?? ""
    const endDate = filters.endDate ?? ""

    return users.filter((user) => {
        const searchableValues = [
            user._id,
            user.informacoes_usuario.nome,
            user.informacoes_usuario.email,
            user.informacoes_usuario.numero_telefone,
        ]
        const searchMatch = term === "" || searchableValues.some(
            (candidate) => candidate?.toLocaleLowerCase("pt-BR").includes(term),
        )
        const statusMatch = selectedStatus === "" ||
            user.pagamento.situacao === Number.parseInt(selectedStatus, 10)
        const paymentTypeMatch = selectedPaymentType === "" ||
            user.pagamento.tipo_pagamento === selectedPaymentType
        const creationDate = adminUserCreationDay(user.informacoes_usuario.data_criacao)
        const startDateMatch = startDate === "" ||
            (creationDate !== null && creationDate >= startDate)
        const endDateMatch = endDate === "" ||
            (creationDate !== null && creationDate <= endDate)

        return searchMatch && statusMatch && paymentTypeMatch && startDateMatch && endDateMatch
    })
}
