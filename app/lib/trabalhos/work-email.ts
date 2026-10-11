export const WORK_EMAIL_LIMITS = {
    subjectLength: 200,
    bodyBytes: 100_000,
    worksPerRequest: 10,
} as const

export const WORK_EMAIL_VARIABLES = ["nome", "titulo", "autores", "modalidade", "status"] as const

export type WorkEmailVariable = typeof WORK_EMAIL_VARIABLES[number]

export interface WorkEmailAudience {
    remetente: boolean
    autores: boolean
}

export interface WorkEmailPerson {
    nome?: unknown
    email?: unknown
}

export interface WorkEmailWork {
    id: string
    titulo?: unknown
    modalidade?: unknown
    status?: unknown
    autores?: unknown
    remetente?: WorkEmailPerson | null
}

export interface WorkEmailRecipient {
    trabalhoId: string
    email: string
    nome: string
}

export interface WorkEmailMessage {
    trabalhoId: string
    para: string
    assunto: string
    corpoHtml: string
}

export interface WorkEmailRequest {
    assunto: string
    corpoHtml: string
    trabalhoIds: string[]
    destinatarios: WorkEmailAudience
    somenteEmails: string[] | null
    teste: boolean
}

export type WorkEmailRequestResult =
    | { ok: true; request: WorkEmailRequest }
    | { ok: false; error: string; message: string }

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i
const EMAIL_PATTERN = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]{2,}$/
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : ""
}

export function normalizeEmail(value: unknown) {
    const email = text(value).toLowerCase()
    return EMAIL_PATTERN.test(email) ? email : null
}

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

