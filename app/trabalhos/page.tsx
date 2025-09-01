'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, FileText, Download, Eye, MessageSquare, CheckCircle, XCircle, AlertCircle, Calendar, User, Filter, Tag, BookOpen, Save } from 'lucide-react';
import './style.css';

interface TrabalhoCompleto {
  _id: string;
  userId: string;
  titulo: string;
  modalidade: string;
  autores: {
    nome: string;
    email: string;
    cpf: string;
    isOrientador: boolean;
    isPagante: boolean;
  }[];
  arquivo: {
    fileId: string;
    fileName: string;
    url: string;
  };
  topicos: {
    intro: string;
    obj: string;
    met: string;
    disc: string;
    conc: string;
    pchave: string;
    ref: string;
  };
  palavrasChave: string[];
  status: "Em Avaliação" | "Aceito" | "Recusado" | "Necessita de Alteração";
  dataSubmissao: string;
  avaliadorComentarios: string;
  dataAvaliacao?: string;
  avaliadorId?: string;
  usuario: {
    nome: string;
    email: string;
    cpf: string;
    telefone: string;
  };
}

interface EstatisticasTrabalhos {
  total: number;
  emAvaliacao: number;
  aceitos: number;
  recusados: number;
  necessitamAlteracao: number;
  modalidades: string[];
  topicos: { topico: string; quantidade: number; }[];
}

