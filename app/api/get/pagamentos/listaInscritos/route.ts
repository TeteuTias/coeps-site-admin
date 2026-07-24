import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
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
            }
        ).toArray()

        return NextResponse.json([...result], { status: 200 });
        // result[0] => IPaymentConfig

    }
    catch (error) {
        console.log(error)
        return NextResponse.json({ "message": error }, { status: 500 })
    }
})
