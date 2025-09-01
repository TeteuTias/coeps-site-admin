import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';
import { getSession } from '@auth0/nextjs-auth0';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, response) {
    try {
        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'trabalhos_blob';
        const colecaoAvaliacoes = 'trabalhos_avaliacoes';

        // Buscar todos os trabalhos
        const trabalhos = await db.collection(colecaoTrabalhos).find(
            {},
            { projection: { "filename": 1, "_id": 1, "url": 1, userId: 1 } }
        ).toArray();

        // Buscar todas ava
        const avaliacoes = await db.collection(colecaoAvaliacoes).find({}).toArray();

        // Formatar dados dos tr
        const formatar = async function (trabalhos) {
            const respostaFormatada = {};
            const respostaFormatadaTradutor = {};
            
            trabalhos.map(value => {
                respostaFormatada[value.userId] ? respostaFormatada[value.userId].push(
                    {
                        "_id": value['_id'],
                        "name": value['filename'],
                        "url": value['url'],
                        "userId": `${value.userId}`,
                    }) :
                    respostaFormatada[value.userId] = [
                        {
                            "_id": value['_id'],
                            "name": value['filename'],
                            "url": value['url'],
                            "userId": `${value.userId}`,
                        }
                    ]
            });

            // Buscar informações  usuários
            for (const key in respostaFormatada) {
                try {
                    const data = await db.collection('usuarios').find(
                        { _id: new ObjectId(key) }, 
                        { projection: { "informacoes_usuario": 1 } }
                    ).toArray();
                    respostaFormatadaTradutor[key] = data[0];
                } catch {
                }
            }

            return [respostaFormatada, respostaFormatadaTradutor];
        }

        // avaliações por userId
        const formatarAvaliacoes = function (avaliacoes) {
            const avaliacoesFormatadas = {};
            
            avaliacoes.forEach(avaliacao => {
                if (!avaliacoesFormatadas[avaliacao.userId]) {
                    avaliacoesFormatadas[avaliacao.userId] = [];
                }
                avaliacoesFormatadas[avaliacao.userId].push(avaliacao);
            });

            return avaliacoesFormatadas;
        }

        const [respostaFormatada, respostaFormatadaTradutor] = await formatar(trabalhos);
        const avaliacoesFormatadas = formatarAvaliacoes(avaliacoes);

        return NextResponse.json({
            "data": respostaFormatada,
            "tradutor": respostaFormatadaTradutor,
            "avaliacoes": avaliacoesFormatadas
        }, { status: 200 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({ "message": error.message }, { status: 500 });
    }
});

