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
        const autor = searchParams.get('autor') || '';
        const dataInicio = searchParams.get('dataInicio') || '';
        const dataFim = searchParams.get('dataFim') || '';
        const ordenacao = searchParams.get('ordenacao') || 'data';
        const direcao = searchParams.get('direcao') || 'desc';
        const limite = parseInt(searchParams.get('limite') || '50');
        const pagina = parseInt(searchParams.get('pagina') || '1');

        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'trabalhos_blob';
        const colecaoAvaliacoes = 'trabalhos_avaliacoes';
        const colecaoUsuarios = 'usuarios';

        // filtro para trabalhos
        let filtroTrabalhos = {};
        
        // por nome do arquivo
        if (query) {
            filtroTrabalhos.filename = { 
                $regex: query, 
                $options: 'i' 
            };
        }

        //  data
        if (dataInicio || dataFim) {
            filtroTrabalhos.dataUpload = {};
            if (dataInicio) {
                filtroTrabalhos.dataUpload.$gte = new Date(dataInicio).toISOString();
            }
            if (dataFim) {
                filtroTrabalhos.dataUpload.$lte = new Date(dataFim).toISOString();
            }
        }

        // Buscar trabalhos 
        let trabalhos = await db.collection(colecaoTrabalhos)
            .find(filtroTrabalhos)
            .toArray();

        // Buscar avaliaçõe
        const avaliacoes = await db.collection(colecaoAvaliacoes).find({}).toArray();
        const mapaAvaliacoes = {};
        avaliacoes.forEach(avaliacao => {
            mapaAvaliacoes[avaliacao.documentId] = avaliacao;
        });

        // Buscar usuário
        const userIds = [...new Set(trabalhos.map(t => t.userId))];
        const usuarios = await db.collection(colecaoUsuarios).find({
            _id: { $in: userIds.map(id => new ObjectId(id)) }
        }).toArray();

        const mapaUsuarios = {};
        usuarios.forEach(usuario => {
            mapaUsuarios[usuario._id.toString()] = usuario;
        });

        // Processar trabalhos 
        let trabalhosProcessados = trabalhos.map(trabalho => {
            const avaliacao = mapaAvaliacoes[trabalho._id.toString()];
            const usuario = mapaUsuarios[trabalho.userId];
            const { topico: topicoExtraido, subtopico, palavrasChave, resumo } = extrairInformacoesTrabaho(trabalho);

            return {
                _id: trabalho._id.toString(),
                filename: trabalho.filename,
                url: trabalho.url,
                userId: trabalho.userId,
                topico: topicoExtraido,
                subtopico: subtopico,
                palavrasChave: palavrasChave,
                resumo: resumo,
                dataUpload: trabalho.dataUpload || new Date().toISOString(),
                status: avaliacao?.status || 'pendente',
                autor: {
                    nome: usuario?.informacoes_usuario?.nome || 'Nome não encontrado',
                    email: usuario?.informacoes_usuario?.email || '',
                    cpf: usuario?.informacoes_usuario?.cpf || '',
                    telefone: usuario?.informacoes_usuario?.numero_telefone || ''
                },
                avaliacao: avaliacao
            };
        });

        if (topico) {
            trabalhosProcessados = trabalhosProcessados.filter(trabalho => 
                trabalho.topico.toLowerCase().includes(topico.toLowerCase()) ||
                (trabalho.subtopico && trabalho.subtopico.toLowerCase().includes(topico.toLowerCase())) ||
                trabalho.palavrasChave.some(palavra => palavra.toLowerCase().includes(topico.toLowerCase()))
            );
        }

        if (status) {
            trabalhosProcessados = trabalhosProcessados.filter(trabalho => 
                trabalho.status === status
            );
        }

        if (autor) {
            trabalhosProcessados = trabalhosProcessados.filter(trabalho => 
                trabalho.autor.nome.toLowerCase().includes(autor.toLowerCase()) ||
                trabalho.autor.email.toLowerCase().includes(autor.toLowerCase())
            );
        }

        // Ordenação
        trabalhosProcessados.sort((a, b) => {
            let comparacao = 0;
            
            switch (ordenacao) {
                case 'nome':
                    comparacao = a.filename.localeCompare(b.filename);
                    break;
                case 'autor':
                    comparacao = a.autor.nome.localeCompare(b.autor.nome);
                    break;
                case 'topico':
                    comparacao = a.topico.localeCompare(b.topico);
                    break;
                case 'status':
                    comparacao = a.status.localeCompare(b.status);
                    break;
                case 'data':
                default:
                    comparacao = new Date(a.dataUpload).getTime() - new Date(b.dataUpload).getTime();
                    break;
            }
            
            return direcao === 'asc' ? comparacao : -comparacao;
        });

        // Paginaçã
        const total = trabalhosProcessados.length;
        const inicio = (pagina - 1) * limite;
        const fim = inicio + limite;
        const trabalhosPaginados = trabalhosProcessados.slice(inicio, fim);

        
        const estatisticas = {
            total: total,
            pagina: pagina,
            limite: limite,
            totalPaginas: Math.ceil(total / limite),
            porStatus: {
                pendente: trabalhosProcessados.filter(t => t.status === 'pendente').length,
                aceito: trabalhosProcessados.filter(t => t.status === 'aceito').length,
                recusado: trabalhosProcessados.filter(t => t.status === 'recusado').length,
                necessita_alteracao: trabalhosProcessados.filter(t => t.status === 'necessita_alteracao').length
            },
            topicos: [...new Set(trabalhosProcessados.map(t => t.topico))].sort()
        };

        return NextResponse.json({
            trabalhos: trabalhosPaginados,
            estatisticas: estatisticas,
            filtros: {
                query,
                topico,
                status,
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

