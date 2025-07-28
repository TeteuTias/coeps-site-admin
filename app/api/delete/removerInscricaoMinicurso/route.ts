import { NextResponse } from "next/server"
import { withApiAuthRequired } from "@auth0/nextjs-auth0"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";


export const DELETE = withApiAuthRequired(async function DELETE(request) {
    const data = await request.json()
    const { db } = await connectToDatabase();
    const colecao = 'minicursos'


    try {

        const response = await db.collection(colecao).updateOne(
            { _id: new ObjectId(data.eventId) },  // Encontra o documento com o _id especificado
            {
                $pull: {
                    participants: data.userId,
                    attendanceList: data.userId
                }
            }  // Adiciona o userId se ele não estiver em attendanceList
        );

        return NextResponse.json({ data: response })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }



})