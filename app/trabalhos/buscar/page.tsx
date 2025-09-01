'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, Filter, Download, Eye, Calendar, User, Tag, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import './style.css';

interface TrabalhoResultado {
  _id: string;
  filename: string;
  url: string;
  userId: string;
  topico: string;
  subtopico?: string;
  palavrasChave: string[];
  resumo?: string;
  dataUpload: string;
  status: 'pendente' | 'aceito' | 'recusado' | 'necessita_alteracao';
  autor: {
    nome: string;
    email: string;
    cpf: string;
    telefone: string;
  };
}

interface EstatisticasBusca {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  porStatus: {
    pendente: number;
    aceito: number;
    recusado: number;
    necessita_alteracao: number;
  };
  topicos: string[];
}

const BuscarTrabalhos = () => {
  const [trabalhos, setTrabalhos] = useState<TrabalhoResultado[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasBusca | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  
  // Parâmetros de busca
  const [query, setQuery] = useState("");
  const [topico, setTopico] = useState("");
  const [status, setStatus] = useState("");
  const [autor, setAutor] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [ordenacao, setOrdenacao] = useState("data");
  const [direcao, setDirecao] = useState("desc");
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(20);
  
  // Estado dos filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  useEffect(() => {
    if (query || topico || status || autor || dataInicio || dataFim) {
      buscarTrabalhos();
    }
  }, [pagina, ordenacao, direcao]);

  const buscarTrabalhos = async () => {
    setLoading(true);
    setError("");
    
    try {
      const params = new URLSearchParams({
        q: query,
        topico: topico,
        status: status,
        autor: autor,
        dataInicio: dataInicio,
        dataFim: dataFim,
        ordenacao: ordenacao,
        direcao: direcao,
        pagina: pagina.toString(),
        limite: limite.toString()
      });

      const response = await fetch(`/api/get/buscar-trabalhos?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro na busca');
      }
      
      const result = await response.json();
      setTrabalhos(result.trabalhos);
      setEstatisticas(result.estatisticas);
    } catch (error) {
      setError("Erro ao buscar trabalhos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = () => {
    setPagina(1);
    buscarTrabalhos();
  };

  const limparFiltros = () => {
    setQuery("");
    setTopico("");
    setStatus("");
    setAutor("");
    setDataInicio("");
    setDataFim("");
    setPagina(1);
    setTrabalhos([]);
    setEstatisticas(null);
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aceito': return '#10b981';
      case 'recusado': return '#ef4444';
      case 'necessita_alteracao': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Função para formatar data
  const formatarData = (dataString: string): string => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Navegação de páginas
  const irParaPagina = (novaPagina: number) => {
    if (novaPagina >= 1 && novaPagina <= (estatisticas?.totalPaginas || 1)) {
      setPagina(novaPagina);
    }
  };

  return (
    <div className="buscar-main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="buscar-container">
        <h1 className="buscar-title">BUSCAR TRABALHOS</h1>
        
        {/* Barra de Busca Principal */}
        <div className="busca-principal">
          <div className="busca-input-container">
            <Search size={20} />
            <input
              type="text"
              placeholder="Digite o nome do trabalho, autor ou palavra-chave..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="busca-input-principal"
              onKeyPress={e => e.key === 'Enter' && handleBuscar()}
            />
          </div>
          
          <button 
            className="btn-buscar"
            onClick={handleBuscar}
            disabled={loading}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          
          <button 
            className="btn-filtros"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {/* Filtros Avançados */}
        {mostrarFiltros && (
          <div className="filtros-avancados">
            <h3>Filtros Avançados</h3>
            
            <div className="filtros-grid">
              <div className="filtro-grupo">
                <label>Tópico/Palavra-chave:</label>
                <input
                  type="text"
                  placeholder="Ex: inteligência artificial, web..."
                  value={topico}
                  onChange={e => setTopico(e.target.value)}
                  className="filtro-input"
                />
              </div>
              
              <div className="filtro-grupo">
                <label>Autor:</label>
                <input
                  type="text"
                  placeholder="Nome ou email do autor..."
                  value={autor}
                  onChange={e => setAutor(e.target.value)}
                  className="filtro-input"
                />
              </div>
              
              <div className="filtro-grupo">
                <label>Status:</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)}
                  className="filtro-select"
                >
                  <option value="">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="aceito">Aceito</option>
                  <option value="recusado">Recusado</option>
                  <option value="necessita_alteracao">Necessita Alteração</option>
                </select>
              </div>
              
              <div className="filtro-grupo">
                <label>Data Início:</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="filtro-input"
                />
              </div>
              
              <div className="filtro-grupo">
                <label>Data Fim:</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="filtro-input"
                />
              </div>
              
              <div className="filtro-grupo">
                <label>Ordenar por:</label>
                <select 
                  value={ordenacao} 
                  onChange={e => setOrdenacao(e.target.value)}
                  className="filtro-select"
                >
                  <option value="data">Data</option>
                  <option value="nome">Nome</option>
                  <option value="autor">Autor</option>
                  <option value="topico">Tópico</option>
                  <option value="status">Status</option>
                </select>
              </div>
              
              <div className="filtro-grupo">
                <label>Direção:</label>
                <select 
                  value={direcao} 
                  onChange={e => setDirecao(e.target.value)}
                  className="filtro-select"
                >
                  <option value="desc">Decrescente</option>
                  <option value="asc">Crescente</option>
                </select>
              </div>
            </div>
            
            <div className="filtros-acoes">
              <button className="btn-aplicar-filtros" onClick={handleBuscar}>
                Aplicar Filtros
              </button>
              <button className="btn-limpar-filtros" onClick={limparFiltros}>
                Limpar Filtros
              </button>
            </div>
          </div>
        )}

        {/* Estatísticas da Busca */}
        {estatisticas && (
          <div className="estatisticas-busca">
            <div className="estatisticas-info">
              <span className="total-resultados">
                {estatisticas.total} trabalho(s) encontrado(s)
              </span>
              
              <div className="estatisticas-status">
                <span className="status-item aceito">
                  {estatisticas.porStatus.aceito} aceitos
                </span>
                <span className="status-item pendente">
                  {estatisticas.porStatus.pendente} pendentes
                </span>
                <span className="status-item recusado">
                  {estatisticas.porStatus.recusado} recusados
                </span>
                {estatisticas.porStatus.necessita_alteracao > 0 && (
                  <span className="status-item alteracao">
                    {estatisticas.porStatus.necessita_alteracao} necessitam alteração
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resultados da Busca */}
        {loading && (
          <div className="loading-busca">
            <div className="trabalhos-spinner"></div>
            <span>Buscando trabalhos...</span>
          </div>
        )}

        {error && (
          <div className="error-busca">
            {error}
          </div>
        )}

        {trabalhos.length > 0 && (
          <div className="resultados-busca">
            {trabalhos.map((trabalho, idx) => (
              <div key={trabalho._id} className="resultado-card fadeInUp" style={{ animationDelay: `${0.05 * idx}s` }}>
                <div className="resultado-header">
                  <div className="resultado-info">
                    <h3 className="resultado-titulo">{trabalho.filename}</h3>
                    
                    <div className="resultado-metadados">
                      <div className="metadado-item">
                        <User size={14} />
                        <span>{trabalho.autor.nome}</span>
                      </div>
                      
                      <div className="metadado-item">
                        <Calendar size={14} />
                        <span>{formatarData(trabalho.dataUpload)}</span>
                      </div>
                      
                      <div className="metadado-item">
                        <Tag size={14} />
                        <span>{trabalho.topico}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="resultado-acoes">
                    <div 
                      className="status-badge-resultado" 
                      style={{ backgroundColor: getStatusColor(trabalho.status) }}
                    >
                      {trabalho.status.replace('_', ' ').toUpperCase()}
                    </div>
                    
                    <div className="acoes-botoes">
                      <Link target='_blank' href={trabalho.url} className="btn-acao visualizar">
                        <Eye size={16} />
                        Ver
                      </Link>
                      
                      <Link target='_blank' href={trabalho.url} className="btn-acao download">
                        <Download size={16} />
                        Download
                      </Link>
                    </div>
                  </div>
                </div>

                {trabalho.subtopico && (
                  <div className="resultado-subtopico">
                    <strong>Subtópico:</strong> {trabalho.subtopico}
                  </div>
                )}

                {trabalho.palavrasChave.length > 0 && (
                  <div className="resultado-palavras-chave">
                    <strong>Palavras-chave:</strong>
                    <div className="palavras-tags">
                      {trabalho.palavrasChave.slice(0, 5).map((palavra, index) => (
                        <span key={index} className="palavra-tag">{palavra}</span>
                      ))}
                    </div>
                  </div>
                )}

                {trabalho.resumo && (
                  <div className="resultado-resumo">
                    <strong>Resumo:</strong>
                    <p>{trabalho.resumo}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {estatisticas && estatisticas.totalPaginas > 1 && (
          <div className="paginacao">
            <button 
              className="btn-pagina"
              onClick={() => irParaPagina(pagina - 1)}
              disabled={pagina === 1}
            >
              <ChevronLeft size={18} />
              Anterior
            </button>
            
            <div className="paginas-numeros">
              {Array.from({ length: Math.min(5, estatisticas.totalPaginas) }, (_, i) => {
                const numeroPagina = Math.max(1, Math.min(
                  estatisticas.totalPaginas - 4,
                  pagina - 2
                )) + i;
                
                return (
                  <button
                    key={numeroPagina}
                    className={`btn-numero-pagina ${pagina === numeroPagina ? 'ativo' : ''}`}
                    onClick={() => irParaPagina(numeroPagina)}
                  >
                    {numeroPagina}
                  </button>
                );
              })}
            </div>
            
            <button 
              className="btn-pagina"
              onClick={() => irParaPagina(pagina + 1)}
              disabled={pagina === estatisticas.totalPaginas}
            >
              Próxima
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {trabalhos.length === 0 && !loading && (query || topico || status || autor || dataInicio || dataFim) && (
          <div className="sem-resultados">
            <FileText size={64} style={{color: 'white', opacity: 0.5}} />
            <h3>Nenhum trabalho encontrado</h3>
            <p>Tente ajustar os filtros de busca ou usar termos diferentes.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuscarTrabalhos;

