import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        
        // Parâmetros de busca
        const query = searchParams.get('q') || '';
        const topico = searchParams.get('topico') || '';
        const status = searchParams.get('status') || '';
        const modalidade = searchParams.get('modalidade') || '';
        const autor = searchParams.get('autor') || '';
        const dataInicio = searchParams.get('dataInicio') || '';
        const dataFim = searchParams.get('dataFim') || '';
        const ordenacao = searchParams.get('ordenacao') || 'dataSubmissao';
        const direcao = searchParams.get('direcao') || 'desc';
        const limite = parseInt(searchParams.get('limite') || '50');
        const pagina = parseInt(searchParams.get('pagina') || '1');

        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'Dados_do_trabalho';
        const colecaoUsuarios = 'usuarios';

        // Construir filtro trabalhos
        let filtroTrabalhos = {};
        
        // Filtro por busca geral (título, arquivo, tópicos)
        if (query) {
            filtroTrabalhos.$or = [
                { titulo: { $regex: query, $options: 'i' } },
                { 'arquivo.fileName': { $regex: query, $options: 'i' } },
                { 'autores.nome': { $regex: query, $options: 'i' } },
                { 'autores.email': { $regex: query, $options: 'i' } },
                { 'topicos.pchave': { $regex: query, $options: 'i' } },
                { 'topicos.intro': { $regex: query, $options: 'i' } },
                { 'topicos.obj': { $regex: query, $options: 'i' } },
                { 'topicos.met': { $regex: query, $options: 'i' } },
                { 'topicos.disc': { $regex: query, $options: 'i' } },
                { 'topicos.conc': { $regex: query, $options: 'i' } },
                { 'topicos.ref': { $regex: query, $options: 'i' } }
            ];
        }

        
        if (topico) {
            const topicoFiltro = {
                $or: [
                    { 'topicos.pchave': { $regex: topico, $options: 'i' } },
                    { 'topicos.intro': { $regex: topico, $options: 'i' } },
                    { 'topicos.obj': { $regex: topico, $options: 'i' } },
                    { 'topicos.met': { $regex: topico, $options: 'i' } },
                    { 'topicos.disc': { $regex: topico, $options: 'i' } },
                    { 'topicos.conc': { $regex: topico, $options: 'i' } },
                    { 'topicos.ref': { $regex: topico, $options: 'i' } }
                ]
            };
            
            if (filtroTrabalhos.$or) {
                filtroTrabalhos = { $and: [filtroTrabalhos, topicoFiltro] };
            } else {
                filtroTrabalhos = topicoFiltro;
            }
        }

        // Filtro por status
        if (status) {
            filtroTrabalhos.status = status;
        }

        // Filtro por modalidade
        if (modalidade) {
            filtroTrabalhos.modalidade = modalidade;
        }

        //  autor
        if (autor) {
            const autorFiltro = {
                $or: [
                    { 'autores.nome': { $regex: autor, $options: 'i' } },
                    { 'autores.email': { $regex: autor, $options: 'i' } }
                ]
            };
            
            if (filtroTrabalhos.$and) {
                filtroTrabalhos.$and.push(autorFiltro);
            } else if (filtroTrabalhos.$or) {
                filtroTrabalhos = { $and: [filtroTrabalhos, autorFiltro] };
            } else {
                filtroTrabalhos = autorFiltro;
            }
        }

        //  data
        if (dataInicio || dataFim) {
            filtroTrabalhos.dataSubmissao = {};
            if (dataInicio) {
                filtroTrabalhos.dataSubmissao.$gte = new Date(dataInicio).toISOString();
            }
            if (dataFim) {
                filtroTrabalhos.dataSubmissao.$lte = new Date(dataFim + 'T23:59:59.999Z').toISOString();
            }
        }

        // ordenação
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
            case 'autor':
                ordenacaoObj['autores.0.nome'] = direcao === 'asc' ? 1 : -1;
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

        // Contar documentos
        const total = await db.collection(colecaoTrabalhos).countDocuments(filtroTrabalhos);

        // Buscar informações dos usuários
        const userIds = [...new Set(trabalhos.map(t => t.userId))];
        const usuarios = await db.collection(colecaoUsuarios).find({
            _id: { $in: userIds.map(id => new ObjectId(id)) }
        }).toArray();

        const mapaUsuarios = {};
        usuarios.forEach(usuario => {
            mapaUsuarios[usuario._id.toString()] = usuario;
        });

        const trabalhosProcessados = trabalhos.map(trabalho => {
            const usuario = mapaUsuarios[trabalho.userId];
          
            const palavrasChave = trabalho.topicos?.pchave 
                ? trabalho.topicos.pchave.split(',').map(p => p.trim()).filter(p => p)
                : [];

            return {
                _id: trabalho._id.toString(),
                userId: trabalho.userId,
                titulo: trabalho.titulo,
                modalidade: trabalho.modalidade,
                autores: trabalho.autores,
                arquivo: trabalho.arquivo,
                topicos: trabalho.topicos,
                palavrasChave: palavrasChave,
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

        // Calcular estatísticas da busca
        const estatisticasBusca = {
            total: total,
            pagina: pagina,
            limite: limite,
            totalPaginas: Math.ceil(total / limite),
            porStatus: {
                emAvaliacao: trabalhosProcessados.filter(t => t.status === 'Em Avaliação').length,
                aceitos: trabalhosProcessados.filter(t => t.status === 'Aceito').length,
                recusados: trabalhosProcessados.filter(t => t.status === 'Recusado').length,
                necessitamAlteracao: trabalhosProcessados.filter(t => t.status === 'Necessita de Alteração').length
            },
            modalidades: [...new Set(trabalhosProcessados.map(t => t.modalidade))].sort(),
            topicosComuns: extrairTopicosComuns(trabalhosProcessados)
        };

        return NextResponse.json({
            trabalhos: trabalhosProcessados,
            estatisticas: estatisticasBusca,
            filtros: {
                query,
                topico,
                status,
                modalidade,
                autor,
                dataInicio,
                dataFim,
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

// Função para extrair tópicos mais comuns dos resultados
function extrairTopicosComuns(trabalhos) {
    const topicoCount = {};
    
    trabalhos.forEach(trabalho => {
        trabalho.palavrasChave.forEach(palavra => {
            const palavraLimpa = palavra.toLowerCase().trim();
            if (palavraLimpa) {
                topicoCount[palavraLimpa] = (topicoCount[palavraLimpa] || 0) + 1;
            }
        });
    });
    
    return Object.entries(topicoCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([topico, quantidade]) => ({ topico, quantidade }));
}

