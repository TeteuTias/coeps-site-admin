import { getSession } from "@/app/lib/auth0"
import { connectToDatabase } from "@/app/lib/mongodb"
import { getRemoteWorkProofStream } from "@/app/lib/remote-work-proof-storage"
import { ObjectId, type Db } from "mongodb"
import { Readable } from "node:stream"

export const dynamic = "force-dynamic"

function jsonError(status: number, error: string, message: string) {
    return Response.json({ error, message }, { status })
}

function safeFilename(value: unknown): string {
    const filename = String(value || "comprovante")
        .replace(/[\r\n"\\/]/g, "_")
        .trim()
    return filename || "comprovante"
}

export async function GET(
    request: Request,
    context: { params: Promise<{ userId: string; proofId: string }> },
) {
    const session = await getSession(request).catch(() => null)
    if (!session?.user?.sub) {
        return jsonError(401, "not_authenticated", "É necessário iniciar uma sessão administrativa.")
    }

    const { userId, proofId } = await context.params
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(proofId)) {
        return jsonError(400, "invalid_identifier", "O identificador do comprovante é inválido.")
    }

    try {
        const { db: untypedDb } = await connectToDatabase()
        const db = untypedDb as Db
        const access = await db.collection("trabalhos_acessos_remotos").findOne(
            {
                userId: new ObjectId(userId),
                "proof.proofId": new ObjectId(proofId),
            },
            { projection: { proof: 1 } },
        )
        if (!access?.proof?.objectKey) {
            return jsonError(404, "proof_not_found", "Comprovante não encontrado para este usuário.")
        }

        const disposition = new URL(request.url).searchParams.get("download") === "1"
            ? "attachment"
            : "inline"
        const stream = await getRemoteWorkProofStream(String(access.proof.objectKey))
        return new Response(Readable.toWeb(stream) as ReadableStream, {
            headers: {
                "Cache-Control": "private, no-store, max-age=0",
                "Content-Disposition": `${disposition}; filename="${safeFilename(access.proof.originalName)}"`,
                "Content-Type": String(access.proof.mimeType || "application/octet-stream"),
                "X-Content-Type-Options": "nosniff",
            },
        })
    } catch (error) {
        console.error("Falha ao transmitir comprovante remoto:", error)
        return jsonError(500, "proof_read_failed", "Não foi possível abrir o comprovante remoto.")
    }
}
