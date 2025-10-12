'use client'
import DOMPurify from 'dompurify';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Importa os estilos CSS do editor
import { useEffect, useState, useMemo } from 'react';
import { Users, FileText, ChevronUp, ChevronDown, Paperclip, Link as Linkk } from 'lucide-react';

import { IAcademicWorks } from '@/app/lib/types/academicWorks/academicWorks.t';
import LoadingModal from '@/app/components/LoadingModal';
import { ObjectId } from 'bson';
import { IUser } from '../lib/types/user/user.t';
import { useRouter } from 'next/navigation';

// /api/get/trabalhos-avaliacoes
// /api/post/avaliar-trabalho
export default function AvaliarTrabalho() {
  //
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [trabalhos, setTrabalhos] = useState<IAcademicWorks[]>([]);
  const [users, setUsers] = useState<IUser[]>([])

  const toggleFichaAvalicaoProps = (
    fichaId: ObjectId,
    indexAcademicWork: number,
    newProps: Partial<IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"][number]>
  ) => {
    setTrabalhos((prevTrabalhos) => {
      // 1. Crie uma cópia do array principal de trabalhos.
      const updatedTrabalhos = [...prevTrabalhos];

      // 2. Acesse o trabalho específico que você deseja atualizar.
      const trabalhoToUpdate = updatedTrabalhos[indexAcademicWork];

      if (!trabalhoToUpdate) {
        // Retorne o estado original se o trabalho não for encontrado.
        return prevTrabalhos;
      }

      // 3. Crie uma cópia da ficha de avaliação desse trabalho.
      const updatedFichaAvaliacao = [...trabalhoToUpdate.configuracaoModalidade.ficha_avalicao];

      // 4. Encontre o índice do item na ficha de avaliação com base no _id.
      const fichaIndex = updatedFichaAvaliacao.findIndex((ficha) =>
        `${ficha._id}` === `${fichaId}`
      );

      if (fichaIndex === -1) {
        // Retorne o estado original se a ficha de avaliação não for encontrada.
        return prevTrabalhos;
      }

      // 5. Crie uma cópia do item da ficha de avaliação e atualize com as novas propriedades.
      const fichaToUpdate = {
        ...updatedFichaAvaliacao[fichaIndex],
        ...newProps,
      };

      // 6. Coloque o item atualizado de volta no array de fichas.
      updatedFichaAvaliacao[fichaIndex] = fichaToUpdate;

      // 7. Atualize o objeto do trabalho com a nova ficha de avaliação.
      const finalUpdatedTrabalho = {
        ...trabalhoToUpdate,
        configuracaoModalidade: {
          ...trabalhoToUpdate.configuracaoModalidade,
          ficha_avalicao: updatedFichaAvaliacao,
        },
      };

      // 8. Coloque o trabalho atualizado de volta no array principal de trabalhos.
      updatedTrabalhos[indexAcademicWork] = finalUpdatedTrabalho;

      // 9. Retorne o novo array de trabalhos para atualizar o estado.
      return updatedTrabalhos;
    });
  };

  const hydrateData = useMemo(() => async () => {
    setIsLoading(true)
    const trabalhos: { data: IAcademicWorks[], users: IUser[] } = await fetch('/api/get/trabalhos-avaliacoes').then(res => res.json());
    setTrabalhos(trabalhos.data);
    setUsers(trabalhos.users)
    setIsLoading(false)
  }, [])
  useEffect(() => {
    hydrateData()
  }, []);

  //
  //
  return (
    <main className='w-full min-h-screen py-10'>
      <LoadingModal isLoading={isLoading} />
      <div>
        {
          !isLoading && trabalhos.length !== 0 &&
          trabalhos.reverse().map((trabalho, indexTrabalho) =>
            <TrabalhoComponent key={`${trabalho._id}`} user={users.find((user) => `${user._id}` === `${trabalho.userId}`)} indexTrabalho={indexTrabalho} toggleFichaAvalicaoProps={toggleFichaAvalicaoProps} hydrateData={hydrateData} data={trabalho} />
          )
        }
      </div>
    </main>
  )

}



