'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react';
import './style.css';
import { Download, Users, FileText } from 'lucide-react';
import Head from 'next/head';
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

interface DataStructure {
  data: Record<string, Document[]>;
  tradutor: Record<string, User>; // Mapeia userId para um único User
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

const MyComponent = () => {
  const [data, setData] = useState<DataStructure>({
    data: {},
    tradutor: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/get/trabalhos');
        if (!response.ok) {
          throw new Error('Erro na resposta da rede');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        setError("OCORREU ALGO ERRADO. RECARREGUE");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // O array vazio faz com que o efeito execute apenas uma vez ao montar

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

  if (loading) {
    return (
      <div className="trabalhos-loading-container">
        <div className="trabalhos-spinner"></div>
        <span className="trabalhos-loading-text">Carregando trabalhos...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <div className="trabalhos-main-container">
        <h1 className="trabalhos-title">TRABALHOS RECEBIDOS</h1>
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
            <span className="trabalhos-estatistica-label">Total de Arquivos Recebidos</span>
          </div>
        </div>
        <div className="trabalhos-busca-container">
          <input
            type="text"
            className="trabalhos-busca"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="trabalhos-lista">
          {Object.entries(data.data)
            .filter(([userId]) => {
              const userInfo = data.tradutor[userId];
              if (!userInfo) return false;
              return filterUser(userInfo);
            })
            .map(([userId, documents], idx) => {
              const userInfo = data.tradutor[userId];
              return (
                <div key={userId} className="trabalhos-card fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }}>
                  {userInfo ? (
                    <>
                      <h2 className="trabalhos-nome">{userInfo.informacoes_usuario.nome}</h2>
                      <div className="trabalhos-cpf">{formatCPF(userInfo.informacoes_usuario.cpf)}</div>
                      <h3 className="trabalhos-telefone">{formatPhone(userInfo.informacoes_usuario.numero_telefone)}</h3>
                    </>
                  ) : (
                    <p className="trabalhos-user-notfound">Usuário não encontrado</p>
                  )}
                  <ul className="trabalhos-arquivos">
                    {documents.map(doc => (
                      <li key={doc._id}>
                        <Link target='_blank' href={doc.url} prefetch={true} className="trabalhos-link">
                          <Download size={18} style={{marginRight: '0.4em', minWidth: 18}} />
                          {doc.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
};

export default MyComponent;
