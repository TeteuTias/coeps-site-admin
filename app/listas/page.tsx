'use client'
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import './style.css';
import { Users, ListChecks, UserPlus, UserMinus, ClipboardList, Loader2 } from 'lucide-react';
import { ICourse, ILecture } from '../lib/types/events/event.t';
import { useMemo } from 'react';


interface Usuario {
  _id: string,
  name: string,
  description: string,
  participants: string[],
  maxParticipants: number,
}


const MyComponent = () => {
  const [data, setData] = useState<{ data: ICourse[] }>({ data: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");

  //
  const [dataLecture, setDataLecture] = useState<ILecture[]>([])
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIsOpen, setFilterIsOpen] = useState('all'); // 'all', 'true', 'false'
  const [filterIsFree, setFilterIsFree] = useState('all'); // 'all', 'true', 'false'
  const [filterType, setFilterType] = useState('all');     // 'all', 'tipo1', 'tipo2'...

  useEffect(() => {
    const fetchData = async () => {
      try {

        const [response, responsePalestras] = await Promise.all([
          await fetch('/api/get/listaMinicursos'),
          await fetch('/api/get/listaPalestras')
        ])

        if (!response.ok || !responsePalestras.ok) throw new Error('Erro na resposta da rede');
        const result: { data: ICourse[] } = await response.json();
        const result2: { data: ILecture[] } = await responsePalestras.json()
        setData(result);
        setDataLecture(result2.data);
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
      <div className="listas-loading-container" role="status" aria-live="polite">
        <div className="listas-spinner"><Loader2 size={48} className="animate-spin" /></div>
        <span className="listas-loading-text">Carregando...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="admin-state admin-state--error" role="alert">
        <span className="admin-state__mark">!</span>
        <h1>Não foi possível carregar a programação</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="listas-main-container">
      <span className="main-eyebrow">CIEPS / Relatórios</span>
      <h1 className="listas-title">Listas de participantes</h1>
      <p className="main-subtitle">
        Consulte as atividades e gere listas prontas para conferência ou impressão.
      </p>
      <div className="listas-estatisticas">
        <div className="listas-estatistica-card">
          <ClipboardList size={32} style={{ marginBottom: '0.3rem', color: 'var(--azul)' }} />
          <span className="listas-estatistica-valor">{data.data.length}</span>
          <span className="listas-estatistica-label">Total</span>
        </div>
        <div className="listas-estatistica-card">
          <Users size={32} style={{ marginBottom: '0.3rem', color: 'var(--carmin)' }} />
          <span className="listas-estatistica-valor">{data.data.reduce((acc, cur) => acc + cur.participants.length, 0)}</span>
          <span className="listas-estatistica-label">Total de Inscritos</span>
        </div>
      </div>
      <div className="listas-busca-container">
        <input
          type="text"
          className="listas-busca"
          placeholder="Buscar por nome ou ID da atividade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="listas-lista">
        {data.data.filter(filterMinicurso).map((value, idx) => (
          <div className="listas-card fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }} key={value._id}>
            <div className="listas-card-estatisticas">
              <div className="listas-card-estatistica">
                <p>{value.type}</p>
              </div>
            </div>
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
        {dataLecture.filter(filterMinicurso).map((value, idx) => (
          <div className="listas-card fadeInUp" style={{ animationDelay: `${0.1 * idx}s` }} key={value._id}>
            <div className="listas-card-estatisticas">
              <div className="listas-card-estatistica">
                <p>{value.type}</p>
              </div>
            </div>
            <div className="listas-card-header">
              <h2 className="listas-nome">{value.name}</h2>
              <span className="listas-id">ID: {value._id}</span>
            </div>
            <div className="listas-card-estatisticas">
              <div className="listas-card-estatistica"><ListChecks size={18} />TODOS SÃO INSCRITOS</div>
            </div>
            <div className="listas-card-actions">
              <Link target='_blank' href={`/gerarListaPalestras/`} prefetch={false} className='listas-link'>GERAR LISTA</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyComponent;
