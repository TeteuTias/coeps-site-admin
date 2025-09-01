import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';
import { getSession } from '@auth0/nextjs-auth0';

export const dynamic = 'force-dynamic'

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const { user } = await getSession();
        const avaliadorId = user.sub.replace("auth0|", ""); // ID do avaliador logado
        
        const { db } = await connectToDatabase();
        const colecaoAvaliacoes = 'trabalhos_avaliacoes';
        
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
        const statusValidos = ['pendente', 'aceito', 'recusado', 'necessita_alteracao'];
        if (!statusValidos.includes(status)) {
            return NextResponse.json({ 
                "message": "Status inválido" 
            }, { status: 400 });
        }

        // Validar comentários obrigatórios para "necessita_alteracao"
        if (status === 'necessita_alteracao' && (!avaliadorComentarios || avaliadorComentarios.trim() === '')) {
            return NextResponse.json({ 
                "message": "Comentários são obrigatórios para status 'Necessita Alteração'" 
            }, { status: 400 });
        }

        // Verificar se já existe uma avaliação para este documento/usuário
        const avaliacaoExistente = await db.collection(colecaoAvaliacoes).findOne({
            documentId: documentId,
            userId: userId
        });

        const dadosAvaliacao = {
            documentId: documentId,
            userId: userId,
            status: status,
            avaliadorComentarios: avaliadorComentarios || '',
            dataAvaliacao: new Date().toISOString(),
            avaliadorId: avaliadorId
        };

        let resultado;

        if (avaliacaoExistente) {
            // Atualizar avaliação existente
            resultado = await db.collection(colecaoAvaliacoes).updateOne(
                { 
                    documentId: documentId,
                    userId: userId 
                },
                { 
                    $set: dadosAvaliacao 
                }
            );
        } else {
            // Criar nova avaliação
            resultado = await db.collection(colecaoAvaliacoes).insertOne(dadosAvaliacao);
        }

        if (resultado.modifiedCount > 0 || resultado.insertedId) {
            return NextResponse.json({
                "message": "Avaliação salva com sucesso",
                "avaliacao": dadosAvaliacao
            }, { status: 200 });
        } else {
            return NextResponse.json({ 
                "message": "Erro ao salvar avaliação" 
            }, { status: 500 });
        }

    } catch (error) {
        console.log(error);
        return NextResponse.json({ 
            "message": "Erro interno do servidor: " + error.message 
        }, { status: 500 });
    }
});

