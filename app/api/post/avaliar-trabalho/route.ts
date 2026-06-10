import { auth0, withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import { IAcademicWorks } from '@/app/lib/types/academicWorks/academicWorks.t';

export const dynamic = 'force-dynamic'

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const session = await auth0.getSession();
        const avaliadorId = session?.user.sub.replace("auth0|", ""); // ID do avaliador logado

        const { db } = await connectToDatabase();
        const colecaoAvaliacoes = 'Dados_do_trabalho';

        // Obter dados do corpo da requisição
        const body = await request.json();
        const { documentId, userId, status, avaliadorComentarios, ficha_avalicao } = body;
        ficha_avalicao as IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"]
        // Validar dados obrigatórios
        if (!documentId || !userId || !status || !ficha_avalicao) {
            return NextResponse.json({
                "message": "DocumentId, userId, ficha_avalicao e status são obrigatórios"
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

        let dadosTrabalho: IAcademicWorks = await db.collection(colecaoAvaliacoes).findOne(
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
        dadosTrabalho.configuracaoModalidade.ficha_avalicao.forEach((fichaData) => {
            ficha_avalicao.forEach((fichaPayload: IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"][number]) => {
                if (`${fichaPayload._id}` == `${fichaData._id}`) {
                    fichaData["justificativa"].unshift(fichaPayload.justificativa[0]) // em zero porque sempre to alterando o 0 no lado do cliente
                    fichaData["notasRecebidas"].unshift(fichaPayload.notasRecebidas[0]) // em zero porque sempre to alterando o 0 no lado do cliente
                }
            })
        })

        const payloadComentario: IAcademicWorks["avaliadorComentarios"][0] =
        {
            comentario: avaliadorComentarios,
            avaliadorId: new ObjectId(avaliadorId),
            date: new Date(),
            status: status
        };


        const payloadFichaAvaliacao: IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"] = dadosTrabalho.configuracaoModalidade.ficha_avalicao

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
                    status: status,
                    "configuracaoModalidade.ficha_avalicao": payloadFichaAvaliacao
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

