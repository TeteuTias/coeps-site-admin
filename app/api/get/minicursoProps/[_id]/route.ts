import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'bson';

export const dynamic = 'force-dynamic'


export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {

        const { _id: miniCursoId } = await params;

        if (!miniCursoId || !(typeof miniCursoId === "string")) {
            throw new Error("MinicursoId is not valid")
        }

        if (!ObjectId.isValid(miniCursoId)) {
            throw new Error("MinicursoId is not valid")
        }

        const { db } = await connectToDatabase();
        const colecao = 'minicursos'


        const response = await db.collection(colecao).find(
            { _id: new ObjectId(miniCursoId) },
            // estamos usando essa rota para vários locais agora. Por isso removi a projeção.
        ).toArray() // 'buffer': 0, 'user_id': 0, 'size': 0

        return Response.json({ data: response[0] })
    } catch {
        return Response.json(
            { error: "internal_server_error", message: "Não foi possível consultar o minicurso." },
            { status: 500 }
        )

    }
})
