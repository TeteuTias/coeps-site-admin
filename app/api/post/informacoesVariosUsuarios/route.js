import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";
import {
    ADMIN_USER_SUMMARY_PROJECTION,
    normalizeAdminUserList,
} from "@/app/lib/users/admin-user-contract";


export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const data = await request.json().catch(() => null)
        if (!Array.isArray(data) || !data.every((id) => typeof id === "string" && ObjectId.isValid(id))) {
            return NextResponse.json(
                { error: "invalid_user_ids", message: "A lista de usuários é inválida." },
                { status: 400 },
            )
        }
        const { db } = await connectToDatabase();
        const colecao = 'usuarios'
        // Converta a lista de strings em ObjectId
        const objectIds = data.map((id) => new ObjectId(id));

        // Realize a consulta com o operador $or
        const response = await db.collection(colecao).find(
            { _id: { $in: objectIds } }, // Usando $in para buscar por vários ObjectIds
            { projection: ADMIN_USER_SUMMARY_PROJECTION }
        ).sort({ "informacoes_usuario.nome": 1 }) // Ordena pelo campo informacoes_usuario.nome em ordem ascendente
            .toArray();

        const users = normalizeAdminUserList(response)
        if (!users) {
            return NextResponse.json(
                { error: "invalid_user_data", message: "Os dados de usuários estão em formato inválido." },
                { status: 500 },
            )
        }

        return NextResponse.json({ data: users })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }



})