const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const TrabalhoComponent: React.FC<{
  data: IAcademicWorks,
  user: IUser | undefined,
  indexTrabalho: number,
  hydrateData: () => Promise<void>,
  toggleFichaAvalicaoProps: (
    fichaId: ObjectId,
    indexAcademicWork: number,
    newProps: Partial<IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"][number]>
  ) => void

}> = ({ data, hydrateData, toggleFichaAvalicaoProps, indexTrabalho, user }) => {
  const [selectedStatus, setSelectedStatus] = useState<IAcademicWorks['status']>(data.status);
  const [isOpenPrevEvaluations, setIsOpenPrevEvaluations] = useState<boolean>(false)
  const [isOpenAddNewEvaluation, setIsOpenAddNewEvaluation] = useState<boolean>(false)
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showAutores, setShowAutores] = useState(false);
  const [showArquivos, setShowArquivos] = useState(false);
  const [showTopicos, setShowTopicos] = useState(false);
  const [newComentario, setNewComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter()

  const toggleSection = (section: string) => {
    if (section === 'autores') setShowAutores(!showAutores);
    if (section === 'arquivos') setShowArquivos(!showArquivos);
    if (section === 'topicos') setShowTopicos(!showTopicos);
  };

  const handleAddComentario = async () => {
    if (!newComentario.trim()) {
      setError('O comentário não pode estar vazio.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);


    try {
      await fetch("/api/post/avaliar-trabalho", {
        method: "POST", body: JSON.stringify({
          documentId: data._id,
          userId: data.userId,
          status: selectedStatus,
          avaliadorComentarios: newComentario,
          ficha_avalicao: data.configuracaoModalidade.ficha_avalicao
        })
      })
      await hydrateData();
      setNewComentario('');
      setSuccess('Comentário adicionado com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao adicionar o comentário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl mx-auto my-10 border border-gray-200">
      {/* Título e informações básicas */}
      <div className="pb-4 border-b border-gray-200 mb-4" onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        <h1 className='p-2 bg-red-500 text-white font-extrabold w-fit' onClick={() => router.push(`/usuarios/informacoes/${user?._id}`)}>
          {user?.informacoes_usuario.nome}
        </h1>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {data.titulo}
        </h1>
        <div className="flex items-center text-sm text-gray-500 space-x-4">
          <span>
            <strong className="text-gray-700">Modalidade:</strong>{' '}
            {data.modalidade}
          </span>
          <span>
            <strong className="text-gray-700">Status:</strong> {data.status}
          </span>
          <span>
            <strong className="text-gray-700">Data de Submissão:</strong>{' '}
            {new Date(data.dataSubmissao).toLocaleDateString('pt-BR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })} às {new Date(data.dataSubmissao).toLocaleTimeString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Seção de Autores */}
      {
        isOpen &&
        <>
          <div className="py-4 border-b border-gray-200">
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('autores')}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-500" />
                <h2 className="text-xl font-semibold text-gray-700">
                  Autores ({data.autores.length})
                </h2>
              </div>
              {showAutores ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
            {showAutores && (
              <ul className="mt-4 space-y-2">
                {data.autores.map((autor, index) => (
                  <li
                    key={index}
                    className="bg-gray-50 p-3 rounded-md border border-gray-100"
                  >
                    <p className="font-medium text-gray-800">
                      {autor.nome}{' '}
                      {autor.isOrientador && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-normal ml-2">
                          Orientador
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">Email: {autor.email}</p>
                    <p className="text-sm text-gray-600">CPF: {autor.cpf}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Seção de Arquivos */}
          <div className="py-4 border-b border-gray-200">
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('arquivos')}
            >
              <div className="flex items-center space-x-2">
                <Paperclip className="w-5 h-5 text-gray-500" />
                <h2 className="text-xl font-semibold text-gray-700">
                  Arquivos ({data.arquivos.length})
                </h2>
              </div>
              {showArquivos ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
            {showArquivos && (
              <ul className="mt-4 space-y-2">
                {data.arquivos.map((arquivo, index) => (
                  <li
                    key={index}
                    className="bg-gray-50 p-3 rounded-md flex justify-between items-center border border-gray-100"
                  >
                    <div>
                      <p className="font-medium text-gray-800">
                        {arquivo.originalName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Tamanho: {formatBytes(arquivo.size)}
                      </p>
                    </div>
                    <a
                      href={arquivo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Linkk className="w-5 h-5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Seção de Tópicos */}
          <div className="py-4 border-b border-gray-200">
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleSection('topicos')}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-gray-500" />
                <h2 className="text-xl font-semibold text-gray-700">Tópicos</h2>
              </div>
              {showTopicos ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
            {showTopicos && (
              <div className="mt-4 space-y-4">
                {Object.entries(data.topicos).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 p-3 rounded-md border border-gray-100">
                    <p className="font-semibold text-gray-800 capitalize">
                      {key}
                    </p>
                    <p className="text-gray-600 mt-1">{value || 'Nenhum texto fornecido.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção de Comentários do Avaliador */}
          <div className="py-4">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 cursor-pointer" onClick={() => setIsOpenPrevEvaluations((prev) => (!prev))}>
              Avaliações Prévias
            </h2>
            {
              isOpenPrevEvaluations &&
              <div className="space-y-4">
                {data.avaliadorComentarios.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma avaliação foi feita ainda.</p>
                ) : (
                  <>
                    <p className='w-full text-center'>Avaliações já realizadas</p>
                    {
                      data.avaliadorComentarios.reverse().map((comentario, index) => (
                        <div
                          key={index}
                          className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md"
                        >
                          <p className="mb-3">
                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comentario.comentario) }} />
                          </p>
                          <div className="flex flex-wrap items-center text-sm text-gray-500 gap-x-4 gap-y-2">
                            <p>
                              <span className="font-medium text-gray-700">Data:</span>{' '}
                              {new Date(comentario.date).toLocaleDateString('pt-BR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })} às {new Date(comentario.date).toLocaleTimeString('pt-BR')}
                            </p>
                            <span
                              className={`
        px-3 py-1 rounded-full text-xs font-semibold
        ${comentario.status === 'Aceito'
                                  ? 'bg-green-100 text-green-800'
                                  : comentario.status === 'Recusado'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }
      `}
                            >
                              {comentario.status}
                            </span>
                          </div>
                        </div>
                      ))
                    }
                  </>
                )}
              </div>
            }

            <div className="mt-6 p-4 bg-white rounded-md border border-gray-200 space-y-5">
              <div>
                {
                  // ………
                }
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-3 cursor-pointer" onClick={() => setIsOpenAddNewEvaluation((prev) => (!prev))}>
                Adicionar Nova Avaliação
              </h3>
              {
                isOpenAddNewEvaluation &&
                <>
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                  {success && <p className="text-green-500 text-sm mt-2">{success}</p>}
                  <div className='flex flex-row space-x-5'>
                    <button onClick={() => setSelectedStatus("Em Avaliação")}
                      className='p-5' style={{
                        backgroundColor: selectedStatus === "Em Avaliação" ? "blue" : "gray",
                        color: "white"
                      }}>Em Avaliação</button>
                    <button onClick={() => setSelectedStatus("Aceito")}
                      className='p-5' style={{
                        backgroundColor: selectedStatus === "Aceito" ? "blue" : "gray",
                        color: "white"
                      }}>Aceito</button>
                    <button onClick={() => setSelectedStatus("Recusado")}
                      className='p-5' style={{
                        backgroundColor: selectedStatus === "Recusado" ? "blue" : "gray",
                        color: "white"
                      }}>Recusado</button>
                    <button onClick={() => setSelectedStatus("Necessita de Alteração")}
                      className='p-5' style={{
                        backgroundColor: selectedStatus === "Necessita de Alteração" ? "blue" : "gray",
                        color: "white"
                      }}>Necessita de Alteração</button>
                  </div>
                  {/* --- --- --- */}
                  <div className="space-y-6">
                    {
                      data.configuracaoModalidade.ficha_avalicao.map((item, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                          <h4 className="text-md font-semibold text-gray-700 mb-3">{item.nome}</h4>
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                              <label className="w-full sm:w-1/3 text-gray-700 font-medium">
                                Nota (Mín: {item.notaMinima}, Máx: {item.notaMaxima}, Peso: {item.peso})
                              </label>
                              <input
                                type="number"
                                min={item.notaMinima}
                                max={item.notaMaxima}
                                className="w-full sm:w-1/3 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                value={item.notasRecebidas[0]}
                                onChange={(e) => {
                                  item.notasRecebidas[0] = Number(e.target.value)
                                  if (item.notasRecebidas[0] > item.notaMaxima || item.notasRecebidas[0] < item.notaMinima) {
                                    return
                                  }

                                  console.log(item.notasRecebidas[0])
                                  toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, item)

                                }}
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                              <label className="w-full sm:w-1/3 text-gray-700 font-medium">
                                Justificativa
                              </label>
                              <textarea
                                className="w-full sm:w-2/3 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                rows={2}
                                value={item.justificativa[0] || ''}
                                onChange={(e) => {
                                  const novaJustificativa = e.target.value;
                                  item.justificativa[0] = novaJustificativa
                                  toggleFichaAvalicaoProps(new ObjectId(item._id), indexTrabalho, item)
                                }}
                              ></textarea>
                            </div>
                          </div>

                        </div>
                      ))
                    }
                  </div>
                  {/* --- --- --- */}
                  <ReactQuill
                    theme="snow" // O tema 'snow' oferece a barra de ferramentas padrão
                    value={newComentario}
                    onChange={setNewComentario}
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        [{ 'script': 'sub' }, { 'script': 'super' }],
                        [{ 'indent': '-1' }, { 'indent': '+1' }],
                        [{ 'direction': 'rtl' }],

                        [{ 'size': ['small', false, 'large', 'huge'] }],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'font': [] }],
                        [{ 'align': [] }],

                        ['link', 'image', 'video'],

                        ['clean']
                      ],
                    }}
                    placeholder="Escreva seu comentário aqui..."
                  />
                  <button
                    onClick={handleAddComentario}
                    disabled={loading}
                    className={`mt-4 w-full sm:w-auto px-6 py-3 rounded-md font-semibold text-white transition-colors duration-200 ${loading
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    {loading ? 'Enviando...' : 'Enviar Avaliação'}
                  </button>
                </>
              }
            </div>
          </div>
        </>
      }
    </div>
  );
};



const ChecklistAvaliacao: React.FC<{ ficha: IAcademicWorks["configuracaoModalidade"]["ficha_avalicao"] }> = ({ ficha }) => {

  return (
    <h1>asdasdf</h1>
  );
};
