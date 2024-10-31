import { connectToDatabase } from '../../../lib/mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';

//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, response) {
    try {
        //const { user } = await getSession();
        //vconst userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Já vem apenas com o replace.

        const { db } = await connectToDatabase();
        const colecao = 'usuarios'

        /*
        {
            "_id": "66bbc8c2db29318201acc2a1",
            "informacoes_usuario": {
                "cpf": "71314066196",
                "numero_telefone": "64999215086",
                "nome": "Mateus Rosa Martins ",
                "email": "tylerervin5.tv@gmail.com",
                "data_criacao": "2024-08-13T20:57:40.256Z",
                "titulo_honorario": ""
            }
        }
        */

        const response = await db.collection(colecao).find(
            { "pagamento.situacao": 1, "teste":{"$not":{"$eq":true}}},
            { projection: { informacoes_usuario: 1 } }
        ).toArray() // 'buffer': 0, 'user_id': 0, 'size': 0

        return NextResponse.json({
            "data": response,
        }, { status: 200 });

    }
    catch (error) {
        console.log(error)
        return NextResponse.json({ "message": error.message }, { status: 500 })
    }
})
/*
{"data":[{"_id":"6696b5adf287f4a45ed8f04f","name":"Certificado.pdf"}]}
*/