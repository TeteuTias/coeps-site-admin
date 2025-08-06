import { connectToDatabase } from '../../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ObjectId } from 'bson';

export const dynamic = 'force-dynamic'


export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {

        const miniCursoId = params?.["_id"];

        if (!miniCursoId || !(typeof miniCursoId === "string")) {
            throw new Error("MinicursoId is not valid")
        }

        if (!ObjectId.isValid(miniCursoId)) {
            throw new Error("MinicursoId is not valid")
        }

        console.log(params["_id"])

        const { db } = await connectToDatabase();
        const colecao = 'minicursos'


        const response = await db.collection(colecao).find(
            { _id: new ObjectId(miniCursoId) },
            // estamos usando essa rota para vários locais agora. Por isso removi a projeção.
        ).toArray() // 'buffer': 0, 'user_id': 0, 'size': 0

        return Response.json({ data: response[0] })
    } catch (err) {
        return Response.json({message: err instanceof Error ? err.message : "Ocorreu algum erro desconhecido. Recarregue a página e tente novamente." }, { status: 500 })

    }
})