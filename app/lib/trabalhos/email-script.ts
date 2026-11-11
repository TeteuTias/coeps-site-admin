const SCRIPT_URL_PREFIX = "https://script.google.com/"
const SCRIPT_TIMEOUT_MS = 50_000

export interface EmailScriptConfig {
    url: string
    secret: string
}

export function emailScriptConfig(): EmailScriptConfig | null {
    const url = (process.env.GOOGLE_SCRIPT_EMAIL_URL ?? "").trim()
    const secret = (process.env.GOOGLE_SCRIPT_EMAIL_SECRET ?? "").trim()
    return url.startsWith(SCRIPT_URL_PREFIX) && secret ? { url, secret } : null
}

// Devolve null quando o script não responde ou responde algo que não é um objeto JSON.
export async function postToEmailScript(
    config: EmailScriptConfig,
    body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
    try {
        const response = await fetch(config.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, secret: config.secret }),
            redirect: "follow",
            cache: "no-store",
            signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS),
        })
        const payload: unknown = await response.json()
        return typeof payload === "object" && payload !== null && !Array.isArray(payload)
            ? payload as Record<string, unknown>
            : null
    } catch {
        return null
    }
}
