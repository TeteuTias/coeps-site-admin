import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '@/app/lib/mongodb';
import {
    ADMIN_USER_SUMMARY_PROJECTION,
    normalizeAdminUserList,
    purchaseLotFromSession,
} from '@/app/lib/users/admin-user-contract';
import { ObjectId, type Document } from 'mongodb';
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
            { projection: { ...ADMIN_USER_SUMMARY_PROJECTION, "pagamento.compraId": 1 } },
        ).toArray()

        // O lote fica na sessão da compra confirmada (usuarios.pagamento.compraId -> pagamentos.sessoes).
        const compraIds = result
            .map((user: Document) => String(user.pagamento?.compraId ?? ""))
            .filter((id: string) => ObjectId.isValid(id))
        const sessoes = compraIds.length === 0 ? [] : await db.collection("pagamentos.sessoes").find(
            { _id: { $in: compraIds.map((id: string) => new ObjectId(id)) } },
            {
                projection: {
                    "paymentConfigOriginal.codigo": 1,
                    "paymentConfigOriginal.nome": 1,
                    perfilUtilizador: 1,
                    origemPreco: 1,
                    "codigoDesconto.perfilUtilizador": 1,
                },
            },
        ).toArray()
        const sessaoPorCompra = new Map(sessoes.map((sessao: Document) => [String(sessao._id), sessao]))

        const users = normalizeAdminUserList(result.map((user: Document) => ({
            ...user,
            lote: purchaseLotFromSession(
                sessaoPorCompra.get(String(user.pagamento?.compraId ?? "")),
                user.pagamento?.tipo_pagamento,
            ),
        })))
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
