'use client'
import DOMPurify from 'dompurify';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useEffect, useState, useMemo, FC, ReactNode } from 'react';
import { Users, FileText, ChevronUp, ChevronDown, Paperclip, Link as LinkIcon, Download, UserCircle, MessageSquare, Edit } from 'lucide-react';

import { IAcademicWorks } from '@/app/lib/types/academicWorks/academicWorks.t';
import LoadingModal from '@/app/components/LoadingModal';
import { ObjectId } from 'bson';
import { IUser } from '../lib/types/user/user.t';
import { useRouter } from 'next/navigation';

// Paleta de Cores e Tema Inspirados em coeps.com.br
const theme = {
  colors: {
    primary: '#003366', // Azul Escuro
    accent: '#f37021',  // Laranja Vibrante
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

// Componentes Abstraídos para UI

const Card: FC<{ children: ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-[${theme.colors.surface}] rounded-lg shadow-lg border border-[${theme.colors.border}] overflow-hidden transition-shadow hover:shadow-xl duration-300 ${className}`}>
    {children}
  </div>
);

const CollapsibleSection: FC<{ title: string; icon: ReactNode; count?: number; children: ReactNode }> = ({ title, icon, count, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-[${theme.colors.border}] last:border-b-0">
      <button
        className="flex justify-between items-center w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3">
          <span className={`text-[${theme.colors.primary}]`}>{icon}</span>
          <h2 className={`text-lg font-semibold text-[${theme.colors.textPrimary}]`}>
            {title} {typeof count !== 'undefined' && `(${count})`}
          </h2>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-50">
          {children}
        </div>
      )}
    </div>
  );
};

const StatusBadge: FC<{ status: IAcademicWorks['status'] }> = ({ status }) => {
  const statusStyles: { [key in IAcademicWorks['status']]: string } = {
    'Aceito': `bg-green-100 text-[${theme.colors.success}]`,
    'Recusado': `bg-red-100 text-[${theme.colors.danger}]`,
    'Em Avaliação': `bg-yellow-100 text-[${theme.colors.warning}]`,
    'Necessita de Alteração': `bg-orange-100 text-[${theme.colors.accent}]`,
  };
  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const IconButton: FC<{ href: string, icon: ReactNode }> = ({ href, icon }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={`p-2 rounded-full text-[${theme.colors.primary}] hover:bg-blue-100 hover:text-[${theme.colors.accent}] transition-all duration-200`}
  >
    {icon}
  </a>
)

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

  const toggleFichaAvalicaoProps = (
    fichaId: ObjectId,
    indexAcademicWork: number,
    newProps: Partial<IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"][number]>
  ) => {
    setTrabalhos((prevTrabalhos) => {
      const updatedTrabalhos = [...prevTrabalhos];
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
      setTrabalhos(data.reverse()); // Exibir os mais recentes primeiro
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

  return (
    <main className={`w-full min-h-screen py-20 px-4 bg-[${theme.colors.background}]`}>
      <LoadingModal isLoading={isLoading} />
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className={`text-4xl font-bold text-[${theme.colors.primary}]`}>Painel de Avaliação</h1>
          <p className={`mt-2 text-lg text-[${theme.colors.textSecondary}]`}>Revise e avalie os trabalhos acadêmicos submetidos.</p>
        </header>
        <div className="space-y-8">
          {!isLoading && trabalhos.length > 0 ? (
            trabalhos.map((trabalho, indexTrabalho) => (
              <TrabalhoComponent
                key={`${trabalho._id}`}
                user={users.find((user) => `${user._id}` === `${trabalho.userId}`)}
                indexTrabalho={indexTrabalho}
                toggleFichaAvalicaoProps={toggleFichaAvalicaoProps}
                hydrateData={hydrateData}
                data={trabalho}
              />
            ))
          ) : (
            !isLoading && (
              <Card className="p-10 text-center">
                <h2 className="text-2xl font-semibold text-gray-700">Nenhum trabalho para avaliar</h2>
                <p className="mt-2 text-gray-500">No momento, não há trabalhos pendentes em sua fila de avaliação.</p>
              </Card>
            )
          )}
        </div>
      </div>
    </main>
  );
}

/******************************************
 * COMPONENTE DO CARD DE TRABALHO
 ******************************************/
const TrabalhoComponent: FC<{
  data: IAcademicWorks;
  user: IUser | undefined;
  indexTrabalho: number;
  hydrateData: () => Promise<void>;
  toggleFichaAvalicaoProps: (
    fichaId: ObjectId,
    indexAcademicWork: number,
    newProps: Partial<IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"][number]>
  ) => void;
}> = ({ data, hydrateData, toggleFichaAvalicaoProps, indexTrabalho, user }) => {
  const [selectedStatus, setSelectedStatus] = useState<IAcademicWorks['status']>(data.status);
  const [newComentario, setNewComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const router = useRouter();

  const handleAddAvaliacao = async () => {
    if (!newComentario.trim()) {
      setError('O campo de parecer não pode estar vazio.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/post/avaliar-trabalho", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: data._id,
          userId: data.userId,
          status: selectedStatus,
          avaliadorComentarios: newComentario,
          ficha_avalicao: data.configuracaoModalidade.ficha_avalicao
        })
      });
      if (!response.ok) {
        throw new Error('Falha ao enviar avaliação')
      };

      await hydrateData();
      setNewComentario('');
      alert('Avaliação enviada com sucesso!')
      setSuccess('Avaliação enviada com sucesso!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao enviar a avaliação.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions: IAcademicWorks['status'][] = ["Aceito", "Recusado", "Necessita de Alteração", "Em Avaliação"];

  return (
    <Card>
      {/* Cabeçalho do Card */}
      <div className="p-4 bg-gray-50 border-b border-[${theme.colors.border}]">
        <div className="flex justify-between items-start">
          <div>
            <h1 className={`text-2xl font-bold text-[${theme.colors.primary}] mb-1`}>{data.titulo}</h1>
            <p className={`text-sm font-medium text-[${theme.colors.accent}]`}>{data.modalidade}</p>
          </div>
          <StatusBadge status={data.status} />
        </div>
        <div className={`flex items-center text-sm text-[${theme.colors.textSecondary}] mt-3 space-x-4`}>
          <span className='flex items-center'>
            <UserCircle className="w-4 h-4 mr-1.5" />
            Enviado por:
            <button
              onClick={() => router.push(`/usuarios/informacoes/${user?._id}`)}
              className="ml-1 font-semibold text-gray-700 hover:underline"
            >
              {user?.informacoes_usuario.nome || 'Usuário Desconhecido'}
            </button>
          </span>
          <span>
            <strong>Data:</strong>{' '}
            {new Date(data.dataSubmissao).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Seções Colapsáveis */}
      <CollapsibleSection title="Autores" icon={<Users className="w-5 h-5" />} count={data.autores.length}>
        <ul className="space-y-2">
          {data.autores.map((autor, index) => (
            <li key={index} className="bg-white p-3 rounded-md border border-gray-200">
              <p className="font-medium text-gray-800">
                {autor.nome}{' '}
                {autor.isOrientador && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-normal ml-2">Orientador</span>
                )}
              </p>
              <p className="text-sm text-gray-600">Email: {autor.email}</p>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Arquivos" icon={<Paperclip className="w-5 h-5" />} count={data.arquivos.length}>
        <ul className="space-y-2">
          {data.arquivos.map((arquivo, index) => (
            <li key={index} className="bg-white p-3 rounded-md flex justify-between items-center border border-gray-200">
              <div>
                <p className="font-medium text-gray-800">{arquivo.originalName}</p>
                <p className="text-sm text-gray-600">Tamanho: {formatBytes(arquivo.size)}</p>
              </div>
              <IconButton href={arquivo.url} icon={<Download className="w-5 h-5" />} />
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Tópicos do Trabalho" icon={<FileText className="w-5 h-5" />}>
        <div className="space-y-3">
          {Object.entries(data.topicos).map(([key, value]) => (
            <div key={key} className="bg-white p-3 rounded-md border border-gray-200">
              <p className="font-semibold text-gray-800 capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-gray-600 mt-1">{value || 'Não informado.'}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Avaliações Anteriores" icon={<MessageSquare className="w-5 h-5" />} count={data.avaliadorComentarios.length}>
        {data.avaliadorComentarios.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma avaliação prévia registrada.</p>
        ) : (
          <div className="space-y-4">
            {[...data.avaliadorComentarios].reverse().map((avaliacao, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-gray-500">
                    {new Date(avaliacao.date).toLocaleString('pt-BR')}
                  </p>
                  <StatusBadge status={avaliacao.status} />
                </div>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(avaliacao.comentario) }} />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Seção de Nova Avaliação */}
      <div className="p-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Edit className="w-5 h-5 mr-2 text-[${theme.colors.primary}]" />
          Adicionar Nova Avaliação
        </h2>

        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md text-sm mb-4">{error}</p>}
        {success && <p className={`text-green-700 bg-green-100 p-3 rounded-md text-sm mb-4`}>{success}</p>}

        {/* Seleção de Status */}
        <div className='flex flex-wrap gap-2 mb-4'>
          {statusOptions.map(status => {
            // ---- Início da Lógica de Estilo ----

            // Verifica se o botão atual está selecionado ou com o mouse em cima
            const isSelected = selectedStatus === status;
            const isHovered = hoveredStatus === status;

            // Estilos base, aplicados a todos os botões
            const baseStyle: React.CSSProperties = {
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              lineHeight: '1.25rem',
              fontWeight: '600',
              borderRadius: '0.375rem',
              borderWidth: '2px',
              borderStyle: 'solid',
              transition: 'all 200ms ease-in-out',
              cursor: 'pointer',
            };

            // Estilos para um botão SELECIONADO
            const selectedStyle: React.CSSProperties = {
              backgroundColor: theme.colors.primary,
              color: 'white',
              borderColor: theme.colors.primary,
            };

            // Estilos para um botão PADRÃO (não selecionado)
            const defaultStyle: React.CSSProperties = {
              backgroundColor: 'white',
              color: theme.colors.textSecondary,
              borderColor: theme.colors.border,
            };

            // Estilos aplicados no HOVER (apenas se não estiver selecionado)
            const hoverStyle: React.CSSProperties = {
              borderColor: theme.colors.primary,
              color: theme.colors.primary,
            };

            // Combina os estilos com base no estado atual do botão
            const finalStyle = {
              ...baseStyle,
              ...(isSelected ? selectedStyle : defaultStyle),
              ...(isHovered && !isSelected ? hoverStyle : {}),
            };

            // ---- Fim da Lógica de Estilo ----

            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                onMouseEnter={() => setHoveredStatus(status)}
                onMouseLeave={() => setHoveredStatus(null)}
                style={finalStyle}
              >
                {status}
              </button>
            );
          })}
        </div>

        {/* Ficha de Avaliação (Condicional) */}
        {selectedStatus === "Aceito" || selectedStatus === "Recusado" && (
          <div className="space-y-4 mb-4 p-4 border rounded-md bg-gray-50">
            <h3 className="font-semibold text-lg text-gray-700">Ficha de Avaliação Final</h3>
            {data.configuracaoModalidade.ficha_avalicao.map((item) => (
              <div key={`${item._id}`} className="p-3 border border-gray-200 rounded-md bg-white">
                <h4 className="font-semibold text-gray-800">{item.nome}</h4>
                <p className="text-xs text-gray-500 mb-2">
                  (Mín: {item.notaMinima} | Máx: {item.notaMaxima} | Peso: {item.peso})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="number"
                    placeholder='Nota'
                    min={item.notaMinima}
                    max={item.notaMaxima}
                    className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={item.notasRecebidas[0] || ''}
                    onChange={(e) => {
                      const nota = Math.max(item.notaMinima, Math.min(item.notaMaxima, Number(e.target.value)));
                      const updatedItem = { ...item, notasRecebidas: [nota] };
                      toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, updatedItem);
                    }}
                  />
                  <textarea
                    className="md:col-span-2 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder='Justificativa da nota'
                    rows={1}
                    value={item.justificativa[0] || ''}
                    onChange={(e) => {
                      const updatedItem = { ...item, justificativa: [e.target.value] };
                      toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, updatedItem);
                    }}
                  ></textarea>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Editor de Texto */}
        <div>
          <label className="block text-md font-semibold text-gray-700 mb-2">Parecer Descritivo</label>
          <div className="bg-white rounded-md border border-gray-300">
            <ReactQuill
              theme="snow"
              value={newComentario}
              onChange={setNewComentario}
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, false] }],
                  ['bold', 'italic', 'underline'],
                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                  ['link'], ['clean']
                ],
              }}
              placeholder="Escreva seu parecer detalhado aqui..."
            />
          </div>
        </div>

        {/* Botão de Envio */}
        <button
          onClick={handleAddAvaliacao}
          disabled={loading}
          className={`mt-4 text-black w-full sm:w-auto px-8 py-3 rounded-md font-semibold text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[${theme.colors.accent}]`}
          style={loading ? {
            backgroundColor: "gray",
            cursor: "not-allowed"
          } : {
            backgroundColor: theme.colors.accent,
          }}
        >
          {loading ? 'Enviando...' : 'Enviar Avaliação'}
        </button>
      </div>
    </Card>
  );
};