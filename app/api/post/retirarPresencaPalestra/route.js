import { NextResponse } from "next/server"
import { withApiAuthRequired } from "@auth0/nextjs-auth0"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";


export const POST = withApiAuthRequired(async function POST(request) {
    const data = await request.json()
    const { db } = await connectToDatabase();
    const colecao = 'palestras'
    if (data.listType !== "init" && data.listType !== "end") {
        throw new Error("!listType")
    }

    try {
        if (data.listType === "init") {
            console.log("euuusdf")
            const response = await db.collection(colecao).updateOne(
                { _id: new ObjectId(data.eventId) },  // Encontra o documento com o _id especificado
                { $pull: { attendanceListInit: data.userId } }  // Remove o userId de attendanceList, se ele estiver presente
            );
            return NextResponse.json({ data: response })
        }
        const response = await db.collection(colecao).updateOne(
            { _id: new ObjectId(data.eventId) },  // Encontra o documento com o _id especificado
            { $pull: { attendanceListEnd: data.userId } }  // Remove o userId de attendanceList, se ele estiver presente
        );
        return NextResponse.json({ data: response })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }



})