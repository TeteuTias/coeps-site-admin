import { auth0, withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic'

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const session = await auth0.getSession(request);
        const avaliadorId = session?.user?.sub;
        
        if (!avaliadorId) {
            return NextResponse.json({ 
                "message": "Usuário não autenticado" 
            }, { status: 401 });
        }

        const body = await request.json();
        const { trabalhoId, status, comentarios } = body;

        // Validar dados obrigatórios
        if (!trabalhoId || !status) {
            return NextResponse.json({ 
                "message": "ID do trabalho e status são obrigatórios" 
            }, { status: 400 });
        }

        // Validar status
        const statusValidos = ["Em Avaliação", "Aceito", "Recusado", "Necessita de Alteração"];
        if (!statusValidos.includes(status)) {
            return NextResponse.json({ 
                "message": "Status inválido" 
            }, { status: 400 });
        }

        // Validar comentários para status "Necessita de Alteração"
        if (status === "Necessita de Alteração" && (!comentarios || comentarios.trim() === "")) {
            return NextResponse.json({ 
                "message": "Comentários são obrigatórios para status 'Necessita de Alteração'" 
            }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'Dados_do_trabalho';

        // Verificar se o trabalho existe
        const trabalho = await db.collection(colecaoTrabalhos).findOne({
            _id: new ObjectId(trabalhoId)
        });

        if (!trabalho) {
            return NextResponse.json({ 
                "message": "Trabalho não encontrado" 
            }, { status: 404 });
        }

        // Preparar dados da avaliação
        const dadosAvaliacao = {
            status: status,
            avaliadorComentarios: comentarios || '',
            dataAvaliacao: new Date().toISOString(),
            avaliadorId: avaliadorId
        };

        // Atualizar o trabalho
        const resultado = await db.collection(colecaoTrabalhos).updateOne(
            { _id: new ObjectId(trabalhoId) },
            { $set: dadosAvaliacao }
        );

        if (resultado.matchedCount === 0) {
            return NextResponse.json({ 
                "message": "Trabalho não encontrado para atualização" 
            }, { status: 404 });
        }

        // Buscar o trabalho atualizado
        const trabalhoAtualizado = await db.collection(colecaoTrabalhos).findOne({
            _id: new ObjectId(trabalhoId)
        });

        // Log da avaliação (opcional - para auditoria)
        try {
            await db.collection('logs_avaliacoes').insertOne({
                trabalhoId: trabalhoId,
                avaliadorId: avaliadorId,
                statusAnterior: trabalho.status,
                statusNovo: status,
                comentarios: comentarios || '',
                dataAvaliacao: new Date().toISOString(),
                tituloTrabalho: trabalho.titulo,
                autorPrincipal: trabalho.autores?.[0]?.nome || 'Não informado'
            });
        } catch (logError) {
            console.log('Erro ao salvar log de avaliação:', logError);
            // Não falha a operação principal se o log falhar
        }

        return NextResponse.json({
            message: "Avaliação salva com sucesso",
            trabalho: {
                _id: trabalhoAtualizado._id.toString(),
                titulo: trabalhoAtualizado.titulo,
                status: trabalhoAtualizado.status,
                avaliadorComentarios: trabalhoAtualizado.avaliadorComentarios,
                dataAvaliacao: trabalhoAtualizado.dataAvaliacao,
                avaliadorId: trabalhoAtualizado.avaliadorId
            }
        }, { status: 200 });

    } catch (error) {
        console.log('Erro ao avaliar trabalho:', error);
        return NextResponse.json({ 
            "message": "Erro interno do servidor: " + error.message 
        }, { status: 500 });
    }
});

