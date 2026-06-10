"use client"
import { useState, useEffect, useMemo } from "react";
import { ICourse } from "../lib/types/events/event.t";
import { CogIcon, FilterX, Search } from "lucide-react";
import Link from "next/link";
import LoadingModal from "../components/LoadingModal";
import CreateCourseModal from "../components/CreateCourseModal";
import ConfirmationModal, { ModalProps } from "../components/ConfirmationModal";

//
//
export default function Page() {
    const [data, setData] = useState<{ data: ICourse[] }>({ data: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [createCourseModal, setCreateCourseModal] = useState<boolean>(false)
    //
    const [searchTerm, setSearchTerm] = useState('');
    const [filterIsOpen, setFilterIsOpen] = useState('all'); // 'all', 'true', 'false'
    const [filterIsFree, setFilterIsFree] = useState('all'); // 'all', 'true', 'false'
    const [filterType, setFilterType] = useState('all');     // 'all', 'tipo1', 'tipo2'...
    const [filterShowToUser, setFilterShowToUser] = useState<string>('all') // 'all' | 'true' | 'false'
    const [confirmationModalProps, setConfirmationModalProps] = useState<ModalProps>({
        isOpen: false,
        onClose: () => { },
        onConfirm: () => { },
        title: "Atenção",
        children: <></>,
        confirmText: "string",
        cancelText: "string",
    })
    //
    const hydrateData = async () => {
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
    //
    useEffect(() => {
        hydrateData();
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

            // Filtro por showToUser
            const showToUserMatch = filterShowToUser === "all" || course.showToUser === (filterShowToUser === "false");
            //
            //
            return searchMatch && openMatch && freeMatch && typeMatch && showToUserMatch;
        });
    }, [data.data, searchTerm, filterIsOpen, filterIsFree, filterType, filterShowToUser]);

    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterIsOpen('all');
        setFilterIsFree('all');
        setFilterType('all');
        setFilterShowToUser("all")
    };

    const deleteACourse = async (course: ICourse) => {
        const deleteCourse = async () => {
            setLoading(true)
            setConfirmationModalProps((prev) => ({ ...prev, isOpen: false }))
            const response = await fetch("/api/delete/minicurso/", {
                method: "DELETE",
                body: JSON.stringify({
                    eventId: `${course._id}`
                })
            })
            if (!response.ok) {
                setLoading(false)
                const errorMessage: { message: string } = await response.json()
                alert(errorMessage.message)
                return;
            }
            const { message }: { message: string } = await response.json()
            await hydrateData()
            alert(message)
            setLoading(false)
        }
        setConfirmationModalProps({
            title: "Atenção!",
            isOpen: true,
            children: <p>Você está prestes a <span className="font-extrabold text-red-600">deletar permanentemente</span> a Atividade <span className="font-extrabold text-red-600">{course.name}</span>. Ao fazer isso, você <span className="font-extrabold text-red-600">perderá permanentemente</span> o acesso a lista de presença bem como qualquer outra informação da atividade. Deseja mesmo continuar?</p>,
            onClose: () => { setConfirmationModalProps((prev) => ({ ...prev, isOpen: false })) },
            onConfirm: () => {
                deleteCourse()
            },
            confirmText: "Sim",
            cancelText: "Não"

        })
    }
    //
    //


    //
    return (
        <div className="main-container" style={{
            background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat'
        }}>
            <ConfirmationModal {...confirmationModalProps} />
            <CreateCourseModal isOpen={createCourseModal} onClose={() => {
                setCreateCourseModal(false)
            }} onSuccess={async () => {
                await hydrateData()
            }} />
            <LoadingModal isLoading={loading} />
            <div className="w-full space-y-5 px-10">
                <div>
                    <span className="main-eyebrow">CIEPS / Atividades</span>
                    <h1 className="main-title">Gerenciar Atividades</h1>
                    <p className="main-subtitle">
                        Configure minicursos, visibilidade, vagas e cronogramas mantendo a operação do congresso organizada.
                    </p>
                </div>
                <div className="w-full flex items-center justify-center">
                    <button className="gm-create-btn" onClick={() => { setCreateCourseModal(true) }}>
                        CRIAR NOVA ATIVIDADE
                    </button>
                </div>
                {/* --- PAINEL DE BUSCA E FILTROS --- */}
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-4">
                            <label htmlFor="search" className="sr-only">Busca</label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input id="search" type="text" placeholder="Buscar por nome ou ID da atividade..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-md pl-10 shadow-sm sm:text-sm p-2.5" />
                            </div>
                        </div>
                        {/* Filtro showToUser */}
                        <div className="">
                            <label htmlFor="filterShowToUser" className="block text-sm font-medium text-white mb-1">Aberto ao público?</label>
                            <select id="filterShowToUser" value={filterShowToUser} onChange={e => setFilterShowToUser(e.target.value)} className="block w-full rounded-md shadow-sm sm:text-sm p-2.5">
                                <option value="all">Todos</option>
                                <option value="true">Fechado</option>
                                <option value="false">Aberto</option>
                            </select>
                        </div>
                        {/* Filtro Status */}
                        <div>
                            <label htmlFor="filterIsOpen" className="block text-sm font-medium text-white mb-1">Status</label>
                            <select id="filterIsOpen" value={filterIsOpen} onChange={e => setFilterIsOpen(e.target.value)} className="block w-full rounded-md shadow-sm sm:text-sm p-2.5">
                                <option value="all">Todos</option>
                                <option value="true">Inscrições Abertas</option>
                                <option value="false">Inscrições Encerradas</option>
                            </select>
                        </div>
                        {/* Filtro Preço */}
                        <div>
                            <label htmlFor="filterIsFree" className="block text-sm font-medium text-white mb-1">Preço</label>
                            <select id="filterIsFree" value={filterIsFree} onChange={e => setFilterIsFree(e.target.value)} className="block w-full rounded-md shadow-sm sm:text-sm p-2.5">
                                <option value="all">Todos</option>
                                <option value="true">Gratuito</option>
                                <option value="false">Pago</option>
                            </select>
                        </div>
                        {/* Filtro Tipo */}
                        <div>
                            <label htmlFor="filterType" className="block text-sm font-medium text-white mb-1">Tipo</label>
                            <select id="filterType" value={filterType} onChange={e => setFilterType(e.target.value)} className="block w-full rounded-md shadow-sm sm:text-sm p-2.5">
                                <option value="all">Todos os Tipos</option>
                                {courseTypes.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        {/* Botão Limpar */}
                    </div>
                    <div className="w-full flex content-center items-center justify-center">
                        <div className="w-fit flex items-center justify-center content-center">
                            <button onClick={handleResetFilters} className="gm-filter-reset w-full inline-flex items-center justify-center gap-2">
                                <FilterX className="h-4 w-4" />
                                Limpar Filtros
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- GRADE DE CARDS --- */}
                {
                    filteredCourses.length > 0 ? (
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {filteredCourses.map((value) => {
                                const vagasOcupadas = value.participants.length;
                                const vagasTotais = value.maxParticipants;
                                const vagasRemanescentes = vagasTotais - vagasOcupadas;
                                const percentualOcupado = vagasTotais > 0 ? (vagasOcupadas / vagasTotais) * 100 : 0;

                                return (
                                    <div className='gm-card flex flex-col overflow-hidden' key={value._id}>
                                        <div className="gm-card-header">
                                            <button className="gm-remove-btn" onClick={() => { deleteACourse(value) }}>REMOVER</button>
                                            {
                                                !value.showToUser ?
                                                    <p className="gm-badge gm-badge--danger">FECHADO AO USUÁRIO</p> :
                                                    <p className="gm-badge gm-badge--info">ABERTO AO USUÁRIO</p>
                                            }
                                        </div>
                                        <div className='gm-card-body flex-grow'>
                                            <div className="gm-divider"></div>
                                            <h2 className='text-xl font-bold text-gray-800 truncate' title={value.name}>{value.name}</h2>
                                            <p className="text-xs text-gray-400 font-mono mt-1 mb-6 truncate">ID: {value._id}</p>
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-3 text-center divide-x divide-gray-200">
                                                    <div><p className="text-2xl font-semibold text-gray-800">{vagasOcupadas}</p><p className="text-xs text-gray-500">Inscritos</p></div>
                                                    <div><p className="text-2xl font-semibold text-gray-800">{vagasRemanescentes}</p><p className="text-xs text-gray-500">Restantes</p></div>
                                                    <div><p className="text-2xl font-semibold text-gray-800">{vagasTotais}</p><p className="text-xs text-gray-500">Total</p></div>
                                                </div>
                                                <div>
                                                    <div className="gm-progress"><span style={{ width: `${percentualOcupado}%` }} /></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className='gm-footer'>
                                            <Link href={`/gerenciarMinicursos/configurar/${value._id}`} prefetch={false} className='gm-config-btn w-full inline-flex items-center justify-center gap-2'>
                                                <CogIcon className="h-4 w-4" />
                                                Configurar
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <p className="text-lg font-medium text-gray-700">Nenhuma atividade encontrada</p>
                            <p className="text-sm text-gray-500 mt-1">Tente ajustar os filtros ou o termo de busca.</p>
                        </div>
                    )
                }
            </div >
        </div>
    )
}
//
//
