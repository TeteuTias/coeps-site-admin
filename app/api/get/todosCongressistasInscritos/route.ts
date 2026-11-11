import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '@/app/lib/mongodb';
import {
    ADMIN_USER_SUMMARY_PROJECTION,
    normalizeAdminUserList,
} from '@/app/lib/users/admin-user-contract';
import { NextResponse } from 'next/server';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {

        const { db } = await connectToDatabase();
        const colecao = 'usuarios'


        const response = await db.collection(colecao).find(
            {
                "pagamento.situacao": 1
            },
            { projection: ADMIN_USER_SUMMARY_PROJECTION },
        ).sort({ "informacoes_usuario.nome": 1 }).toArray()

        const users = normalizeAdminUserList(response)
        if (!users) {
            return NextResponse.json(
                { error: "invalid_user_data", message: "Os dados de usuários estão em formato inválido." },
                { status: 500 },
            )
        }
        return NextResponse.json({
            "data": users,
        }, { status: 200 });

    }
    catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu algum erro desconhecido. Recarregue e tente novamente." }, { status: 500 })
    }
})
/*
{"data":[{"_id":"6696b5adf287f4a45ed8f04f","name":"Certificado.pdf"}]}
*/
