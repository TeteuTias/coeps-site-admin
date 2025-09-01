'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Download, FileText, CheckCircle, XCircle, AlertCircle, Eye, MessageSquare, Calendar } from 'lucide-react';
import { useUser } from '@auth0/nextjs-auth0/client';
import './style.css';

interface TrabalhoUsuario {
  _id: string;
  filename: string;
  url: string;
  size: number;
  dataUpload: string;
  avaliacao: {
    status: 'pendente' | 'aceito' | 'recusado' | 'necessita_alteracao';
    avaliadorComentarios: string;
    dataAvaliacao?: string;
  };
}

interface MeusTrabalhos {
  trabalhos: TrabalhoUsuario[];
  totalTrabalhos: number;
  totalAvaliados: number;
}

const MeusTrabalhos = () => {
  const { user, isLoading: userLoading } = useUser();
  const [data, setData] = useState<MeusTrabalhos>({
    trabalhos: [],
    totalTrabalhos: 0,
    totalAvaliados: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!userLoading && user) {
      fetchMeusTrabalhos();
    }
  }, [user, userLoading]);

  const fetchMeusTrabalhos = async () => {
    try {
      if (!user?.sub) return;
      
      const userId = user.sub.replace("auth0|", "");
      const response = await fetch(`/api/get/avaliacoes-usuario/${userId}`);
      
      if (!response.ok) {
        throw new Error('Erro na resposta da rede');
      }
      
      const result = await response.json();
      setData(result);
    } catch (error) {
      setError("Erro ao carregar seus trabalhos. Tente novamente.");
    } finally {
      setLoading(false);
    }
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

  // Função para obter ícone do status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aceito': return <CheckCircle size={18} />;
      case 'recusado': return <XCircle size={18} />;
      case 'necessita_alteracao': return <AlertCircle size={18} />;
      default: return <Eye size={18} />;
    }
  };

  // Função para obter texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'aceito': return 'Aceito';
      case 'recusado': return 'Recusado';
      case 'necessita_alteracao': return 'Necessita Alteração';
      default: return 'Em Avaliação';
    }
  };

  // Função para formatar tamanho do arquivo
  const formatarTamanho = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Função para formatar data
  const formatarData = (dataString: string): string => {
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (userLoading || loading) {
    return (
      <div className="meus-trabalhos-loading-container" style={{
        background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="trabalhos-spinner"></div>
        <span className="trabalhos-loading-text">Carregando seus trabalhos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="meus-trabalhos-error-container" style={{
        background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="error-message">{error}</div>
        <button onClick={fetchMeusTrabalhos} className="btn-retry">
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="meus-trabalhos-main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="meus-trabalhos-container">
        <h1 className="meus-trabalhos-title">MEUS TRABALHOS</h1>
        
        <div className="meus-trabalhos-estatisticas">
          <div className="estatistica-card">
            <FileText size={32} style={{color: 'var(--azul)'}} />
            <span className="estatistica-valor">{data.totalTrabalhos}</span>
            <span className="estatistica-label">Trabalhos Enviados</span>
          </div>
          <div className="estatistica-card">
            <CheckCircle size={32} style={{color: '#10b981'}} />
            <span className="estatistica-valor">{data.totalAvaliados}</span>
            <span className="estatistica-label">Avaliados</span>
          </div>
        </div>

        {data.trabalhos.length === 0 ? (
          <div className="sem-trabalhos">
            <FileText size={64} style={{color: 'var(--azul)', opacity: 0.5}} />
            <h3>Nenhum trabalho enviado</h3>
            <p>Você ainda não enviou nenhum trabalho.</p>
            <Link href="/trabalhos/submeter" className="btn-submeter">
              Enviar Primeiro Trabalho
            </Link>
          </div>
        ) : (
          <div className="trabalhos-lista">
            {data.trabalhos.map((trabalho, idx) => (
              <div key={trabalho._id} className="trabalho-card fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }}>
                <div className="trabalho-header">
                  <div className="trabalho-info">
                    <h3 className="trabalho-nome">{trabalho.filename}</h3>
                    <div className="trabalho-detalhes">
                      <span className="trabalho-tamanho">{formatarTamanho(trabalho.size)}</span>
                      <span className="trabalho-data">
                        <Calendar size={14} />
                        Enviado em {formatarData(trabalho.dataUpload)}
                      </span>
                    </div>
                  </div>
                  
                  <Link target='_blank' href={trabalho.url} className="btn-download">
                    <Download size={18} />
                    Download
                  </Link>
                </div>

                <div className="trabalho-status-section">
                  <div className="status-header">
                    <div 
                      className="status-badge" 
                      style={{ 
                        backgroundColor: getStatusColor(trabalho.avaliacao.status),
                        color: 'white'
                      }}
                    >
                      {getStatusIcon(trabalho.avaliacao.status)}
                      <span>{getStatusText(trabalho.avaliacao.status)}</span>
                    </div>
                    
                    {trabalho.avaliacao.dataAvaliacao && (
                      <span className="data-avaliacao">
                        Avaliado em {formatarData(trabalho.avaliacao.dataAvaliacao)}
                      </span>
                    )}
                  </div>

                  {trabalho.avaliacao.avaliadorComentarios && (
                    <div className="comentarios-avaliador">
                      <div className="comentarios-header">
                        <MessageSquare size={16} />
                        <span>Comentários do Avaliador:</span>
                      </div>
                      <div className="comentarios-texto">
                        {trabalho.avaliacao.avaliadorComentarios}
                      </div>
                    </div>
                  )}

                  {trabalho.avaliacao.status === 'necessita_alteracao' && (
                    <div className="acao-necessaria">
                      <AlertCircle size={16} />
                      <span>Ação necessária: Revise seu trabalho conforme os comentários e reenvie uma nova versão.</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="acoes-container">
          <Link href="/trabalhos/submeter" className="btn-novo-trabalho">
            <FileText size={18} />
            Enviar Novo Trabalho
          </Link>
          <button onClick={fetchMeusTrabalhos} className="btn-atualizar">
            Atualizar Status
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeusTrabalhos;

