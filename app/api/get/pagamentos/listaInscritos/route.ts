import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '@/app/lib/mongodb';
import {
    ADMIN_USER_SUMMARY_PROJECTION,
    normalizeAdminUserList,
} from '@/app/lib/users/admin-user-contract';
import { NextResponse } from 'next/server';
//
//
// 

export const dynamic = 'force-dynamic'

// POR ENQUANTO ELE PUXA SÓ O 66bcfceedc9c7250e85b2ac6
// SE PRECISAR DEPOIS ELE PUXA O RESTANTE BASEADO NA DATA E SEI LÁ O QUE MAIS.

export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        // Verificando se está logado
        // Puxando configs

        const { db } = await connectToDatabase();
        const colecao = "usuarios"
        const result = await db.collection(colecao).find(
            {
                "pagamento.situacao": 1
            },
            { projection: ADMIN_USER_SUMMARY_PROJECTION },
        ).toArray()

        const users = normalizeAdminUserList(result)
        if (!users) {
            return NextResponse.json(
                { error: "invalid_user_data", message: "Os dados de pagantes estão em formato inválido." },
                { status: 500 },
            )
        }

        return NextResponse.json({ data: users }, { status: 200 });
        // result[0] => IPaymentConfig

    }
    catch (error) {
        console.log(error)
        return NextResponse.json({ "message": error }, { status: 500 })
    }
})
