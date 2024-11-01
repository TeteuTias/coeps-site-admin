import { NextResponse } from "next/server"
import { withApiAuthRequired } from "@auth0/nextjs-auth0"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";


export const POST = withApiAuthRequired(async function POST(request) {
    const data = await request.json()
    const { db } = await connectToDatabase();
    const colecao = 'usuarios'


    try {
        // Converta a lista de strings em ObjectId
        const objectIds = data.map((id) => new ObjectId(id));

        // Realize a consulta com o operador $or
        const response = await db.collection(colecao).find(
            { _id: { $in: objectIds } }, // Usando $in para buscar por vários ObjectIds
            { projection: { informacoes_usuario: 1, _id: 0 } }
        ).sort({ "informacoes_usuario.nome": 1 }) // Ordena pelo campo informacoes_usuario.nome em ordem ascendente
            .toArray();

        return NextResponse.json({ data: response })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }



})