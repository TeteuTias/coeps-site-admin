import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'bson';
import { connectToDatabase } from "@/app/lib/mongodb";
import { ICourse } from "@/app/lib/types/events/event.t";

function formatarDataComFuso(dataOriginal: string) {
    // Verifique se a string de entrada tem o formato esperado
    if (!dataOriginal || typeof dataOriginal !== 'string' || dataOriginal.length !== 16 || dataOriginal[10] !== 'T') {
        console.error("Formato de data inválido. Use 'YYYY-MM-DDTHH:mm'.");
        throw new Error("Formato de data inválido. Use 'YYYY-MM-DDTHH:mm'.")
    }

    const segundos = ':00';
    const fusoHorario = '-03:00'; // Fuso horário de Brasília (BRT)

    // Concatena a string original com os segundos e o fuso horário
    const dataFormatada = dataOriginal + segundos + fusoHorario;

    return dataFormatada;
}

export const POST = withApiAuthRequired(async function POST(request) {
    const data = await request.json()
    const { db } = await connectToDatabase();
    const colecao = 'minicursos'

    const newCouser: Omit<ICourse, "_id"> = {
        "showToUser": data.showToUser,
        "name": data.name,
        "description": data.description,
        "maxParticipants": data.maxParticipants,
        "participantsCount": 0,
        "participants": [] as never,
        "isFree": data.isFree,
        "timeline": data.timeline.map((element: ICourse['timeline'][number]) => ({
            ...element,
            date_init: formatarDataComFuso(element.date_init),
            date_end: formatarDataComFuso(element.date_end),
        })
        ),
        "isOpen": data.isOpen,
        "dateOpen": formatarDataComFuso(data.dateOpen),
        "type": data.type,
        "organization_name": data.organization_name,
        "emoji": data.emoji,
        "value": data.value,
        "_nSerie": new ObjectId().toString() as ICourse["_nSerie"],
        "attendanceList": [] as never
    }

    try {
        "O Minicurso foi criado com sucesso!"
        await db.collection(colecao).insertOne(
            {
                ...newCouser
            }
        );
        return NextResponse.json({ message: "Novo Minicurso criado com sucesso!" })

    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu Algum erro" }, { status: 500 })
    }



})