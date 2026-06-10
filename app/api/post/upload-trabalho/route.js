import { auth0, withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const { user } = await auth0.getSession();
        const userId = user.sub.replace("auth0|", ""); // ID do usuário logado
        
        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'trabalhos_blob';
        
        // Obter dados do FormData
        const formData = await request.formData();
        const file = formData.get('file') // as File;

        if (!file) {
            return NextResponse.json({ 
                "message": "Nenhum arquivo foi enviado" 
            }, { status: 400 });
        }

        // Validações do arquivo
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];

        if (file.size > maxSize) {
            return NextResponse.json({ 
                "message": "Arquivo muito grande. Tamanho máximo: 10MB" 
            }, { status: 400 });
        }

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ 
                "message": "Tipo de arquivo não permitido. Use PDF, DOC, DOCX ou TXT" 
            }, { status: 400 });
        }

        // Verificar se usuário já atingiu o limite de trabalhos
        const configTrabalhos = await db.collection('trabalhos.config').findOne({});
        const limiteTrabalhos = configTrabalhos?.trabalhos_por_usuario || 2;
        
        const trabalhosExistentes = await db.collection(colecaoTrabalhos).countDocuments({
            userId: userId
        });

        if (trabalhosExistentes >= limiteTrabalhos) {
            return NextResponse.json({ 
                "message": `Limite de ${limiteTrabalhos} trabalhos por usuário atingido` 
            }, { status: 400 });
        }

        // Verificar se as submissões estão abertas
        if (configTrabalhos) {
            const agora = new Date();
            const dataInicio = new Date(configTrabalhos.data_inicio_submissao);
            const dataLimite = new Date(configTrabalhos.data_limite_submissao);

            if (agora < dataInicio) {
                return NextResponse.json({ 
                    "message": "Período de submissão ainda não iniciou" 
                }, { status: 400 });
            }

            if (agora > dataLimite) {
                return NextResponse.json({ 
                    "message": "Período de submissão encerrado" 
                }, { status: 400 });
            }
        }

        // Converter arquivo para buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Gerar URL temporária (em produção, você salvaria no cloud storage)
        // Por enquanto, vamos simular uma URL
        const timestamp = Date.now();
        const urlArquivo = `/uploads/${userId}/${timestamp}_${file.name}`;

        // Dados para salvar no banco
        const dadosTrabalho = {
            filename: file.name,
            url: urlArquivo,
            userId: userId,
            buffer: buffer, // Em produção, você não salvaria o buffer no MongoDB
            size: file.size,
            type: file.type,
            dataUpload: new Date().toISOString(),
            status: 'enviado'
        };

        // Salvar no banco de dados
        const resultado = await db.collection(colecaoTrabalhos).insertOne(dadosTrabalho);

        if (resultado.insertedId) {
            // Criar registro inicial de avaliação
            await db.collection('trabalhos_avaliacoes').insertOne({
                documentId: resultado.insertedId.toString(),
                userId: userId,
                status: 'pendente',
                avaliadorComentarios: '',
                dataSubmissao: new Date().toISOString()
            });

            return NextResponse.json({
                "message": "Trabalho enviado com sucesso",
                "trabalho": {
                    _id: resultado.insertedId,
                    filename: file.name,
                    url: urlArquivo,
                    size: file.size,
                    dataUpload: dadosTrabalho.dataUpload
                }
            }, { status: 200 });
        } else {
            return NextResponse.json({ 
                "message": "Erro ao salvar trabalho" 
            }, { status: 500 });
        }

    } catch (error) {
        console.log(error);
        return NextResponse.json({ 
            "message": "Erro interno do servidor: " + error.message 
        }, { status: 500 });
    }
});

