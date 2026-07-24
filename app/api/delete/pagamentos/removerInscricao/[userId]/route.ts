import { ObjectId } from "bson"
import { connectToDatabase } from '@/app/lib/mongodb';
import { withApiAuthRequired } from "@/app/lib/auth0";
// volta o estado do pagamento do usuário para: 0 -> não inscrito e sem pagamento criado!

/**
 * 

 * @abstract Apaga a inscrição de um usuário ou de TODOS. Se enviar ALL vai remover a inscrição de TUDO. Se enviar o _id vai remover a inscrição do usuário específico
 */
export const DELETE = withApiAuthRequired(async function DELETE(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {

    try {

        const { userId } = await params
        const { db } = await connectToDatabase();

        if (!ObjectId.isValid(userId)) {
            if (userId === "ALL") {
                const result = await db.collection("usuarios").updateMany(
                    {},
                    {
                        $set: {
                            "pagamento.situacao": 0,
                            "pagamento.tipo_pagamento": "",
                            "pagamento.situacao_animacao": false
                        },
                    }
                );

                if (result.matchedCount === 0) {
                    return Response.json({ message: `Nada foi alterado.` }, { status: 404 });
                }
                return Response.json({ message: "Success!" })
            }
            throw new Error("User Id is not valid")
        }


        const result = await db.collection("usuarios").updateOne(
            {
                _id: new ObjectId(userId)
            },
            {
                $set: {
                    "pagamento.situacao": 0,
                    "pagamento.tipo_pagamento": "",
                    "pagamento.situacao_animacao": false
                },
            }
        );

        if (result.matchedCount === 0) {
            return Response.json({ message: `O usuário de configuração com ID ${userId} não encontrado.` }, { status: 404 });
        }



        return Response.json({ params: userId })
    } catch {
        return Response.json(
            { error: "internal_server_error", message: "Não foi possível remover a inscrição." },
            { status: 500 }
        )
    }
})
