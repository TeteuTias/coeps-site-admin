import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'bson';

export const dynamic = 'force-dynamic'


export const GET = withApiAuthRequired(async function GET(request, { params }) {
    const userId = params?.["_id"];

    if (!userId || !(typeof userId === "string")) {
        throw new Error("userId is not valid")
    }

    if (!ObjectId.isValid(userId)) {
        throw new Error("userId is not valid")
    }


    const { db } = await connectToDatabase();
    const colecao = 'minicursos'


    const response = await db.collection(colecao).find(
        {
            $or: [
                {
                    participants: userId
                },
                {
                    attendanceList: userId
                }
            ]
        },
        // estamos usando essa rota para vários locais agora. Por isso removi a projeção.
    ).toArray() // 'buffer': 0, 'user_id': 0, 'size': 0

    return Response.json({ data: response })
})