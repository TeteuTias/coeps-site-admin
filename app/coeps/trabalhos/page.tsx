'use client'
import * as XLSX from 'xlsx';
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { useEffect, useState, useMemo, FC } from 'react';
import { Users, FileText, ChevronUp, ChevronDown, Paperclip, Info, Download, UserCircle, MessageSquare, Edit, PieChart, Search, Filter, File } from 'lucide-react';
import { IAcademicWorks } from '@/app/lib/types/academicWorks/academicWorks.t';
import { ObjectId } from 'bson';
import { IUser } from '../../lib/types/user/user.t';
import { useRouter } from 'next/navigation';
import './style.css';

// Componente de Loading Personalizado
const TrabalhosLoadingModal = ({ isLoading }: { isLoading: boolean }) => {
  if (!isLoading) return null;
  
  return (
    <div className="trabalhos-loading-container">
      <div className="trabalhos-loading-spinner"></div>
      <div className="trabalhos-loading-text">
        Carregando<span className="trabalhos-loading-dots">...</span>
      </div>
    </div>
  );
};

// Paleta de Cores e Tema Inspirados em coeps.com.br
const theme = {
  colors: {
    primary: '#003366', // Azul Escuro
    accent: '#ff6200ff',  // Laranja Vibrante
    background: '#f8f9fa', // Fundo Cinza Claro
    surface: '#ffffff', // Superfície Branca (Cards)
    textPrimary: '#212529',
    textSecondary: '#6c757d',
    border: '#dee2e6',
    success: '#198754',
    danger: '#dc3545',
    warning: '#ffc107',
  },
  shadows: {
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.1)',
  }
};

// Função Utilitária
// Dentro do componente AvaliarTrabalhoPage
const getTextoResultados = (count: number): string => {
  if (count === 0) {
    return 'Nenhum trabalho encontrado com os filtros atuais.';
  }
  if (count === 1) {
    return '1 trabalho encontrado.';
  }
  return `${count} trabalhos encontrados.`;
};

// Função Utilitária
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/******************************************
 * COMPONENTE PRINCIPAL DA PÁGINA
 ******************************************/
