import { auth0, withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        const miniCursoId = params["_id"];
        //const { user } = await auth0.getSession();
        //vconst userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Já vem apenas com o replace.


        const { db } = await connectToDatabase();
        const colecao = 'usuarios'


        const response = await db.collection(colecao).find(
            { _id: new ObjectId(miniCursoId) },
            // estamos usando essa rota para vários locais agora. Por isso removi a projeção.
        ).toArray() // 'buffer': 0, 'user_id': 0, 'size': 0


        return NextResponse.json({
            "data": { ...response[0] },
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