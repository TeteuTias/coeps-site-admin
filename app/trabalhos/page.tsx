'use client'
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { useEffect, useState, useMemo, FC } from 'react';
import { Users, FileText, ChevronUp, ChevronDown, Paperclip, Info, Download, UserCircle, MessageSquare, Edit, PieChart, Search, Filter, File } from 'lucide-react';
import { IAcademicWorks } from '@/app/lib/types/academicWorks/academicWorks.t';
import LoadingModal from '@/app/components/LoadingModal';
import { ObjectId } from 'bson';
import { IUser } from '../lib/types/user/user.t';
import { useRouter } from 'next/navigation';

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
    <main className={`w-full min-h-screen pt-20 px-4 bg-[${theme.colors.background}]`}>
      <LoadingModal isLoading={isLoading} />
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 text-center md:text-left">
          <h1 className={`text-4xl font-bold text-[${theme.colors.primary}]`}>Painel de Avaliação</h1>
          <p className={`mt-2 text-lg text-[${theme.colors.textSecondary}]`}>Revise, filtre e avalie os trabalhos acadêmicos submetidos.</p>
        </header>

        {/* Seção de Filtros e Estatísticas (Inlined) */}
        {!isLoading && (
          <div className={`bg-white rounded-lg shadow-lg border border-[${theme.colors.border}] overflow-hidden transition-shadow hover:shadow-xl duration-300 mb-8 p-6 space-y-6`}>
            <div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center"><PieChart className="mr-2 text-gray-500" />Estatísticas Gerais</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* StatCard Inlined: Total */}
                <div className="p-4 rounded-lg shadow-md bg-blue-600">
                  <p className="text-sm text-white opacity-90 font-extrabold">Total de Trabalhos</p>
                  <p className="text-3xl font-bold text-white">{trabalhos.length}</p>
                </div>
                {/* StatCard Inlined: Aceitos */}
                <div className="p-4 rounded-lg shadow-md bg-green-600">
                  <p className="text-sm text-white opacity-90 font-extrabold">Aceitos</p>
                  <p className="text-3xl font-bold text-white">{stats['Aceito'] || 0}</p>
                </div>
                {/* StatCard Inlined: Recusados */}
                <div className="p-4 rounded-lg shadow-md bg-red-600">
                  <p className="text-sm text-white opacity-90 font-extrabold">Recusados</p>
                  <p className="text-3xl font-bold text-white">{stats['Recusado'] || 0}</p>
                </div>
                {/* StatCard Inlined: Necessitam Alteração */}
                <div className={`p-4 rounded-lg shadow-md`} style={{ backgroundColor: theme.colors.accent }}>
                  <p className="text-sm text-white opacity-90 font-extrabold">Necessitam Alteração</p>
                  <p className="text-3xl font-bold text-white">{stats['Necessita de Alteração'] || 0}</p>
                </div>
                {/* StatCard Inlined: Necessitam Alteração */}
                <div className={`p-4 rounded-lg shadow-md`} style={{ backgroundColor: theme.colors.accent }}>
                  <p className="text-sm text-white opacity-90 font-extrabold">Necessita de Avaliação</p>
                  <p className="text-3xl font-bold text-white">{stats['Em Avaliação'] || 0}</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center"><Filter className="mr-2 text-gray-500" />Filtros de Pesquisa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar por título do trabalho ou congressista..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                >
                  {statusOptionsFiltro.map(opt => <option key={opt} value={opt}>{opt === 'Todos' ? 'Filtrar por Status (Todos)' : opt}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8 ">
          <div
            className={`
    w-full 
    p-4 mb-6
    bg-blue-50 
    border-l-4 border-blue-400
    rounded-r-lg
    text-center
    flex items-center justify-center
  `}
            style={{
              backgroundColor: 'rgba(239, 246, 255, 1)', // bg-blue-50
              borderColor: 'rgba(96, 165, 250, 1)', // border-blue-400
            }}
          >
            <Info className="h-6 w-6 text-blue-600 mr-3" />
            <p className="text-md font-medium text-blue-800">
              {getTextoResultados(filteredTrabalhos.length)}
            </p>
          </div>
          {!isLoading && filteredTrabalhos.length > 0 ? (
            filteredTrabalhos.map((trabalho) => {
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
            })
          ) : (
            !isLoading && (
              <div className={`bg-white rounded-lg shadow-lg border border-[${theme.colors.border}] overflow-hidden transition-shadow hover:shadow-xl duration-300 p-10 text-center`}>
                <h2 className="text-2xl font-semibold text-gray-700">Nenhum Trabalho Encontrado</h2>
                <p className="mt-2 text-gray-500">Tente ajustar seus filtros de pesquisa ou aguarde novas submissões.</p>
              </div>
            )
          )}
        </div>
      </div>
    </main>
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
    <div className={`bg-white rounded-lg shadow-lg border border-[${theme.colors.border}] overflow-hidden transition-shadow hover:shadow-xl duration-300`}>
      {/* Cabeçalho do Card */}
      <div className="p-4 bg-gray-50 border-b border-[${theme.colors.border}]">
        <div className="flex flex-col sm:flex-row justify-between items-start">
          <div className='mb-2 sm:mb-0'>
            <h1 className={`text-2xl font-bold text-[${theme.colors.primary}] mb-1`}>{data.titulo}</h1>
            <p className={`text-sm font-medium text-[${theme.colors.accent}]`}>{data.modalidade}</p>
          </div>
          {/* StatusBadge Inlined */}
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadgeStyles[data.status] || 'bg-gray-100 text-gray-800'}`}>{data.status}</span>
        </div>
        <div className={`flex flex-col sm:flex-row items-start sm:items-center text-sm text-[${theme.colors.textSecondary}] mt-3 space-y-2 sm:space-y-0 sm:space-x-4`}>
          <span className='flex items-center'>
            <UserCircle className="w-4 h-4 mr-1.5" /> Enviado por:
            <button onClick={() => router.push(`/usuarios/informacoes/${user?._id}`)} className="ml-1 font-semibold text-gray-700 hover:underline">{user?.informacoes_usuario.nome || 'Usuário Desconhecido'}</button>
          </span>
          <span><strong>Data:</strong>{' '}{new Date(data.dataSubmissao).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* Seção de Autores (Inlined) */}
      <div className="border-b border-[${theme.colors.border}]">
        <button className="flex justify-between items-center w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200" onClick={() => setAutoresOpen(!autoresOpen)}>
          <div className="flex items-center space-x-3"><span className={`text-[${theme.colors.primary}]`}><Users className="w-5 h-5" /></span><h2 className={`text-lg font-semibold text-[${theme.colors.textPrimary}]`}>Autores ({data.autores.length})</h2></div>
          {autoresOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {autoresOpen && (<div className="p-4 bg-gray-50"><ul className="space-y-2">{data.autores.map((autor, index) => (<li key={index} className="bg-white p-3 rounded-md border border-gray-200"><p className="font-medium text-gray-800">{autor.nome}{' '}{autor.isOrientador && (<span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-normal ml-2">Orientador</span>)}</p><p className="text-sm text-gray-600">Email: {autor.email}</p></li>))}</ul></div>)}
      </div>

      {/* Seção de Arquivos (Inlined) */}
      <div className="border-b border-[${theme.colors.border}]">
        <button className="flex justify-between items-center w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200" onClick={() => setArquivosOpen(!arquivosOpen)}>
          <div className="flex items-center space-x-3"><span className={`text-[${theme.colors.primary}]`}><Paperclip className="w-5 h-5" /></span><h2 className={`text-lg font-semibold text-[${theme.colors.textPrimary}]`}>Arquivos ({data.arquivos.length})</h2></div>
          {arquivosOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {
          arquivosOpen && (
            <div className="p-2 sm:p-4 bg-slate-50 rounded-b-lg">
              <ul className="space-y-2">
                {data.arquivos.map((arquivo, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg bg-white hover:bg-slate-100 transition-colors duration-200 border border-slate-200"
                  >
                    {/* Ícone do Arquivo */}
                    <div className="flex-shrink-0 bg-slate-200/70 p-2 rounded-md">
                      <File size={20} />
                    </div>

                    {/* Informações do Arquivo */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate" title={arquivo.originalName}>
                        {arquivo.originalName}
                      </p>
                      <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{formatBytes(arquivo.size)}</span>
                        <span className="text-slate-300">•</span>
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

                    {/* Botão de Download */}
                    <a
                      href={arquivo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Baixar arquivo"
                      // Nota: Mantive um estilo padrão. Se quiser usar sua cor de tema, 
                      // pode voltar a usar `text-[${theme.colors.primary}]` aqui.
                      className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors duration-200"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      </div>

      {/* Seção de Tópicos (Inlined) */}
      <div className="border-b border-[${theme.colors.border}]">
        <button className="flex justify-between items-center w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200" onClick={() => setTopicosOpen(!topicosOpen)}>
          <div className="flex items-center space-x-3"><span className={`text-[${theme.colors.primary}]`}><FileText className="w-5 h-5" /></span><h2 className={`text-lg font-semibold text-[${theme.colors.textPrimary}]`}>Tópicos do Trabalho</h2></div>
          {topicosOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {topicosOpen && (<div className="p-4 bg-gray-50"><div className="space-y-3">{Object.entries(data.topicos).map(([key, value]) => (<div key={key} className="bg-white p-3 rounded-md border border-gray-200"><p className="font-semibold text-gray-800 capitalize">{key.replace(/_/g, ' ')}</p><p className="text-gray-600 mt-1">{value || 'Não informado.'}</p></div>))}</div></div>)}
      </div>

      {/* Seção de Avaliações Anteriores (Inlined) */}
      <div className="border-b border-[${theme.colors.border}] last:border-b-0">
        <button className="flex justify-between items-center w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200" onClick={() => setAvaliacoesAnterioresOpen(!avaliacoesAnterioresOpen)}>
          <div className="flex items-center space-x-3"><span className={`text-[${theme.colors.primary}]`}><MessageSquare className="w-5 h-5" /></span><h2 className={`text-lg font-semibold text-[${theme.colors.textPrimary}]`}>Avaliações Anteriores ({data.avaliadorComentarios.length})</h2></div>
          {avaliacoesAnterioresOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {avaliacoesAnterioresOpen && (<div className="p-4 bg-gray-50">{data.avaliadorComentarios.length === 0 ? (<p className="text-gray-500 text-sm">Nenhuma avaliação prévia registrada.</p>) : (<div className="space-y-4">{[...data.avaliadorComentarios].reverse().map((avaliacao, index) => (<div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"><div className="flex justify-between items-center mb-3"><p className="text-sm text-gray-500">{new Date(avaliacao.date).toLocaleString('pt-BR')}</p><span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadgeStyles[avaliacao.status] || 'bg-gray-100 text-gray-800'}`}>{avaliacao.status}</span></div><div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(avaliacao.comentario) }} /></div>))}</div>)}</div>)}
      </div>

      {/* Seção de Nova Avaliação */}
      <div className="p-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Edit className="w-5 h-5 mr-2 text-[${theme.colors.primary}]" />Adicionar Nova Avaliação</h2>
        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md text-sm mb-4">{error}</p>}
        {success && <p className={`text-green-700 bg-green-100 p-3 rounded-md text-sm mb-4`}>{success}</p>}
        <div className='flex flex-wrap gap-2 mb-4'>
          {statusOptions.map(status => {
            const isSelected = selectedStatus === status; const isHovered = hoveredStatus === status;
            const baseStyle: React.CSSProperties = { padding: '0.5rem 1rem', fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '600', borderRadius: '0.375rem', borderWidth: '2px', borderStyle: 'solid', transition: 'all 200ms ease-in-out', cursor: 'pointer' };
            const selectedStyle: React.CSSProperties = { backgroundColor: theme.colors.primary, color: 'white', borderColor: theme.colors.primary };
            const defaultStyle: React.CSSProperties = { backgroundColor: 'white', color: theme.colors.textSecondary, borderColor: theme.colors.border };
            const hoverStyle: React.CSSProperties = { borderColor: theme.colors.primary, color: theme.colors.primary };
            const finalStyle = { ...baseStyle, ...(isSelected ? selectedStyle : defaultStyle), ...(isHovered && !isSelected ? hoverStyle : {}) };
            return (<button key={status} onClick={() => setSelectedStatus(status)} onMouseEnter={() => setHoveredStatus(status)} onMouseLeave={() => setHoveredStatus(null)} style={finalStyle}>{status}</button>);
          })}
        </div>
        {(selectedStatus === "Aceito" || selectedStatus === "Recusado") && (<div className="space-y-4 mb-4 p-4 border rounded-md bg-gray-50">
          <h3 className="font-semibold text-lg text-gray-700">Ficha de Avaliação Final</h3>
          {data.configuracaoModalidade.ficha_avalicao.map((item) => (<div key={`${item._id}`} className="p-3 border border-gray-200 rounded-md bg-white">
            <h4 className="font-semibold text-gray-800">{item.nome}</h4><p className="text-xs text-gray-500 mb-2">(Mín: {item.notaMinima} | Máx: {item.notaMaxima} | Peso: {item.peso})</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="number" placeholder='Nota' min={item.notaMinima} max={item.notaMaxima} className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400" value={item.notasRecebidas[0] || ''} onChange={(e) => { const nota = Math.max(item.notaMinima, Math.min(item.notaMaxima, Number(e.target.value))); const updatedItem = { ...item, notasRecebidas: [nota] }; toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, updatedItem); }} />
              <textarea className="md:col-span-2 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder='Justificativa da nota' rows={1} value={item.justificativa[0] || ''} onChange={(e) => { const updatedItem = { ...item, justificativa: [e.target.value] }; toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, updatedItem); }} ></textarea>
            </div></div>))}
        </div>)}
        <div>
          <label className="block text-md font-semibold text-gray-700 mb-2">Parecer Descritivo</label>
          <div className="bg-white rounded-md border border-gray-300"><ReactQuill theme="snow" value={newComentario} onChange={setNewComentario} modules={{ toolbar: [[{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['link'], ['clean']] }} placeholder="Escreva seu parecer detalhado aqui..." /></div>
        </div>
        <button onClick={handleAddAvaliacao} disabled={loading} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} className={!loading ? `hover:opacity-90` : ''} style={(() => {
          const baseStyle: React.CSSProperties = { marginTop: '1rem', width: '100%', padding: '0.75rem 2rem', borderRadius: '0.375rem', fontWeight: 600, color: 'white', transition: 'background-color 300ms, box-shadow 150ms ease-in-out', border: 'none', outline: 'none' };
          const conditionalStyle = loading ? { backgroundColor: '#9ca3af', cursor: 'not-allowed' } : { backgroundColor: theme.colors.accent, cursor: 'pointer' };
          const focusStyle: React.CSSProperties = { boxShadow: `0 0 0 2px ${theme.colors.surface}, 0 0 0 4px ${theme.colors.accent}` };
          return { ...baseStyle, ...conditionalStyle, ...(isFocused && !loading ? focusStyle : {}) };
        })()}>{loading ? 'Enviando...' : 'Enviar Avaliação'}</button>
      </div>
    </div>
  );
};