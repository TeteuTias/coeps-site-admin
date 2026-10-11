import { getSession, withApiAuthRequired } from "@/app/lib/auth0"
import { connectToDatabase } from "@/app/lib/mongodb"
import {
    buildWorkEmailMessage,
    buildWorkEmailMessages,
    normalizeEmail,
    parseWorkEmailRequest,
    type WorkEmailMessage,
    type WorkEmailWork,
} from "@/app/lib/trabalhos/work-email"
import { ObjectId, type Db } from "mongodb"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SCRIPT_URL_PREFIX = "https://script.google.com/"
const SCRIPT_TIMEOUT_MS = 50_000

interface WorkDocument {
    _id: ObjectId
    userId?: unknown
    titulo?: unknown
    modalidade?: unknown
    status?: unknown
    autores?: unknown
}

interface UserDocument {
    _id: ObjectId
    informacoes_usuario?: { nome?: unknown; email?: unknown }
}

interface SendResult {
    trabalhoId: string
    email: string
    ok: boolean
    erro?: string
}

// withApiAuthRequired troca qualquer resposta 5xx por uma mensagem genérica;
// por isso as falhas de configuração e do provedor usam 409 e 424.
function jsonError(status: number, error: string, message: string) {
    return Response.json({ error, message }, { status })
}

function scriptConfig() {
    const url = (process.env.GOOGLE_SCRIPT_EMAIL_URL ?? "").trim()
    const secret = (process.env.GOOGLE_SCRIPT_EMAIL_SECRET ?? "").trim()
    return url.startsWith(SCRIPT_URL_PREFIX) && secret ? { url, secret } : null
}

async function loadWorks(db: Db, ids: string[]): Promise<WorkEmailWork[]> {
    const works = await db.collection<WorkDocument>("Dados_do_trabalho").find(
        { _id: { $in: ids.map(id => new ObjectId(id)) } },
        { projection: { userId: 1, titulo: 1, modalidade: 1, status: 1, "autores.nome": 1, "autores.email": 1 } },
    ).toArray()

    const userIds = Array.from(new Set(
        works.map(work => `${work.userId ?? ""}`).filter(id => ObjectId.isValid(id)),
    ))
    const users = userIds.length === 0 ? [] : await db.collection<UserDocument>("usuarios").find(
        { _id: { $in: userIds.map(id => new ObjectId(id)) } },
        { projection: { "informacoes_usuario.nome": 1, "informacoes_usuario.email": 1 } },
    ).toArray()
    const usersById = new Map(users.map(user => [`${user._id}`, user.informacoes_usuario ?? null]))

    const worksById = new Map(works.map(work => [`${work._id}`, work]))
    return ids.flatMap(id => {
        const work = worksById.get(id)
        if (!work) return []
        return [{
            id,
            titulo: work.titulo,
            modalidade: work.modalidade,
            status: work.status,
            autores: work.autores,
            remetente: usersById.get(`${work.userId ?? ""}`) ?? null,
        }]
    })
}

async function sendThroughScript(
    config: { url: string; secret: string },
    messages: WorkEmailMessage[],
): Promise<{ results: SendResult[]; quota: number | null } | { failure: string }> {
    let payload: unknown
    try {
        const response = await fetch(config.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                secret: config.secret,
                mensagens: messages.map(({ para, assunto, corpoHtml }) => ({ para, assunto, corpoHtml })),
            }),
            redirect: "follow",
            cache: "no-store",
            signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS),
        })
        payload = await response.json()
    } catch {
        return {
            failure: "Não foi possível obter a confirmação do script de envio. Confira a caixa de enviados antes de tentar novamente.",
        }
    }

    const body = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : null
    if (!body || body.ok !== true) {
        const reason = typeof body?.erro === "string" && body.erro.trim() ? ` (${body.erro.trim().slice(0, 200)})` : ""
        return { failure: `O script de envio recusou a solicitação${reason}.` }
    }

    const scriptResults = body.resultados
    if (!Array.isArray(scriptResults) || scriptResults.length !== messages.length) {
        return {
            failure: "O script de envio devolveu uma resposta inesperada. Confira a caixa de enviados antes de tentar novamente.",
        }
    }

    const results = messages.map((message, index): SendResult => {
        const item = scriptResults[index] as { ok?: unknown; erro?: unknown } | null
        if (item?.ok === true) {
            return { trabalhoId: message.trabalhoId, email: message.para, ok: true }
        }
        return {
            trabalhoId: message.trabalhoId,
            email: message.para,
            ok: false,
            erro: typeof item?.erro === "string" && item.erro.trim()
                ? item.erro.trim().slice(0, 200)
                : "Falha ao enviar.",
        }
    })

    return {
        results,
        quota: typeof body.cotaRestante === "number" && Number.isFinite(body.cotaRestante)
            ? body.cotaRestante
            : null,
    }
}

export const POST = withApiAuthRequired(async function POST(request: Request) {
    const parsed = parseWorkEmailRequest(await request.json().catch(() => null))
    if (!parsed.ok) {
        return jsonError(400, parsed.error, parsed.message)
    }
    const emailRequest = parsed.request

    const config = scriptConfig()
    if (!config) {
        return jsonError(
            409,
            "email_not_configured",
            "O envio de e-mails ainda não está configurado neste ambiente (script do Google ausente).",
        )
    }

    let testRecipient: { email: string; nome: string } | null = null
    if (emailRequest.teste) {
        const session = await getSession(request)
        const email = normalizeEmail(session?.user?.email)
        if (!email) {
            return jsonError(400, "test_email_unavailable", "A sua conta não tem um e-mail válido para receber o teste.")
        }
        testRecipient = { email, nome: typeof session?.user?.name === "string" ? session.user.name : "" }
    }

    const { db } = await connectToDatabase()
    const works = await loadWorks(db as Db, emailRequest.trabalhoIds)
    if (works.length === 0) {
        return jsonError(404, "works_not_found", "Nenhum dos trabalhos selecionados foi encontrado.")
    }

    const messages = testRecipient
        ? [buildWorkEmailMessage(works[0], testRecipient, `[TESTE] ${emailRequest.assunto}`, emailRequest.corpoHtml)]
        : buildWorkEmailMessages(works, emailRequest)
    if (messages.length === 0) {
        return Response.json({ data: { enviados: 0, falhas: 0, resultados: [], cotaRestante: null } })
    }

    const sent = await sendThroughScript(config, messages)
    if ("failure" in sent) {
        return jsonError(424, "email_provider_error", sent.failure)
    }

    const enviados = sent.results.filter(result => result.ok).length
    return Response.json({
        data: {
            enviados,
            falhas: sent.results.length - enviados,
            resultados: sent.results,
            cotaRestante: sent.quota,
        },
    })
})
