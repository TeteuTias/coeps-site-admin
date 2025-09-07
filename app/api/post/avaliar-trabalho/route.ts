import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ObjectId } from 'bson';
import { getSession } from '@auth0/nextjs-auth0';
import {IAcademicWorks} from '@/app/lib/types/academicWorks/academicWorks.t';

export const dynamic = 'force-dynamic'

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const session = await getSession();
        const avaliadorId = session?.user.sub.replace("auth0|", ""); // ID do avaliador logado

        const { db } = await connectToDatabase();
        const colecaoAvaliacoes = 'Dados_do_trabalho';

        // Obter dados do corpo da requisição
        const body = await request.json();
        const { documentId, userId, status, avaliadorComentarios } = body;

        // Validar dados obrigatórios
        if (!documentId || !userId || !status) {
            return NextResponse.json({
                "message": "DocumentId, userId e status são obrigatórios"
            }, { status: 400 });
        }

        // Validar status
        const statusValidos: IAcademicWorks["status"][] = ["Em Avaliação", "Aceito", "Recusado", "Necessita de Alteração"];
        if (!statusValidos.includes(status)) {
            return NextResponse.json({
                "message": "Status inválido"
            }, { status: 400 });
        }

        // Validar comentários obrigatórios para "Necessita de Alteração"
        if (status === 'Necessita de Alteração' && (!avaliadorComentarios || avaliadorComentarios.trim() === '')) {
            return NextResponse.json({
                "message": "Comentários são obrigatórios para status 'Necessita Alteração'"
            }, { status: 400 });
        }

        let dadosTrabalho = await db.collection(colecaoAvaliacoes).findOne(
            {
                _id: new ObjectId(documentId),
                userId: new ObjectId(userId)
            },
        );

        //
        //
        if (!dadosTrabalho) {
            return NextResponse.json({
                "message": "Trabalho não encontrado"
            }, { status: 404 });
        }
        //
        //
        const payloadComentario: IAcademicWorks["avaliadorComentarios"][0] =
        {
            comentario: avaliadorComentarios,
            avaliadorId: new ObjectId(avaliadorId),
            date: new Date(),
            status: status
        };
        await db.collection(colecaoAvaliacoes).updateOne(
            {
                _id: new ObjectId(documentId),
                userId: new ObjectId(userId)
            },
            {
                $push: {
                    avaliadorComentarios: payloadComentario
                },
                $set: {
                    status: status
                }
            }
        );
        return Response.json({
            message: "Avaliação registrada com sucesso."
        })

    } catch (error) {
        console.log(error);
        return NextResponse.json({
            "message": "Erro interno do servidor: " + (error instanceof Error ? error.message : error)
        }, { status: 500 });
    }
});

