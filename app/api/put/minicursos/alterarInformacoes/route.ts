import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'bson';
import { connectToDatabase } from "@/app/lib/mongodb";
import { camposEditaveisMinicurso } from "@/app/lib/minicursos/edicao";
import { anotarAuditoria } from "@/app/lib/auditoria/registro";

export const PUT = withApiAuthRequired(async function PUT(request) {
    const data = await request.json()
    const { db } = await connectToDatabase();
    const colecao = 'minicursos'

    try {
        if (!ObjectId.isValid(String(data?._id ?? ""))) {
            return NextResponse.json({ message: "Atividade inválida." }, { status: 400 })
        }
        // Só os campos do formulário. Inscritos, presença e _nSerie ficam como estão.
        const campos = camposEditaveisMinicurso(data)
        const projecao = Object.fromEntries(Object.keys(campos).map((campo) => [campo, 1]))
        const antes = await db.collection(colecao).findOneAndUpdate(
            { _id: new ObjectId(data._id) },
            { $set: campos },
            { projection: { ...projecao, participants: 1 } }
        );
        if (antes) {
            const { participants, _id, ...antesCampos } = antes
            anotarAuditoria(request, {
                alvo: { minicursoId: String(_id), minicursoNome: String(campos.name ?? antes.name ?? "") },
                antes: antesCampos,
                depois: campos,
                detalhes: { inscritosMantidos: Array.isArray(participants) ? participants.length : null },
            })
        }
        if (!antes) {
            return NextResponse.json({ message: "Atividade não encontrada." }, { status: 404 })
        }
        return NextResponse.json({ message: "Minicurso atualizado com sucesso!" })

    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu Algum erro" }, { status: 500 })
    }
})
