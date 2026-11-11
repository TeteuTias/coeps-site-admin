import { withApiAuthRequired } from "@/app/lib/auth0"
import { connectToDatabase } from "@/app/lib/mongodb"
import { normalizeEmail } from "@/app/lib/trabalhos/work-email"
import { ObjectId, type Db } from "mongodb"

export const dynamic = "force-dynamic"

// Corrige nome/e-mail de um autor já submetido (ex.: e-mail digitado errado na submissão).
export const POST = withApiAuthRequired(async function POST(request: Request) {
    const body = await request.json().catch(() => null)
    const { trabalhoId, index, emailAtual } = body ?? {}
    const nome = typeof body?.nome === "string" ? body.nome.trim() : ""
    const email = normalizeEmail(body?.email)

    if (typeof trabalhoId !== "string" || !ObjectId.isValid(trabalhoId) || !Number.isInteger(index) || index < 0) {
        return Response.json({ message: "Trabalho ou autor inválido." }, { status: 400 })
    }
    if (!nome || nome.length > 200) {
        return Response.json({ message: "Informe um nome válido." }, { status: 400 })
    }
    if (!email) {
        return Response.json({ message: "Informe um e-mail válido." }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    // Filtrar pelo e-mail atual evita editar o autor errado se a lista mudou desde que a página carregou
    const result = await (db as Db).collection("Dados_do_trabalho").updateOne(
        { _id: new ObjectId(trabalhoId), [`autores.${index}.email`]: emailAtual ?? null },
        { $set: { [`autores.${index}.nome`]: nome, [`autores.${index}.email`]: email } },
    )

    if (result.matchedCount === 0) {
        return Response.json({ message: "Autor não encontrado ou alterado por outra pessoa. Recarregue a página." }, { status: 409 })
    }
    return Response.json({ message: "Autor atualizado.", data: { nome, email } })
})
