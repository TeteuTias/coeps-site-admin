'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Download, Users, FileText, Eye, CheckCircle, XCircle, AlertCircle, MessageSquare, Save } from 'lucide-react';
import './style.css';

interface Document {
  _id: string;
  name: string;
  url: string;
  userId: string;
}

interface User {
  _id: string;
  informacoes_usuario: {
    cpf: string;
    numero_telefone: string;
    nome: string;
    email: string;
    data_criacao: string;
    titulo_honorario: string;
  };
}

interface TrabalhoAvaliacao {
  _id: string;
  userId: string;
  documentId: string;
  status: 'pendente' | 'aceito' | 'recusado' | 'necessita_alteracao';
  avaliadorComentarios: string;
  dataAvaliacao?: string;
  avaliadorId?: string;
}

interface DataStructure {
  data: Record<string, Document[]>;
  tradutor: Record<string, User>;
  avaliacoes: Record<string, TrabalhoAvaliacao[]>;
}

// Função utilitária para formatar CPF
function formatCPF(cpf: string) {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Função utilitária para formatar telefone
function formatPhone(phone: string) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

const AvaliarTrabalhos = () => {
  const [data, setData] = useState<DataStructure>({
    data: {},
    tradutor: {},
    avaliacoes: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/get/trabalhos-avaliacoes');
        if (!response.ok) {
          throw new Error('Erro na resposta da rede');
        }
        const result = await response.json();
        setData(result);
        
        // Inicializar comentários com os existentes
        const comentariosIniciais: Record<string, string> = {};
        Object.values(result.avaliacoes).flat().forEach((avaliacao: TrabalhoAvaliacao) => {
          comentariosIniciais[avaliacao.documentId] = avaliacao.avaliadorComentarios || '';
        });
        setComentarios(comentariosIniciais);
      } catch (error) {
        setError("OCORREU ALGO ERRADO. RECARREGUE");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Função para filtrar usuários por nome, CPF ou telefone
  const filterUser = (user: User) => {
    const nome = user.informacoes_usuario.nome?.toLowerCase() || "";
    const cpf = formatCPF(user.informacoes_usuario.cpf);
    const telefone = formatPhone(user.informacoes_usuario.numero_telefone);
    const termo = search.toLowerCase();
    return (
      nome.includes(termo) ||
      cpf.replace(/\D/g, "").includes(termo.replace(/\D/g, "")) ||
      telefone.replace(/\D/g, "").includes(termo.replace(/\D/g, ""))
    );
  };

  // Função para obter status de um documento
  const getDocumentStatus = (documentId: string, userId: string): TrabalhoAvaliacao | null => {
    const avaliacoesUsuario = data.avaliacoes[userId];
    if (!avaliacoesUsuario) return null;
    return avaliacoesUsuario.find(av => av.documentId === documentId) || null;
  };

  // Função para salvar avaliação
  const salvarAvaliacao = async (documentId: string, userId: string, status: string) => {
    setSalvandoAvaliacao(prev => ({ ...prev, [documentId]: true }));
    
    try {
      const response = await fetch('/api/post/avaliar-trabalho', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          userId,
          status,
          avaliadorComentarios: comentarios[documentId] || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar avaliação');
      }

      // Atualizar dados localmente
      const novaAvaliacao: TrabalhoAvaliacao = {
        _id: `${documentId}_${userId}`,
        userId,
        documentId,
        status: status as any,
        avaliadorComentarios: comentarios[documentId] || '',
        dataAvaliacao: new Date().toISOString(),
      };

      setData(prev => ({
        ...prev,
        avaliacoes: {
          ...prev.avaliacoes,
          [userId]: [
            ...(prev.avaliacoes[userId] || []).filter(av => av.documentId !== documentId),
            novaAvaliacao
          ]
        }
      }));

      alert('Avaliação salva com sucesso!');
    } catch (error) {
      alert('Erro ao salvar avaliação. Tente novamente.');
    } finally {
      setSalvandoAvaliacao(prev => ({ ...prev, [documentId]: false }));
    }
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aceito': return 'var(--verde)';
      case 'recusado': return 'var(--vermelho)';
      case 'necessita_alteracao': return 'var(--laranja)';
      default: return 'var(--cinza)';
    }
  };

  // Função para obter ícone do status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aceito': return <CheckCircle size={18} />;
      case 'recusado': return <XCircle size={18} />;
      case 'necessita_alteracao': return <AlertCircle size={18} />;
      default: return <Eye size={18} />;
    }
  };

  // Filtrar trabalhos por status
  const filtrarPorStatus = (userId: string, documents: Document[]) => {
    if (filtroStatus === 'todos') return true;
    
    return documents.some(doc => {
      const avaliacao = getDocumentStatus(doc._id, userId);
      const status = avaliacao?.status || 'pendente';
      return status === filtroStatus;
    });
  };

  if (loading) {
    return (
      <div className="trabalhos-loading-container" style={{
        background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="trabalhos-spinner"></div>
        <span className="trabalhos-loading-text">Carregando trabalhos para avaliação...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="trabalhos-main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <h1 className="trabalhos-title">AVALIAÇÃO DE TRABALHOS</h1>
      
      <div className="trabalhos-estatisticas">
        <div className="trabalhos-estatistica-card">
          <Users size={32} style={{marginBottom: '0.3rem', color: 'var(--azul)'}} />
          <span className="trabalhos-estatistica-valor">{Object.keys(data.data).length}</span>
          <span className="trabalhos-estatistica-label">Total de Pessoas</span>
        </div>
        <div className="trabalhos-estatistica-card">
          <FileText size={32} style={{marginBottom: '0.3rem', color: 'var(--carmin)'}} />
          <span className="trabalhos-estatistica-valor">{Object.keys(data.data).reduce((accumulator, key) => {
            return accumulator + data.data[key].length;
          }, 0)}</span>
          <span className="trabalhos-estatistica-label">Total de Trabalhos</span>
        </div>
      </div>

      <div className="trabalhos-filtros-container">
        <div className="trabalhos-busca-container">
          <input
            type="text"
            className="trabalhos-busca"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div className="trabalhos-filtro-status">
          <select 
            value={filtroStatus} 
            onChange={e => setFiltroStatus(e.target.value)}
            className="trabalhos-select-status"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="aceito">Aceito</option>
            <option value="recusado">Recusado</option>
            <option value="necessita_alteracao">Necessita Alteração</option>
          </select>
        </div>
      </div>

      <div className="trabalhos-lista">
        {Object.entries(data.data)
          .filter(([userId, documents]) => {
            const userInfo = data.tradutor[userId];
            if (!userInfo) return false;
            return filterUser(userInfo) && filtrarPorStatus(userId, documents);
          })
          .map(([userId, documents], idx) => {
            const userInfo = data.tradutor[userId];
            return (
              <div key={userId} className="trabalhos-card-avaliacao fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }}>
                {userInfo ? (
                  <>
                    <h2 className="trabalhos-nome">{userInfo.informacoes_usuario.nome}</h2>
                    <div className="trabalhos-cpf">{formatCPF(userInfo.informacoes_usuario.cpf)}</div>
                    <h3 className="trabalhos-telefone">{formatPhone(userInfo.informacoes_usuario.numero_telefone)}</h3>
                  </>
                ) : (
                  <p className="trabalhos-user-notfound">Usuário não encontrado</p>
                )}
                
                <div className="trabalhos-documentos">
                  {documents.map(doc => {
                    const avaliacao = getDocumentStatus(doc._id, userId);
                    const status = avaliacao?.status || 'pendente';
                    
                    return (
                      <div key={doc._id} className="trabalho-documento-item">
                        <div className="documento-header">
                          <Link target='_blank' href={doc.url} prefetch={true} className="trabalhos-link">
                            <Download size={18} style={{marginRight: '0.4em', minWidth: 18}} />
                            {doc.name}
                          </Link>
                          
                          <div className="documento-status" style={{ color: getStatusColor(status) }}>
                            {getStatusIcon(status)}
                            <span>{status.replace('_', ' ').toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="avaliacao-section">
                          <div className="botoes-avaliacao">
                            <button 
                              className={`btn-avaliacao btn-aceitar ${status === 'aceito' ? 'active' : ''}`}
                              onClick={() => salvarAvaliacao(doc._id, userId, 'aceito')}
                              disabled={salvandoAvaliacao[doc._id]}
                            >
                              <CheckCircle size={16} />
                              Aceitar
                            </button>
                            
                            <button 
                              className={`btn-avaliacao btn-necessita-alteracao ${status === 'necessita_alteracao' ? 'active' : ''}`}
                              onClick={() => salvarAvaliacao(doc._id, userId, 'necessita_alteracao')}
                              disabled={salvandoAvaliacao[doc._id]}
                            >
                              <AlertCircle size={16} />
                              Necessita Alteração
                            </button>
                            
                            <button 
                              className={`btn-avaliacao btn-recusar ${status === 'recusado' ? 'active' : ''}`}
                              onClick={() => salvarAvaliacao(doc._id, userId, 'recusado')}
                              disabled={salvandoAvaliacao[doc._id]}
                            >
                              <XCircle size={16} />
                              Recusar
                            </button>
                          </div>

                          <div className="comentarios-section">
                            <label className="comentarios-label">
                              <MessageSquare size={16} />
                              Comentários do Avaliador:
                            </label>
                            <textarea
                              className="comentarios-textarea"
                              placeholder="Adicione comentários sobre o trabalho (obrigatório para 'Necessita Alteração')..."
                              value={comentarios[doc._id] || ''}
                              onChange={(e) => setComentarios(prev => ({
                                ...prev,
                                [doc._id]: e.target.value
                              }))}
                              rows={3}
                            />
                            
                            <button 
                              className="btn-salvar-comentario"
                              onClick={() => salvarAvaliacao(doc._id, userId, status)}
                              disabled={salvandoAvaliacao[doc._id]}
                            >
                              <Save size={16} />
                              {salvandoAvaliacao[doc._id] ? 'Salvando...' : 'Salvar Comentários'}
                            </button>
                          </div>

                          {avaliacao?.dataAvaliacao && (
                            <div className="avaliacao-info">
                              <small>Última avaliação: {new Date(avaliacao.dataAvaliacao).toLocaleString('pt-BR')}</small>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default AvaliarTrabalhos;

