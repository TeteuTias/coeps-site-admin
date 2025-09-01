import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        
        // busca
        const busca = searchParams.get('busca') || '';
        const status = searchParams.get('status') || '';
        const modalidade = searchParams.get('modalidade') || '';
        const ordenacao = searchParams.get('ordenacao') || 'dataSubmissao';
        const direcao = searchParams.get('direcao') || 'desc';
        const limite = parseInt(searchParams.get('limite') || '50');
        const pagina = parseInt(searchParams.get('pagina') || '1');

        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'Dados_do_trabalho';
        const colecaoUsuarios = 'usuarios';

        // Construir filtro trabalhos
        let filtroTrabalhos = {};
        
        // Filtro por busca (título, nome do autor, palavras-chave)
        if (busca) {
            filtroTrabalhos.$or = [
                { titulo: { $regex: busca, $options: 'i' } },
                { 'autores.nome': { $regex: busca, $options: 'i' } },
                { 'autores.email': { $regex: busca, $options: 'i' } },
                { 'arquivo.fileName': { $regex: busca, $options: 'i' } },
                { 'topicos.pchave': { $regex: busca, $options: 'i' } },
                { 'topicos.intro': { $regex: busca, $options: 'i' } },
                { 'topicos.obj': { $regex: busca, $options: 'i' } },
                { 'topicos.met': { $regex: busca, $options: 'i' } },
                { 'topicos.disc': { $regex: busca, $options: 'i' } },
                { 'topicos.conc': { $regex: busca, $options: 'i' } }
            ];
        }

        // Filtro por status
        if (status) {
            filtroTrabalhos.status = status;
        }

        // Filtro por modalidade
        if (modalidade) {
            filtroTrabalhos.modalidade = modalidade;
        }

        // Configurar ordenação
        let ordenacaoObj = {};
        switch (ordenacao) {
            case 'titulo':
                ordenacaoObj.titulo = direcao === 'asc' ? 1 : -1;
                break;
            case 'modalidade':
                ordenacaoObj.modalidade = direcao === 'asc' ? 1 : -1;
                break;
            case 'status':
                ordenacaoObj.status = direcao === 'asc' ? 1 : -1;
                break;
            case 'dataSubmissao':
            default:
                ordenacaoObj.dataSubmissao = direcao === 'asc' ? 1 : -1;
                break;
        }

        // Buscar trabalhos com paginação
        const skip = (pagina - 1) * limite;
        const trabalhos = await db.collection(colecaoTrabalhos)
            .find(filtroTrabalhos)
            .sort(ordenacaoObj)
            .skip(skip)
            .limit(limite)
            .toArray();

        // Contar total de documentos
        const total = await db.collection(colecaoTrabalhos).countDocuments(filtroTrabalhos);

        // Buscar informações do user
        const userIds = [...new Set(trabalhos.map(t => t.userId))];
        const usuarios = await db.collection(colecaoUsuarios).find({
            _id: { $in: userIds.map(id => new ObjectId(id)) }
        }).toArray();

        const mapaUsuarios = {};
        usuarios.forEach(usuario => {
            mapaUsuarios[usuario._id.toString()] = usuario;
        });

        // Processar trabalhos com informações completas
        const trabalhosProcessados = trabalhos.map(trabalho => {
            const usuario = mapaUsuarios[trabalho.userId];
            
            return {
                _id: trabalho._id.toString(),
                userId: trabalho.userId,
                titulo: trabalho.titulo,
                modalidade: trabalho.modalidade,
                autores: trabalho.autores,
                arquivo: trabalho.arquivo,
                topicos: trabalho.topicos,
                status: trabalho.status,
                dataSubmissao: trabalho.dataSubmissao,
                avaliadorComentarios: trabalho.avaliadorComentarios || '',
                dataAvaliacao: trabalho.dataAvaliacao || null,
                avaliadorId: trabalho.avaliadorId || null,
                usuario: {
                    nome: usuario?.informacoes_usuario?.nome || 'Nome não encontrado',
                    email: usuario?.informacoes_usuario?.email || '',
                    cpf: usuario?.informacoes_usuario?.cpf || '',
                    telefone: usuario?.informacoes_usuario?.numero_telefone || ''
                }
            };
        });

        // Calcular estatísticas
        const estatisticas = await calcularEstatisticas(db, colecaoTrabalhos);

        return NextResponse.json({
            trabalhos: trabalhosProcessados,
            estatisticas: {
                ...estatisticas,
                total: total,
                pagina: pagina,
                limite: limite,
                totalPaginas: Math.ceil(total / limite)
            },
            filtros: {
                busca,
                status,
                modalidade,
                ordenacao,
                direcao
            }
        }, { status: 200 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({ 
            "message": "Erro interno do servidor: " + error.message 
        }, { status: 500 });
    }
});

// Função para calcular estatísticas
async function calcularEstatisticas(db, colecaoTrabalhos) {
    const pipeline = [
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                emAvaliacao: {
                    $sum: { $cond: [{ $eq: ["$status", "Em Avaliação"] }, 1, 0] }
                },
                aceitos: {
                    $sum: { $cond: [{ $eq: ["$status", "Aceito"] }, 1, 0] }
                },
                recusados: {
                    $sum: { $cond: [{ $eq: ["$status", "Recusado"] }, 1, 0] }
                },
                necessitamAlteracao: {
                    $sum: { $cond: [{ $eq: ["$status", "Necessita de Alteração"] }, 1, 0] }
                }
            }
        }
    ];

    const resultado = await db.collection(colecaoTrabalhos).aggregate(pipeline).toArray();
    
    if (resultado.length === 0) {
        return {
            total: 0,
            emAvaliacao: 0,
            aceitos: 0,
            recusados: 0,
            necessitamAlteracao: 0,
            modalidades: [],
            topicos: []
        };
    }

    const stats = resultado[0];

   
    const modalidades = await db.collection(colecaoTrabalhos).distinct('modalidade');

    // palavras-chave
    const topicosComuns = await db.collection(colecaoTrabalhos).aggregate([
        { $match: { 'topicos.pchave': { $exists: true, $ne: '' } } },
        { $project: { palavrasChave: { $split: ['$topicos.pchave', ','] } } },
        { $unwind: '$palavrasChave' },
        { $project: { palavra: { $trim: { input: '$palavrasChave' } } } },
        { $match: { palavra: { $ne: '' } } },
        { $group: { _id: '$palavra', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]).toArray();

    return {
        total: stats.total,
        emAvaliacao: stats.emAvaliacao,
        aceitos: stats.aceitos,
        recusados: stats.recusados,
        necessitamAlteracao: stats.necessitamAlteracao,
        modalidades: modalidades,
        topicos: topicosComuns.map(t => ({ topico: t._id, quantidade: t.count }))
    };
}