const TrabalhosPainel = () => {
  const [trabalhos, setTrabalhos] = useState<TrabalhoCompleto[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasTrabalhos>({
    total: 0,
    emAvaliacao: 0,
    aceitos: 0,
    recusados: 0,
    necessitamAlteracao: 0,
    modalidades: [],
    topicos: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroModalidade, setFiltroModalidade] = useState<string>("todos");
  const [buscaTexto, setBuscaTexto] = useState("");
  
  // Estados para avaliação
  const [avaliacaoAtiva, setAvaliacaoAtiva] = useState<string | null>(null);
  const [comentarios, setComentarios] = useState<{[key: string]: string}>({});
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState<string | null>(null);

  useEffect(() => {
    fetchTrabalhos();
  }, []);

  const fetchTrabalhos = async () => {
    try {
      const response = await fetch('/api/get/trabalhos-dados');
      if (!response.ok) {
        throw new Error('Erro na resposta da rede');
      }
      const result = await response.json();
      setTrabalhos(result.trabalhos);
      setEstatisticas(result.estatisticas);
      
      // Inicializar comentários com os existentes
      const comentariosIniciais: {[key: string]: string} = {};
      result.trabalhos.forEach((trabalho: TrabalhoCompleto) => {
        comentariosIniciais[trabalho._id] = trabalho.avaliadorComentarios || '';
      });
      setComentarios(comentariosIniciais);
    } catch (error) {
      setError("Erro ao carregar trabalhos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Função para salvar avaliação
  const salvarAvaliacao = async (trabalhoId: string, status: string) => {
    setSalvandoAvaliacao(trabalhoId);
    
    try {
      const response = await fetch('/api/post/avaliar-trabalho-dados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trabalhoId,
          status,
          comentarios: comentarios[trabalhoId] || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar avaliação');
      }

      // Atualizar trabalho localmente
      setTrabalhos(prev => prev.map(trabalho => 
        trabalho._id === trabalhoId 
          ? { 
              ...trabalho, 
              status: status as any,
              avaliadorComentarios: comentarios[trabalhoId] || '',
              dataAvaliacao: new Date().toISOString()
            }
          : trabalho
      ));

      // Atualizar estatísticas
      fetchTrabalhos();
      
      alert('Avaliação salva com sucesso!');
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar avaliação. Tente novamente.');
    } finally {
      setSalvandoAvaliacao(null);
    }
  };

  // Função para filtrar trabalhos
  const trabalhosFiltrados = trabalhos.filter(trabalho => {
    
    
    const statusMatch = filtroStatus === 'todos' || trabalho.status === filtroStatus;
    const modalidadeMatch = filtroModalidade === 'todos' || trabalho.modalidade === filtroModalidade;
    
    return statusMatch && modalidadeMatch;
  });

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aceito': return '#10b981';
      case 'Recusado': return '#ef4444';
      case 'Necessita de Alteração': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Função para obter ícone do status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Aceito': return <CheckCircle size={18} />;
      case 'Recusado': return <XCircle size={18} />;
      case 'Necessita de Alteração': return <AlertCircle size={18} />;
      default: return <Eye size={18} />;
    }
  };

  // Função para formatar data
  const formatarData = (dataString: string): string => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
    return (
      <div className="trabalhos-error-container" style={{
        background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="error-message">{error}</div>
        <button onClick={fetchTrabalhos} className="btn-retry">
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="trabalhos-main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="trabalhos-container">
        <h1 className="trabalhos-title">AVALIAÇÃO DE TRABALHOS</h1>
        
        {/* Estatísticas */}
        <div className="trabalhos-estatisticas">
          <div className="trabalhos-estatistica-card">
            <FileText size={32} style={{color: 'var(--azul)'}} />
            <span className="trabalhos-estatistica-valor">{estatisticas.total}</span>
            <span className="trabalhos-estatistica-label">Total de Trabalhos</span>
          </div>
          <div className="trabalhos-estatistica-card">
            <Eye size={32} style={{color: '#6b7280'}} />
            <span className="trabalhos-estatistica-valor">{estatisticas.emAvaliacao}</span>
            <span className="trabalhos-estatistica-label">Em Avaliação</span>
          </div>
          <div className="trabalhos-estatistica-card">
            <CheckCircle size={32} style={{color: '#10b981'}} />
            <span className="trabalhos-estatistica-valor">{estatisticas.aceitos}</span>
            <span className="trabalhos-estatistica-label">Aceitos</span>
          </div>
          <div className="trabalhos-estatistica-card">
            <XCircle size={32} style={{color: '#ef4444'}} />
            <span className="trabalhos-estatistica-valor">{estatisticas.recusados}</span>
            <span className="trabalhos-estatistica-label">Recusados</span>
          </div>
          <div className="trabalhos-estatistica-card">
            <AlertCircle size={32} style={{color: '#f59e0b'}} />
            <span className="trabalhos-estatistica-valor">{estatisticas.necessitamAlteracao}</span>
            <span className="trabalhos-estatistica-label">Necessitam Alteração</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="trabalhos-filtros-container">
          
          
          <div className="trabalhos-filtro-status">
            <select 
              value={filtroStatus} 
              onChange={e => setFiltroStatus(e.target.value)}
              className="trabalhos-select-status"
            >
              <option value="todos">Todos os Status</option>
              <option value="Em Avaliação">Em Avaliação</option>
              <option value="Aceito">Aceito</option>
              <option value="Recusado">Recusado</option>
              <option value="Necessita de Alteração">Necessita de Alteração</option>
            </select>
          </div>

          <div className="trabalhos-filtro-modalidade">
            <select 
              value={filtroModalidade} 
              onChange={e => setFiltroModalidade(e.target.value)}
              className="trabalhos-select-status"
            >
              <option value="todos">Todas as Modalidades</option>
              {estatisticas.modalidades.map(modalidade => (
                <option key={modalidade} value={modalidade}>{modalidade}</option>
              ))}
            </select>
          </div>
        </div>

      
        {/* Lista de Trabalhos */}
        <div className="trabalhos-lista">
          {trabalhosFiltrados.map((trabalho, idx) => (
            <div key={trabalho._id} className="trabalhos-card-avaliacao fadeInUp" style={{ animationDelay: `${0.05 * idx}s` }}>
              <div className="trabalho-header">
                <div className="trabalho-info-principal">
                  <h2 className="trabalho-titulo">{trabalho.titulo}</h2>
                  <div className="trabalho-modalidade">
                    <BookOpen size={16} />
                    <span>{trabalho.modalidade}</span>
                  </div>
                  <div className="trabalho-data">
                    <Calendar size={16} />
                    <span>Submetido em: {formatarData(trabalho.dataSubmissao)}</span>
                  </div>
                </div>
                
                <div className="trabalho-status-container">
                  <div className="documento-status" style={{ color: getStatusColor(trabalho.status) }}>
                    {getStatusIcon(trabalho.status)}
                    <span>{trabalho.status}</span>
                  </div>
                </div>
              </div>

              {/* Informações dos Autores */}
              <div className="trabalho-autores">
                <h4>Autores:</h4>
                {trabalho.autores.map((autor, index) => (
                  <div key={index} className="autor-item">
                    <User size={14} />
                    <span>{autor.nome}</span>
                    {autor.isOrientador && <span className="badge-orientador">Orientador</span>}
                    {autor.isPagante && <span className="badge-pagante">Pagante</span>}
                  </div>
                ))}
              </div>

              {/* Arquivo */}
              <div className="trabalho-arquivo">
                <Link target='_blank' href={trabalho.arquivo.url} className="trabalhos-link">
                  <Download size={18} />
                  {trabalho.arquivo.fileName}
                </Link>
                <Link target='_blank' href={trabalho.arquivo.url} className="btn-visualizar-arquivo">
                  <Eye size={16} />
                  Visualizar
                </Link>
              </div>

            
              <div className="trabalho-topicos-detalhes">
                <div className="topicos-resumo">
                  <h4>Resumo dos Tópicos:</h4>
                   <div className="topico-item">
                    <strong>Resumo:</strong> {(trabalho.topicos?.intro || "").substring(0, 5000)}
                  </div>
                  <div className="topico-item">
                    <strong>Introdução:</strong> {(trabalho.topicos?.intro || "").substring(0, 500)}
                  </div>
                  <div className="topico-item">
                    <strong>Objetivos:</strong> {(trabalho.topicos?.obj || "").substring(0, 500)}
                  </div>
                  <div className="topico-item">
                    <strong>Metodologia:</strong> {(trabalho.topicos?.met || "").substring(0, 500)}
                  </div>
                  <div className="topico-item">
                    <strong>Discussão:</strong> {(trabalho.topicos?.disc || "").substring(0, 500)}
                  </div>
                  <div className="topico-item">
                    <strong>Conclusão:</strong> {(trabalho.topicos?.conc || "").substring(0, 500)}
                  </div>
                  <div className="topico-item">
                    <strong>Palavras-Chave:</strong> {(trabalho.topicos?.pchave || "").substring(0, 100)}
                  </div>
                  <div className="topico-item">
                    <strong>Referências:</strong> {(trabalho.topicos?.ref || "").substring(0, 100)}
                  </div>
                </div>
                
                {trabalho.palavrasChave?.length > 0 && (
  <div className="palavras-chave-container">
    <h4>Palavras-chave:</h4>
    <div className="palavras-chave-tags">
      {trabalho.palavrasChave.map((palavra, index) => (
        <span key={index} className="palavra-tag">{palavra}</span>
      ))}
    </div>
  </div>
)}
              </div>

              {/* Seção de Avaliação */}
              <div className="avaliacao-section">
                <div className="botoes-avaliacao">
                  <button 
                    className={`btn-avaliacao btn-aceitar ${trabalho.status === 'Aceito' ? 'active' : ''}`}
                    onClick={() => salvarAvaliacao(trabalho._id, 'Aceito')}
                    disabled={salvandoAvaliacao === trabalho._id}
                  >
                    <CheckCircle size={16} />
                    Aceitar
                  </button>
                  
                  <button 
                    className={`btn-avaliacao btn-necessita-alteracao ${trabalho.status === 'Necessita de Alteração' ? 'active' : ''}`}
                    onClick={() => salvarAvaliacao(trabalho._id, 'Necessita de Alteração')}
                    disabled={salvandoAvaliacao === trabalho._id}
                  >
                    <AlertCircle size={16} />
                    Necessita Alteração
                  </button>
                  
                  <button 
                    className={`btn-avaliacao btn-recusar ${trabalho.status === 'Recusado' ? 'active' : ''}`}
                    onClick={() => salvarAvaliacao(trabalho._id, 'Recusado')}
                    disabled={salvandoAvaliacao === trabalho._id}
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
                    placeholder="Adicione comentários sobre o trabalho (obrigatório para 'Necessita de Alteração')..."
                    value={comentarios[trabalho._id] || ''}
                    onChange={(e) => setComentarios(prev => ({
                      ...prev,
                      [trabalho._id]: e.target.value
                    }))}
                    rows={3}
                  />
                  
                  <button 
                    className="btn-salvar-comentario"
                    onClick={() => salvarAvaliacao(trabalho._id, trabalho.status)}
                    disabled={salvandoAvaliacao === trabalho._id}
                  >
                    <Save size={16} />
                    {salvandoAvaliacao === trabalho._id ? 'Salvando...' : 'Salvar Comentários'}
                  </button>
                </div>

                {trabalho.dataAvaliacao && (
                  <div className="avaliacao-info">
                    <small>Última avaliação: {formatarData(trabalho.dataAvaliacao)}</small>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {trabalhosFiltrados.length === 0 && (
          <div className="sem-trabalhos">
            <FileText size={64} style={{color: 'white', opacity: 0.5}} />
            <h3>Nenhum trabalho encontrado</h3>
            <p>Tente ajustar os filtros de busca.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrabalhosPainel;

