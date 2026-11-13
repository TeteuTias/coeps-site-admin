import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'bson';
import { connectToDatabase } from "@/app/lib/mongodb";
import { camposEditaveisMinicurso } from "@/app/lib/minicursos/edicao";

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
        const resultado = await db.collection(colecao).updateOne(
            { _id: new ObjectId(data._id) },
            { $set: campos }
        );
        if (resultado.matchedCount === 0) {
            return NextResponse.json({ message: "Atividade não encontrada." }, { status: 404 })
        }
        return NextResponse.json({ message: "Minicurso atualizado com sucesso!" })

    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu Algum erro" }, { status: 500 })
    }
})
