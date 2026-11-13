import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";
import { anotarAuditoria } from "@/app/lib/auditoria/registro";


export const DELETE = withApiAuthRequired(async function DELETE(request) {
    const data = await request.json()
    const { db } = await connectToDatabase();
    const colecao = 'minicursos'


    try {
        // O documento inteiro (com a lista de inscritos) fica no log: é o único jeito de reconstruir.
        const apagado = await db.collection(colecao).findOneAndDelete(
            { _id: new ObjectId(data.eventId) },  // Encontra o documento com o _id especificado
        );
        if (apagado) {
            anotarAuditoria(request, {
                alvo: { minicursoId: String(apagado._id), minicursoNome: String(apagado.name ?? "") },
                antes: apagado,
                detalhes: { inscritos: Array.isArray(apagado.participants) ? apagado.participants.length : 0 },
            })
        }
        return NextResponse.json({ message: "O Minicurso foi apagado com sucesso!" })
    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu Algum erro" }, { status: 500 })
    }



})