export function htmlToPlainText(html: string) {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function byteLength(value: string) {
    return new TextEncoder().encode(value).length
}

function invalid(error: string, message: string): WorkEmailRequestResult {
    return { ok: false, error, message }
}

export function parseWorkEmailRequest(value: unknown): WorkEmailRequestResult {
    const payload = asRecord(value)
    if (!payload) {
        return invalid("invalid_payload", "O corpo da requisição é inválido.")
    }

    const assunto = text(payload.assunto).replace(/[\r\n]+/g, " ")
    if (!assunto) {
        return invalid("invalid_subject", "Informe o assunto do e-mail.")
    }
    if (assunto.length > WORK_EMAIL_LIMITS.subjectLength) {
        return invalid(
            "invalid_subject",
            `O assunto deve ter no máximo ${WORK_EMAIL_LIMITS.subjectLength} caracteres.`,
        )
    }

    const corpoHtml = typeof payload.corpoHtml === "string" ? payload.corpoHtml : ""
    if (!htmlToPlainText(corpoHtml)) {
        return invalid("invalid_body", "Escreva a mensagem do e-mail.")
    }
    if (byteLength(corpoHtml) > WORK_EMAIL_LIMITS.bodyBytes) {
        return invalid("invalid_body", "A mensagem é grande demais para ser enviada.")
    }

    const ids = payload.trabalhoIds
    if (!Array.isArray(ids) || ids.length === 0) {
        return invalid("invalid_works", "Selecione ao menos um trabalho.")
    }
    if (ids.length > WORK_EMAIL_LIMITS.worksPerRequest) {
        return invalid(
            "invalid_works",
            `Envie no máximo ${WORK_EMAIL_LIMITS.worksPerRequest} trabalhos por requisição.`,
        )
    }
    if (!ids.every((id): id is string => typeof id === "string" && OBJECT_ID_PATTERN.test(id))) {
        return invalid("invalid_works", "Há um identificador de trabalho inválido.")
    }

    const teste = payload.teste === true
    const audience = asRecord(payload.destinatarios)
    const destinatarios = {
        remetente: audience?.remetente === true,
        autores: audience?.autores === true,
    }
    if (!teste && !destinatarios.remetente && !destinatarios.autores) {
        return invalid("invalid_audience", "Escolha quem deve receber o e-mail.")
    }

    let somenteEmails: string[] | null = null
    if (payload.somenteEmails !== undefined && payload.somenteEmails !== null) {
        if (!Array.isArray(payload.somenteEmails)) {
            return invalid("invalid_filter", "O filtro de destinatários é inválido.")
        }
        somenteEmails = []
        for (const item of payload.somenteEmails) {
            const email = normalizeEmail(item)
            if (!email) {
                return invalid("invalid_filter", "O filtro de destinatários é inválido.")
            }
            somenteEmails.push(email)
        }
    }

    return {
        ok: true,
        request: {
            assunto,
            corpoHtml,
            trabalhoIds: Array.from(new Set(ids.map(id => id.toLowerCase()))),
            destinatarios,
            somenteEmails,
            teste,
        },
    }
}

// Um destinatário por e-mail dentro do mesmo trabalho; a conta que submeteu
// tem prioridade sobre o autor homônimo para definir o nome exibido.
export function resolveWorkRecipients(
    work: WorkEmailWork,
    audience: WorkEmailAudience,
    somenteEmails?: readonly string[] | null,
): WorkEmailRecipient[] {
    const candidates: WorkEmailPerson[] = []
    if (audience.remetente && work.remetente) {
        candidates.push(work.remetente)
    }
    if (audience.autores && Array.isArray(work.autores)) {
        for (const autor of work.autores) {
            const record = asRecord(autor)
            if (record) candidates.push(record)
        }
    }

    const allowed = somenteEmails ? new Set(somenteEmails) : null
    const recipients = new Map<string, WorkEmailRecipient>()
    for (const candidate of candidates) {
        const email = normalizeEmail(candidate.email)
        if (!email || recipients.has(email)) continue
        if (allowed && !allowed.has(email)) continue
        recipients.set(email, { trabalhoId: work.id, email, nome: text(candidate.nome) })
    }

    return Array.from(recipients.values())
}

export function countUniqueEmails(recipients: readonly WorkEmailRecipient[]) {
    return new Set(recipients.map(recipient => recipient.email)).size
}

// Nomes na ordem em que foram cadastrados no trabalho, sem repetir.
export function workAuthorNames(work: WorkEmailWork) {
    if (!Array.isArray(work.autores)) return []
    const names = work.autores.map(autor => text(asRecord(autor)?.nome)).filter(Boolean)
    return Array.from(new Set(names))
}

export function workEmailVariables(
    work: WorkEmailWork,
    nome: string,
): Record<WorkEmailVariable, string> {
    return {
        nome: nome || "participante",
        titulo: text(work.titulo),
        autores: workAuthorNames(work).join(", "),
        modalidade: text(work.modalidade),
        status: text(work.status),
    }
}

export function renderWorkEmailTemplate(
    template: string,
    variables: Record<WorkEmailVariable, string>,
    options: { html: boolean },
) {
    return template.replace(VARIABLE_PATTERN, (match, name: string) => {
        const key = name.toLowerCase() as WorkEmailVariable
        if (!WORK_EMAIL_VARIABLES.includes(key)) return match
        return options.html ? escapeHtml(variables[key]) : variables[key]
    })
}

export function buildWorkEmailMessage(
    work: WorkEmailWork,
    recipient: Pick<WorkEmailRecipient, "email" | "nome">,
    assunto: string,
    corpoHtml: string,
): WorkEmailMessage {
    const variables = workEmailVariables(work, recipient.nome)
    return {
        trabalhoId: work.id,
        para: recipient.email,
        assunto: renderWorkEmailTemplate(assunto, variables, { html: false })
            .replace(/[\r\n]+/g, " ")
            .trim(),
        corpoHtml: renderWorkEmailTemplate(corpoHtml, variables, { html: true }),
    }
}

export function buildWorkEmailMessages(
    works: readonly WorkEmailWork[],
    request: Pick<WorkEmailRequest, "assunto" | "corpoHtml" | "destinatarios" | "somenteEmails">,
): WorkEmailMessage[] {
    return works.flatMap(work =>
        resolveWorkRecipients(work, request.destinatarios, request.somenteEmails).map(recipient =>
            buildWorkEmailMessage(work, recipient, request.assunto, request.corpoHtml),
        ),
    )
}

export function chunkWorkIds(ids: readonly string[], size: number = WORK_EMAIL_LIMITS.worksPerRequest) {
    const chunks: string[][] = []
    for (let index = 0; index < ids.length; index += size) {
        chunks.push(ids.slice(index, index + size))
    }
    return chunks
}
