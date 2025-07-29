"use client"
import { useEffect, useMemo, useState } from "react"
import LoadingModal from "../components/LoadingModal"
import { IUser } from "../lib/types/user/user.t"
import Link from "next/link"
import { User, Mail, Hash, Phone, Award, CreditCard, Ticket, BadgeCheck, BadgeX, BadgeAlert, Clapperboard, ExternalLink, List, FileText, Search, SearchX, Filter, FilterX, CalendarDays } from "lucide-react"
import { IPayment } from "../lib/types/payments/payment.t"
import { useRouter } from "next/navigation"


export default function Page() {
    const [loading, setLoading] = useState<boolean>(true)
    const [dataUsers, setDataUsers] = useState<IUser[]>([])
    const router = useRouter()

    const [searchTerm, setSearchTerm] = useState<string>("")
    const [selectedStatus, setSelectedStatus] = useState<string>("")
    const [selectedPaymentType, setSelectedPaymentType] = useState<string>("")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")

    const hydrate = async () => {
        const response = await fetch(`/api/get/todosCongressistas/`)
        const dataUsers: { data: IUser[] } = await response.json()
        setDataUsers(dataUsers.data)
        setLoading(false)
    }

    useEffect(() => {
        hydrate()
    }, [])

    const paymentTypes = useMemo(() => {
        if (!dataUsers.length) return []
        const types = new Set(dataUsers.map(user => user.pagamento.tipo_pagamento).filter(Boolean))
        return Array.from(types)
    }, [dataUsers])

    const handleResetFilters = () => {
        setSearchTerm("")
        setSelectedStatus("")
        setSelectedPaymentType("")
        setStartDate("")
        setEndDate("")
    }

    const getSituacaoBadge = (situacao: number) => {
        switch (situacao) {
            case 0: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><BadgeX className="mr-1.5 h-4 w-4" />Não Inscrito</span>
            case 2: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><BadgeAlert className="mr-1.5 h-4 w-4" />Pagamento em Aberto</span>
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><BadgeCheck className="mr-1.5 h-4 w-4" />Inscrito</span>
        }
    }

    const filteredUsers = dataUsers.filter(user => {
        const term = searchTerm.toLowerCase()
        const creationDate = new Date(user.informacoes_usuario.data_criacao).toISOString().split('T')[0]

        const searchMatch = term === "" ||
            user?._id?.toLowerCase()?.includes(term) ||
            user?.informacoes_usuario?.email?.toLowerCase()?.includes(term) ||
            user?.informacoes_usuario?.nome.toLowerCase()?.includes(term) ||
            user?.informacoes_usuario?.numero_telefone?.includes(term)

        const statusMatch = selectedStatus === "" || user.pagamento.situacao === parseInt(selectedStatus, 10)
        const paymentTypeMatch = selectedPaymentType === "" || user.pagamento.tipo_pagamento === selectedPaymentType
        const startDateMatch = startDate === "" || creationDate >= startDate
        const endDateMatch = endDate === "" || creationDate <= endDate

        return searchMatch && statusMatch && paymentTypeMatch && startDateMatch && endDateMatch
    })

    return (
        <div className="w-full min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <LoadingModal isLoading={loading} />
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 tracking-tight w-full text-center">Congressistas</h1>
                    <p className="mt-2 text-lg text-gray-600 w-full text-center">Visualize e gerencie as informações dos usuários cadastrados.</p>
                </header>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-4">
                            <label htmlFor="search" className="sr-only">Busca</label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input id="search" type="text" placeholder="Buscar por nome, e-mail, ID ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status de Inscrição</label>
                            <select id="status" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
                                <option value="">Todos os Status</option>
                                <option value="1">Inscrito</option>
                                <option value="0">Não Inscrito</option>
                                <option value="2">Pagamento em Aberto</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="paymentType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pagamento</label>
                            <select id="paymentType" value={selectedPaymentType} onChange={e => setSelectedPaymentType(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
                                <option value="">Todos os Tipos</option>
                                {paymentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>

                        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Criado de</label>
                                <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Criado até</label>
                                <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                            </div>
                        </div>

                    </div>
                    <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end">
                        <button onClick={handleResetFilters} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                            <FilterX className="h-5 w-5" />
                            Limpar Filtros
                        </button>
                    </div>
                </div>
                {!loading && filteredUsers.length > 0 && (
                    <>
                        <div className="w-full text-center py-10">
                            <h1 className="text-2xl font-semibold">CLIQUE PARA DETALHES</h1>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[750px] overflow-auto">
                            {filteredUsers.map((user) => (
                                <div key={user._id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 bg-indigo-500 text-white rounded-full h-12 w-12 flex items-center justify-center">
                                                <User className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h2 className="text-xl font-semibold text-gray-900 truncate" title={user.informacoes_usuario.nome}>{user.informacoes_usuario.nome}</h2>
                                                <p className="text-sm text-gray-500 flex items-center gap-2 mt-1 truncate" title={user.informacoes_usuario.email}>
                                                    <Mail className="h-4 w-4 flex-shrink-0" />
                                                    <span>{user.informacoes_usuario.email}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-6 space-y-3 text-sm text-gray-700">
                                            <p className="flex items-center gap-2 text-xs"><Hash className="h-4 w-4 text-gray-400" /> <strong>ID:</strong> <span className="truncate">{user._id}</span></p>
                                            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" /> <strong>Telefone:</strong> {user.informacoes_usuario.numero_telefone}</p>
                                            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gray-400" /> <strong>Criação:</strong> {new Date(user.informacoes_usuario.data_criacao).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-200 bg-gray-50 p-6 flex-grow">
                                        <h3 className="text-base font-medium text-gray-800 mb-4 flex items-center gap-2"><CreditCard className="h-5 w-5 text-gray-500" /> Informações de Pagamento</h3>
                                        <div className="space-y-4 text-sm">
                                            <div className="flex justify-between items-center"><p className="font-medium text-gray-600">Situação:</p>{getSituacaoBadge(user.pagamento.situacao)}</div>
                                            <div className="flex justify-between items-center"><p className="font-medium text-gray-600">Tipo:</p><p className="text-gray-800 font-mono bg-gray-200 px-2 py-0.5 rounded">{user.pagamento.tipo_pagamento || "N/D"}</p></div>
                                        </div>
                                    </div>
                                    <div className="w-full py-10 flex items-center content-center justify-center">
                                        <button className="font-semibold text-sm px-4 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600"
                                            onClick={() => router.push(`/usuarios/informacoes/${user._id}`)}
                                        >DETALHES</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {!loading && filteredUsers.length === 0 && (
                    <div className="text-center py-16">
                        {searchTerm || selectedStatus || selectedPaymentType || startDate || endDate ? (
                            <>
                                <SearchX className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-xl font-medium text-gray-900">Nenhum resultado encontrado</h3>
                                <p className="mt-1 text-sm text-gray-500">Tente ajustar ou limpar os filtros aplicados.</p>
                            </>
                        ) : (
                            <>
                                <Ticket className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-xl font-medium text-gray-900">Nenhum congressista encontrado</h3>
                                <p className="mt-1 text-sm text-gray-500">Ainda não há usuários cadastrados no sistema.</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}