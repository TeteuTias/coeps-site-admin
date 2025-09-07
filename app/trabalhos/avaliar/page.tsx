'use client'
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { Users, FileText, ChevronUp, ChevronDown, Paperclip, Link as Linkk } from 'lucide-react';
import './style.css';
import {IAcademicWorks} from '@/app/lib/types/academicWorks/academicWorks.t';
import LoadingModal from '@/app/components/LoadingModal';


// /api/get/trabalhos-avaliacoes
// /api/post/avaliar-trabalho
export default function AvaliarTrabalho() {
  //
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [trabalhos, setTrabalhos] = useState<IAcademicWorks[]>([]);
  const hydrateData = useMemo(() => async () => {
    setIsLoading(true)
    const trabalhos: { data: IAcademicWorks[] } = await fetch('/api/get/trabalhos-avaliacoes').then(res => res.json());
    setTrabalhos(trabalhos.data);
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
          trabalhos.map((trabalho) => <TrabalhoComponent hydrateData={hydrateData} key={`${trabalho._id}`} data={trabalho} />)
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

const TrabalhoComponent: React.FC<{ data: IAcademicWorks, hydrateData: () => Promise<void> }> = ({ data, hydrateData }) => {
  const [selectedStatus, setSelectedStatus] = useState<IAcademicWorks['status']>(data.status);
  const [showAutores, setShowAutores] = useState(false);
  const [showArquivos, setShowArquivos] = useState(false);
  const [showTopicos, setShowTopicos] = useState(false);
  const [newComentario, setNewComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
          avaliadorComentarios: newComentario
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
      <div className="pb-4 border-b border-gray-200 mb-4">
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
        </div>
      </div>

      {/* Seção de Autores */}
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
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Avaliação
        </h2>
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
                    <p className="text-gray-800 font-normal leading-relaxed mb-3">
                      {comentario.comentario}
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

        <div className="mt-6 p-4 bg-white rounded-md border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-3">
            Adicionar Novo Comentário
          </h3>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            rows={4}
            value={newComentario}
            onChange={(e) => setNewComentario(e.target.value)}
            placeholder="Escreva seu comentário aqui..."
          ></textarea>
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
        </div>
      </div>
    </div>
  );
};