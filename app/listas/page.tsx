'use client'
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { Search, FilterX, ListChecks, Users } from "lucide-react";
import { ICourse } from '../lib/types/events/event.t';

const MyComponent = () => {
  const [data, setData] = useState<{ data: ICourse[] }>({ data: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  //
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIsOpen, setFilterIsOpen] = useState('all'); // 'all', 'true', 'false'
  const [filterIsFree, setFilterIsFree] = useState('all'); // 'all', 'true', 'false'
  const [filterType, setFilterType] = useState('all');     // 'all', 'tipo1', 'tipo2'...

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/get/listaMinicursos');
        if (!response.ok) throw new Error('Erro na resposta da rede');
        const result: { data: ICourse[] } = await response.json();
        setData(result);
      } catch (error) {
        setError("OCORREU ALGO ERRADO. RECARREGUE");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  //
  const courseTypes = useMemo(() => {
    if (!data.data) return [];
    return Array.from(new Set(data.data.map(course => course.type)));
  }, [data.data]);

  const filteredCourses = useMemo(() => {
    if (!data.data) return [];
    return data.data.filter(course => {
      // Filtro de busca por nome ou ID
      const searchMatch = searchTerm === '' ||
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course._id.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de Inscrições Abertas/Fechadas
      const openMatch = filterIsOpen === 'all' || course.isOpen.toString() === filterIsOpen;

      // Filtro de Gratuito/Pago
      const freeMatch = filterIsFree === 'all' || course.isFree.toString() === filterIsFree;

      // Filtro por Tipo de Minicurso
      const typeMatch = filterType === 'all' || course.type === filterType;

      return searchMatch && openMatch && freeMatch && typeMatch;
    });
  }, [data.data, searchTerm, filterIsOpen, filterIsFree, filterType]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterIsOpen('all');
    setFilterIsFree('all');
    setFilterType('all');
  };

  if (loading) return <div className="text-center p-10">Carregando...</div>;
  if (error) return <div className="text-red-500 text-center p-10">{error}</div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho da Página */}
        <header className="pb-8 mb-8 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Seleção de Minicursos</h1>
              <p className="mt-1 text-md text-gray-600">Escolha um minicurso abaixo para gerar a lista de presença.</p>
            </div>
            <div className="w-full sm:w-auto">
              <Link target='_blank' href={`/gerarListaPalestras/`} prefetch={false} className='w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'>
                <Users className="h-4 w-4" />
                Gerar Lista - Todos Congressistas
              </Link>
            </div>
          </div>
        </header>

        {/* --- PAINEL DE BUSCA E FILTROS --- */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-4">
              <label htmlFor="search" className="sr-only">Busca</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input id="search" type="text" placeholder="Buscar por nome ou ID do minicurso..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
              </div>
            </div>
            {/* Filtro Status */}
            <div>
              <label htmlFor="filterIsOpen" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select id="filterIsOpen" value={filterIsOpen} onChange={e => setFilterIsOpen(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
                <option value="all">Todos</option>
                <option value="true">Inscrições Abertas</option>
                <option value="false">Inscrições Encerradas</option>
              </select>
            </div>
            {/* Filtro Preço */}
            <div>
              <label htmlFor="filterIsFree" className="block text-sm font-medium text-gray-700 mb-1">Preço</label>
              <select id="filterIsFree" value={filterIsFree} onChange={e => setFilterIsFree(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
                <option value="all">Todos</option>
                <option value="true">Gratuito</option>
                <option value="false">Pago</option>
              </select>
            </div>
            {/* Filtro Tipo */}
            <div>
              <label htmlFor="filterType" className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select id="filterType" value={filterType} onChange={e => setFilterType(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
                <option value="all">Todos os Tipos</option>
                {courseTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            {/* Botão Limpar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 invisible">Ação</label>
              <button onClick={handleResetFilters} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors">
                <FilterX className="h-4 w-4" />
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* --- GRADE DE CARDS --- */}
        {filteredCourses.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {filteredCourses.map((value) => {
              const vagasOcupadas = value.participants.length;
              const vagasTotais = value.maxParticipants;
              const vagasRemanescentes = vagasTotais - vagasOcupadas;
              const percentualOcupado = vagasTotais > 0 ? (vagasOcupadas / vagasTotais) * 100 : 0;

              return (
                <div className='bg-white rounded-lg border border-gray-200 shadow-md flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300' key={value._id}>
                  <div className='p-6 flex-grow'>
                    <div className="border-b-4 border-indigo-500 w-16 mb-4"></div>
                    <h2 className='text-xl font-bold text-gray-800 truncate' title={value.name}>{value.name}</h2>
                    <p className="text-xs text-gray-400 font-mono mt-1 mb-6 truncate">ID: {value._id}</p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 text-center divide-x divide-gray-200">
                        <div><p className="text-2xl font-semibold text-gray-800">{vagasOcupadas}</p><p className="text-xs text-gray-500">Inscritos</p></div>
                        <div><p className="text-2xl font-semibold text-gray-800">{vagasRemanescentes}</p><p className="text-xs text-gray-500">Restantes</p></div>
                        <div><p className="text-2xl font-semibold text-gray-800">{vagasTotais}</p><p className="text-xs text-gray-500">Total</p></div>
                      </div>
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${percentualOcupado}%` }}></div></div>
                      </div>
                    </div>
                  </div>
                  <div className='bg-gray-50 p-4 border-t border-gray-200'>
                    <Link target='_blank' href={`/gerarListaMinicurso/${value._id}`} prefetch={false} className='w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors'>
                      <ListChecks className="h-4 w-4" />
                      Gerar Lista de Presença
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-lg font-medium text-gray-700">Nenhum minicurso encontrado</p>
            <p className="text-sm text-gray-500 mt-1">Tente ajustar os filtros ou o termo de busca.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyComponent;