export default function AvaliarTrabalhoPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [trabalhos, setTrabalhos] = useState<IAcademicWorks[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);

  // Estados para os filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  const toggleFichaAvalicaoProps = (
    fichaId: ObjectId,
    indexAcademicWork: number,
    newProps: Partial<IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"][number]>
  ) => {
    setTrabalhos((prevTrabalhos) => {
      const updatedTrabalhos = [...prevTrabalhos];
      // Encontra o trabalho correto no array original para garantir que o índice seja válido
      const trabalhoToUpdate = updatedTrabalhos[indexAcademicWork];
      if (!trabalhoToUpdate) return prevTrabalhos;

      const updatedFichaAvaliacao = [...trabalhoToUpdate.configuracaoModalidade.ficha_avalicao];
      const fichaIndex = updatedFichaAvaliacao.findIndex((ficha) => `${ficha._id}` === `${fichaId}`);
      if (fichaIndex === -1) return prevTrabalhos;

      updatedFichaAvaliacao[fichaIndex] = { ...updatedFichaAvaliacao[fichaIndex], ...newProps };
      updatedTrabalhos[indexAcademicWork] = {
        ...trabalhoToUpdate,
        configuracaoModalidade: {
          ...trabalhoToUpdate.configuracaoModalidade,
          ficha_avalicao: updatedFichaAvaliacao,
        },
      };

      return updatedTrabalhos;
    });
  };

  const hydrateData = useMemo(() => async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/get/trabalhos-avaliacoes');
      if (!response.ok) throw new Error('Falha ao buscar dados');
      const { data, users } = await response.json();
      setTrabalhos(data.reverse());
      setUsers(users);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadInfos = async () => {
    setIsLoading(true)
    // A. Converte os dados JSON em uma 'worksheet' (planilha)
    const newData: {
      "ID TRABALHO": string,
      "TITULO": string,
      "AUTOR PRINCIPAL": string,
      "TELEFONE": string,
      "E-MAIL": string,
    }[] = trabalhos.map((trabalho) => {
      const donoTrabalho = users.find((u) => `${u._id}` === `${trabalho.userId}`)?.informacoes_usuario
      return {
        "ID TRABALHO": `${trabalho._id}`,
        "TITULO": `${trabalho.titulo}`,
        "AUTOR PRINCIPAL": donoTrabalho?.nome || "NÃO ENCONTRADO",
        "TELEFONE": donoTrabalho?.numero_telefone || "NÃO ENCONTRADO",
        "E-MAIL": donoTrabalho?.email || "NÃO ENCONTRADO"
      }
    }
    )
    const worksheet = XLSX.utils.json_to_sheet(newData);

    // B. Cria um novo 'workbook' (livro de trabalho/arquivo Excel)
    const workbook = XLSX.utils.book_new();

    // C. Adiciona a worksheet ao workbook
    // O segundo argumento ('Dados') é o nome da aba da planilha
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');

    // D. Escreve o arquivo no formato binário (necessário para o download)
    XLSX.writeFile(workbook, "Trabalhos.xlsx");
    setIsLoading(false)
  }

  useEffect(() => {
    hydrateData();
  }, [hydrateData]);

  // Lógica de cálculo de estatísticas
  const stats = useMemo(() => {
    return trabalhos.reduce((acc, trabalho) => {
      const status = trabalho.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }, [trabalhos]);

  // Lógica de filtragem dos trabalhos
  const filteredTrabalhos = useMemo(() => {
    return trabalhos.filter(trabalho => {
      const matchesStatus = statusFilter === 'Todos' || trabalho.status === statusFilter;
      const matchesSearch = trabalho.titulo.toLowerCase().includes(searchQuery.toLowerCase()) || trabalho.autores.filter((t) => t.nome.toLowerCase().includes(searchQuery.toLowerCase())).length > 0;
      return matchesStatus && matchesSearch;
    });
  }, [trabalhos, searchQuery, statusFilter]);

  const statusOptionsFiltro = ["Todos", "Aceito", "Recusado", "Necessita de Alteração", "Em Avaliação"];


  return (
    <div className="trabalhos-main-container">
      <TrabalhosLoadingModal isLoading={isLoading} />
      <div className="trabalhos-content-wrapper">
        <header className="trabalhos-header">
          <h1 className="trabalhos-title">Painel de Avaliação</h1>
          <p className="trabalhos-subtitle">Revise, filtre e avalie os trabalhos acadêmicos submetidos.</p>
        </header>

        {/* Seção de Estatísticas */}
        {!isLoading && (
          <div className="trabalhos-stats-container">
            <h2 className="trabalhos-stats-title">
              <PieChart className="inline-block mr-2" />
              Estatísticas Gerais
            </h2>
            <div className="trabalhos-stats-grid">
              <div className="trabalhos-stat-card">
                <div className="trabalhos-stat-value">{trabalhos.length}</div>
                <div className="trabalhos-stat-label">Total de Trabalhos</div>
              </div>
              <div className="trabalhos-stat-card">
                <div className="trabalhos-stat-value">{stats['Aceito'] || 0}</div>
                <div className="trabalhos-stat-label">Aceitos</div>
              </div>
              <div className="trabalhos-stat-card">
                <div className="trabalhos-stat-value">{stats['Recusado'] || 0}</div>
                <div className="trabalhos-stat-label">Recusados</div>
              </div>
              <div className="trabalhos-stat-card">
                <div className="trabalhos-stat-value">{stats['Necessita de Alteração'] || 0}</div>
                <div className="trabalhos-stat-label">Necessitam Alteração</div>
              </div>
              <div className="trabalhos-stat-card">
                <div className="trabalhos-stat-value">{stats['Em Avaliação'] || 0}</div>
                <div className="trabalhos-stat-label">Em Avaliação</div>
              </div>
            </div>
          </div>
        )}

        {/* Seção de Filtros */}
        {!isLoading && (
          <div className="trabalhos-filters-container">
            <h2 className="trabalhos-filters-title">
              <Filter className="inline-block mr-2" />
              Filtros de Pesquisa
            </h2>
            <div className="trabalhos-filters-grid">
              <div className="trabalhos-search-container">
                <Search className="trabalhos-search-icon" />
                <input
                  type="text"
                  placeholder="Pesquisar por título do trabalho ou congressista..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="trabalhos-search-input"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="trabalhos-select"
              >
                {statusOptionsFiltro.map(opt => <option key={opt} value={opt}>{opt === 'Todos' ? 'Filtrar por Status (Todos)' : opt}</option>)}
              </select>
            </div>
          </div>
        )}
        {/* Botão de Download */}
        <div className="trabalhos-download-container">
          <button 
            className="trabalhos-download-btn"
            onClick={() => downloadInfos()}
          >
            <Download className="inline-block mr-2" />
            Baixar Informações
          </button>
        </div>

        {/* Container de Resultados */}
        <div className="trabalhos-results-container">
          <div className="trabalhos-results-info">
            <Info className="inline-block mr-2" />
            {getTextoResultados(filteredTrabalhos.length)}
          </div>
          {!isLoading && filteredTrabalhos.length > 0 ? (
            <div className="trabalhos-list">
              {filteredTrabalhos.map((trabalho) => {
                // Encontra o índice original para a função de toggle, pois o array filtrado tem outros índices
                const originalIndex = trabalhos.findIndex(t => t._id.toString() === trabalho._id.toString());
                return (
                  <TrabalhoComponent
                    key={`${trabalho._id}`}
                    user={users.find((user) => `${user._id}` === `${trabalho.userId}`)}
                    indexTrabalho={originalIndex}
                    toggleFichaAvalicaoProps={toggleFichaAvalicaoProps}
                    hydrateData={hydrateData}
                    data={trabalho}
                  />
                );
              })}
            </div>
          ) : (
            !isLoading && (
              <div className="trabalhos-empty">
                <h2 className="trabalhos-empty-title">Nenhum Trabalho Encontrado</h2>
                <p className="trabalhos-empty-text">Tente ajustar seus filtros de pesquisa ou aguarde novas submissões.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/******************************************
 * COMPONENTE DO CARD DE TRBALHO
 ******************************************/
const TrabalhoComponent: FC<{
  data: IAcademicWorks;
  user: IUser | undefined;
  indexTrabalho: number;
  hydrateData: () => Promise<void>;
  toggleFichaAvalicaoProps: (fichaId: ObjectId, indexAcademicWork: number, newProps: Partial<IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"][number]>) => void;
}> = ({ data, hydrateData, toggleFichaAvalicaoProps, indexTrabalho, user }) => {
  const [selectedStatus, setSelectedStatus] = useState<IAcademicWorks['status']>(data.status);
  const [newComentario, setNewComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  // Estados para as seções colapsáveis (inlined)
  const [autoresOpen, setAutoresOpen] = useState(false);
  const [arquivosOpen, setArquivosOpen] = useState(false);
  const [topicosOpen, setTopicosOpen] = useState(false);
  const [avaliacoesAnterioresOpen, setAvaliacoesAnterioresOpen] = useState(false);

  const handleAddAvaliacao = async () => {
    if (!newComentario.trim()) {
      setError('O campo de parecer não pode estar vazio.'); return;
    }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const response = await fetch("/api/post/avaliar-trabalho", {
        method: "POST", headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: data._id, userId: data.userId, status: selectedStatus, avaliadorComentarios: newComentario, ficha_avalicao: data.configuracaoModalidade.ficha_avalicao })
      });
      if (!response.ok) throw new Error('Falha ao enviar avaliação');
      alert("Avaliação feita com sucesso!")
      await hydrateData(); setNewComentario(''); setSuccess('Avaliação enviada com sucesso!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao enviar a avaliação.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions: IAcademicWorks['status'][] = ["Aceito", "Recusado", "Necessita de Alteração", "Em Avaliação"];
  const statusBadgeStyles: { [key in IAcademicWorks['status']]: string } = { 'Aceito': `bg-green-100 text-[${theme.colors.success}]`, 'Recusado': `bg-red-100 text-[${theme.colors.danger}]`, 'Em Avaliação': `bg-yellow-100 text-[${theme.colors.warning}]`, 'Necessita de Alteração': `bg-orange-100 text-[${theme.colors.accent}]` };

  return (
    <div className="trabalhos-card">
      {/* Cabeçalho do Card */}
      <div className="trabalhos-card-header">
        <div>
          <h1 className="trabalhos-card-title">{data.titulo}</h1>
          <div className="trabalhos-card-modalidade-badge">
            {data.modalidade}
          </div>
        </div>
        <div className="trabalhos-card-status-container">
          <div className={`trabalhos-card-status-badge ${data.status.toLowerCase().replace(/\s+/g, '-')}`}>
            {data.status}
          </div>
        </div>
      </div>
      <div className="trabalhos-card-info">
        <div className="trabalhos-card-info-item">
          <UserCircle className="w-4 h-4" />
          <span>Enviado por:</span>
          <button 
            onClick={() => router.push(`/usuarios/informacoes/${user?._id}`)} 
            className="trabalhos-card-info-link"
          >
            {user?.informacoes_usuario.nome || 'Usuário Desconhecido'}
          </button>
        </div>
        <div className="trabalhos-card-info-item">
          <span><strong>Data:</strong> {new Date(data.dataSubmissao).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* Seção de Autores */}
      <div className="trabalhos-card-section">
        <button 
          className="trabalhos-card-section-header" 
          onClick={() => setAutoresOpen(!autoresOpen)}
        >
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5" />
            <h2>Autores ({data.autores.length})</h2>
          </div>
          {autoresOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {autoresOpen && (
          <div className="trabalhos-card-section-content">
            <div className="trabalhos-autores-list">
              {data.autores.map((autor, index) => (
                <div key={index} className="trabalhos-autor-item">
                  <div className="trabalhos-autor-nome">
                    {autor.nome}
                    {autor.isOrientador && (
                      <span className="trabalhos-autor-orientador">Orientador</span>
                    )}
                  </div>
                  <div className="trabalhos-autor-email">Email: {autor.email}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seção de Arquivos */}
      <div className="trabalhos-card-section">
        <button 
          className="trabalhos-card-section-header" 
          onClick={() => setArquivosOpen(!arquivosOpen)}
        >
          <div className="flex items-center space-x-3">
            <Paperclip className="w-5 h-5" />
            <h2>Arquivos ({data.arquivos.length})</h2>
          </div>
          {arquivosOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {arquivosOpen && (
          <div className="trabalhos-card-section-content">
            <div className="trabalhos-arquivos-list">
              {data.arquivos.map((arquivo, index) => (
                <div key={index} className="trabalhos-arquivo-item">
                  <File className="trabalhos-arquivo-icon" />
                  <div className="trabalhos-arquivo-info">
                    <div className="trabalhos-arquivo-nome" title={arquivo.originalName}>
                      {arquivo.originalName}
                    </div>
                    <div className="trabalhos-arquivo-detalhes">
                      <span>{formatBytes(arquivo.size)}</span>
                      <span>•</span>
                      <time dateTime={new Date(arquivo.uploadDate).toISOString()}>
                        {new Date(arquivo.uploadDate).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                  <a
                    href={arquivo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Baixar arquivo"
                    className="trabalhos-arquivo-download"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seção de Tópicos */}
      <div className="trabalhos-card-section">
        <button 
          className="trabalhos-card-section-header" 
          onClick={() => setTopicosOpen(!topicosOpen)}
        >
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5" />
            <h2>Tópicos do Trabalho</h2>
          </div>
          {topicosOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {topicosOpen && (
          <div className="trabalhos-card-section-content">
            <div className="trabalhos-topicos-grid">
              {Object.entries(data.topicos).map(([key, value]) => (
                <div key={key} className="trabalhos-topico-item">
                  <div className="trabalhos-topico-label">{key.replace(/_/g, ' ')}</div>
                  <div className="trabalhos-topico-value">{value || 'Não informado.'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seção de Avaliações Anteriores */}
      <div className="trabalhos-card-section">
        <button 
          className="trabalhos-card-section-header" 
          onClick={() => setAvaliacoesAnterioresOpen(!avaliacoesAnterioresOpen)}
        >
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-5 h-5" />
            <h2>Avaliações Anteriores ({data.avaliadorComentarios.length})</h2>
          </div>
          {avaliacoesAnterioresOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {avaliacoesAnterioresOpen && (
          <div className="trabalhos-card-section-content">
            {data.avaliadorComentarios.length === 0 ? (
              <p className="text-center opacity-70">Nenhuma avaliação prévia registrada.</p>
            ) : (
              <div className="trabalhos-avaliacoes-list">
                {[...data.avaliadorComentarios].reverse().map((avaliacao, index) => (
                  <div key={index} className="trabalhos-avaliacao-item">
                    <div className="trabalhos-avaliacao-header">
                      <div className="trabalhos-avaliacao-data">
                        {new Date(avaliacao.date).toLocaleString('pt-BR')}
                      </div>
                      <span className={`trabalhos-card-status ${avaliacao.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {avaliacao.status}
                      </span>
                    </div>
                    <div 
                      className="trabalhos-avaliacao-comentario" 
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(avaliacao.comentario) }} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Seção de Nova Avaliação */}
      <div className="trabalhos-avaliacao-section">
        <h2 className="trabalhos-avaliacao-title">
          <Edit className="w-5 h-5" />
          Adicionar Nova Avaliação
        </h2>
        {error && <div className="trabalhos-message error">{error}</div>}
        {success && <div className="trabalhos-message success">{success}</div>}
        <div className="trabalhos-status-buttons">
          {statusOptions.map(status => (
            <button 
              key={status} 
              onClick={() => setSelectedStatus(status)} 
              onMouseEnter={() => setHoveredStatus(status)} 
              onMouseLeave={() => setHoveredStatus(null)} 
              className={`trabalhos-status-btn ${status.toLowerCase().replace(/\s+/g, '-').replace('-de-', '-').replace('ção', 'cao')} ${selectedStatus === status ? 'active' : ''}`}
            >
              {status}
            </button>
          ))}
        </div>
        {(selectedStatus === "Aceito" || selectedStatus === "Recusado") && (
          <div className="trabalhos-ficha-container">
            <h3 className="trabalhos-ficha-title">Ficha de Avaliação Final</h3>
            {data.configuracaoModalidade.ficha_avalicao.map((item) => (
              <div key={`${item._id}`} className="trabalhos-ficha-item">
                <h4 className="trabalhos-ficha-item-title">{item.nome}</h4>
                <p className="trabalhos-ficha-item-info">
                  (Mín: {item.notaMinima} | Máx: {item.notaMaxima} | Peso: {item.peso})
                </p>
                <div className="trabalhos-ficha-inputs">
                  <input 
                    type="number" 
                    placeholder='Nota' 
                    min={item.notaMinima} 
                    max={item.notaMaxima} 
                    className="trabalhos-ficha-input" 
                    value={item.notasRecebidas[0] || ''} 
                    onChange={(e) => { 
                      const nota = Math.max(item.notaMinima, Math.min(item.notaMaxima, Number(e.target.value))); 
                      const updatedItem = { ...item, notasRecebidas: [nota] }; 
                      toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, updatedItem); 
                    }} 
                  />
                  <textarea 
                    className="trabalhos-ficha-textarea" 
                    placeholder='Justificativa da nota' 
                    rows={1} 
                    value={item.justificativa[0] || ''} 
                    onChange={(e) => { 
                      const updatedItem = { ...item, justificativa: [e.target.value] }; 
                      toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, updatedItem); 
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="trabalhos-editor-container">
          <label className="trabalhos-editor-label">Parecer Descritivo</label>
          <div className="trabalhos-editor">
            <ReactQuill 
              theme="snow" 
              value={newComentario} 
              onChange={setNewComentario} 
              modules={{ 
                toolbar: [
                  [{ 'header': [1, 2, false] }], 
                  ['bold', 'italic', 'underline'], 
                  [{ 'list': 'ordered' }, { 'list': 'bullet' }], 
                  ['link'], 
                  ['clean']
                ] 
              }} 
              placeholder="Escreva seu parecer detalhado aqui..." 
            />
          </div>
        </div>
        <button 
          onClick={handleAddAvaliacao} 
          disabled={loading} 
          onFocus={() => setIsFocused(true)} 
          onBlur={() => setIsFocused(false)} 
          className="trabalhos-submit-btn"
        >
          {loading ? 'Enviando...' : 'Enviar Avaliação'}
        </button>
      </div>
    </div>
  );
};