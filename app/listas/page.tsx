'use client'
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import './style.css';
import { Users, ListChecks, UserPlus, UserMinus, ClipboardList, Loader2 } from 'lucide-react';

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
  data: Usuario[];
}

interface Usuario {
  _id: string,
  name: string,
  description: string,
  participants: string[],
  maxParticipants: number,
}

const PrintableComponent = () => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const newWindow = window.open('', '', 'width=800,height=600');
      newWindow?.document.write(`
        <html>
          <head>
            <title>Print</title>
            <style>
              /* Adicione seus estilos personalizados para impressão aqui */
              body { font-family: Arial, sans-serif; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      newWindow?.document.close();
      newWindow?.focus();
      newWindow?.print();
      newWindow?.close();
    }
  };

  return (
    <div className="p-4">
      <div ref={printRef} className="bg-white p-4 rounded-md shadow-md">
        <h1 className="text-xl font-bold mb-4">Printable Component</h1>
        <p>This is the content that will be printed.</p>
        <ul className="list-disc ml-4">
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </div>
      <button
        onClick={handlePrint}
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition"
      >
        Print this Component
      </button>
    </div>
  );
};


const MyComponent = () => {
  const [data, setData] = useState<DataStructure>({
    data: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/get/listaMinicursos');
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

  // Função para filtrar minicursos por nome ou ID
  const filterMinicurso = (minicurso: Usuario) => {
    const nome = minicurso.name?.toLowerCase() || "";
    const id = minicurso._id?.toLowerCase() || "";
    const termo = search.toLowerCase();
    return nome.includes(termo) || id.includes(termo);
  };

  if (loading) {
    return (
      <div className="listas-loading-container" style={{
        background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="listas-spinner"><Loader2 size={48} className="animate-spin" /></div>
        <span className="listas-loading-text">Carregando minicursos...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="listas-main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <h1 className="listas-title">MINICURSOS E PARTICIPANTES</h1>
      <div className="listas-estatisticas">
        <div className="listas-estatistica-card">
          <ClipboardList size={32} style={{marginBottom: '0.3rem', color: 'var(--azul)'}} />
          <span className="listas-estatistica-valor">{data.data.length}</span>
          <span className="listas-estatistica-label">Total de Minicursos</span>
        </div>
        <div className="listas-estatistica-card">
          <Users size={32} style={{marginBottom: '0.3rem', color: 'var(--carmin)'}} />
          <span className="listas-estatistica-valor">{data.data.reduce((acc, cur) => acc + cur.participants.length, 0)}</span>
          <span className="listas-estatistica-label">Total de Inscritos</span>
        </div>
      </div>
      <div className="listas-busca-container">
        <input
          type="text"
          className="listas-busca"
          placeholder="Buscar por nome ou ID do minicurso..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="listas-lista">
        {data.data.filter(filterMinicurso).map((value, idx) => (
          <div className="listas-card fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }} key={value._id}>
            <div className="listas-card-header">
              <h2 className="listas-nome">{value.name}</h2>
              <span className="listas-id">ID: {value._id}</span>
            </div>
            <div className="listas-card-estatisticas">
              <div className="listas-card-estatistica"><UserPlus size={18} /> {value.maxParticipants}</div>
              <div className="listas-card-estatistica"><ListChecks size={18} /> {value.participants.length}</div>
              <div className="listas-card-estatistica"><UserMinus size={18} /> {value.maxParticipants - value.participants.length}</div>
            </div>
            <div className="listas-card-actions">
              <Link target='_blank' href={`/gerarListaMinicurso/${value._id}`} prefetch={false} className='listas-link'>GERAR LISTA</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyComponent;
