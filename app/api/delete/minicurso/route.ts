import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";


export const DELETE = withApiAuthRequired(async function DELETE(request) {
    const data = await request.json()
    const { db } = await connectToDatabase();
    const colecao = 'minicursos'


    try {
        await db.collection(colecao).deleteOne(
            { _id: new ObjectId(data.eventId) },  // Encontra o documento com o _id especificado
        );
        return NextResponse.json({ message: "O Minicurso foi apagado com sucesso!" })
    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu Algum erro" }, { status: 500 })
    }



})