import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { normalizeAdminUserDetails } from '@/app/lib/users/admin-user-contract';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        const { _id: miniCursoId } = await params;
        if (!ObjectId.isValid(miniCursoId)) {
            return NextResponse.json(
                { error: "invalid_user_id", message: "O identificador do usuário é inválido." },
                { status: 400 },
            )
        }
        //const { user } = await auth0.getSession();
        //vconst userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Já vem apenas com o replace.


        const { db } = await connectToDatabase();
        const colecao = 'usuarios'


        const response = await db.collection(colecao).findOne(
            { _id: new ObjectId(miniCursoId) },
        )

        if (!response) {
            return NextResponse.json(
                { error: "user_not_found", message: "Usuário não encontrado." },
                { status: 404 },
            )
        }

        const user = normalizeAdminUserDetails(response)
        if (!user) {
            return NextResponse.json(
                { error: "invalid_user_data", message: "Os dados do usuário estão em formato inválido." },
                { status: 500 },
            )
        }

        return NextResponse.json({
            "data": user,
        }, { status: 200 });

    }
    catch {
        return NextResponse.json(
            { error: "internal_server_error", message: "Não foi possível consultar o usuário." },
            { status: 500 }
        )
    }
})
/*
{"data":[{"_id":"6696b5adf287f4a45ed8f04f","name":"Certificado.pdf"}]}
*/
