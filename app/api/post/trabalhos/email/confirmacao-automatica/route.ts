import { withApiAuthRequired } from "@/app/lib/auth0"
import { emailScriptConfig, postToEmailScript } from "@/app/lib/trabalhos/email-script"

export const dynamic = "force-dynamic"

// Sem "ativo" no corpo apenas consulta o estado; com "ativo" liga ou desliga.
// O estado fica guardado no próprio Google Apps Script.
export const POST = withApiAuthRequired(async function POST(request: Request) {
    const payload = await request.json().catch(() => null) as { ativo?: unknown } | null
    const ativo = payload?.ativo
    if (ativo !== undefined && typeof ativo !== "boolean") {
        return Response.json(
            { error: "invalid_payload", message: "O valor de ativação é inválido." },
            { status: 400 },
        )
    }

    const config = emailScriptConfig()
    if (!config) {
        return Response.json(
            {
                error: "email_not_configured",
                message: "O envio de e-mails ainda não está configurado neste ambiente (script do Google ausente).",
            },
            { status: 409 },
        )
    }

    const body = await postToEmailScript(config, {
        acao: "config",
        ...(typeof ativo === "boolean" ? { autoConfirmacao: ativo } : {}),
    })
    if (!body || body.ok !== true || typeof body.autoConfirmacao !== "boolean") {
        return Response.json(
            {
                error: "email_provider_error",
                message: "O script de envio não respondeu à configuração. Verifique se a versão publicada está atualizada.",
            },
            { status: 424 },
        )
    }

    return Response.json({ data: { ativo: body.autoConfirmacao } })
})
