'use client'
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import './style.css';
import { Users, ClipboardList, UserPlus, UserMinus, CheckCircle, Loader2 } from 'lucide-react';
import { ICourse, ILecture } from '../../lib/types/events/event.t';

interface DataStructure {
  data: ICourse[];
}

interface Usuario {
  _id: string,
  name: string,
  description: string,
  participants: string[],
  maxParticipants: number,
}

const MyComponent = () => {
  const [dataLecture, setDataLecture] = useState<ILecture[]>([])
  const [data, setData] = useState<DataStructure>({
    data: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [response, response2] = await Promise.all([
          await fetch('/api/get/listaMinicursos'),
          await fetch('/api/get/listaPalestras')
        ])
        if (!response.ok || !response2.ok) {
          throw new Error('Erro na resposta da rede');
        }
        const result2: { data: ILecture[] } = await response2.json()
        const result = await response.json();
        setDataLecture(result2.data)
        setData(result);
      } catch (error) {
        setError("OCORREU ALGO ERRADO. RECARREGUE");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Função para filtrar minicursos por nome ou ID
  const filterMinicurso = (minicurso: ICourse | ILecture) => {
    const nome = minicurso.name?.toLowerCase() || "";
    const id = minicurso._id?.toLowerCase() || "";
    const termo = search.toLowerCase();
    return nome.includes(termo) || id.includes(termo);
  };

  if (loading) {
    return (
      <div className="presenca-loading-container" style={{
        background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="presenca-spinner"><Loader2 size={48} className="animate-spin" /></div>
        <span className="presenca-loading-text">Carregando minicursos...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="presenca-main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <h1 className="presenca-title">LISTA DE PRESENÇA</h1>
      <div className="presenca-estatisticas">
        <div className="presenca-estatistica-card">
          <ClipboardList size={32} style={{ marginBottom: '0.3rem', color: 'var(--azul)' }} />
          <span className="presenca-estatistica-valor">{data.data.length}</span>
          <span className="presenca-estatistica-label">Total de Minicursos</span>
        </div>
        <div className="presenca-estatistica-card">
          <Users size={32} style={{ marginBottom: '0.3rem', color: 'var(--carmin)' }} />
          <span className="presenca-estatistica-valor">{data.data.reduce((acc, cur) => acc + cur.participants.length, 0)}</span>
          <span className="presenca-estatistica-label">Total de Inscritos</span>
        </div>
      </div>
      <div className="presenca-busca-container">
        <input
          type="text"
          className="presenca-busca"
          placeholder="Buscar por nome ou ID do minicurso..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="presenca-lista">
        {data.data.filter(filterMinicurso).map((value, idx) => (
          <div className="presenca-card fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }} key={value._id}>
            <div className="presenca-card-estatistica w-fit">{value.type}</div>
            <div className="presenca-card-header">
              <h2 className="presenca-nome">{value.name}</h2>
              <span className="presenca-id">ID: {value._id}</span>
            </div>
            <div className="presenca-card-estatisticas">
              <div className="presenca-card-estatistica"><UserPlus size={18} /> {value.maxParticipants}</div>
              <div className="presenca-card-estatistica"><CheckCircle size={18} /> {value.participants.length}</div>
              <div className="presenca-card-estatistica"><UserMinus size={18} /> {value.maxParticipants - value.participants.length}</div>
            </div>
            <div className="presenca-card-actions">
              <Link target='_blank' href={`presenca/gerarListaMinicursoPresenca/${value._id}`} prefetch={false} className='presenca-link'>GERAR LISTA DE PRESENÇA</Link>
            </div>
          </div>
        ))}
        {dataLecture.filter(filterMinicurso).map((value, idx) => (
          <div className="presenca-card fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }} key={value._id}>
            <div className="presenca-card-estatistica w-fit">{value.type}</div>
            <div className="presenca-card-header">
              <h2 className="presenca-nome">{value.name}</h2>
              <span className="presenca-id">ID: {value._id}</span>
            </div>
            <div className="presenca-card-estatisticas">
              <div className="presenca-card-estatistica"><CheckCircle size={18} />TODOS SÃO INSCRITOS</div>
            </div>
            <div className="presenca-card-actions">
              <Link target='_blank' href={`presenca/gerarListaPalestraPresenca/${value._id}`} prefetch={false} className='presenca-link'>GERAR LISTA DE PRESENÇA</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyComponent;
