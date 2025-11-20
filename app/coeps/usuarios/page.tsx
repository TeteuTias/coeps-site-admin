"use client"
import { useEffect, useMemo, useState } from "react"
import LoadingModal from "../components/LoadingModal"
import { IUser } from "../../lib/types/user/user.t"
import { User, Mail, Hash, Phone, Award, CreditCard, Ticket, BadgeCheck, BadgeX, BadgeAlert, ExternalLink, List, Search, SearchX, FilterX, CalendarDays, Users, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import './style.css'
import QrCodeUserSearch from "../components/QrCodeUserSearch"

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
            case 0: return <span className="usuarios-badge usuarios-badge-error"><BadgeX className="mr-1.5 h-4 w-4" />Não Inscrito</span>
            case 2: return <span className="usuarios-badge usuarios-badge-warning"><BadgeAlert className="mr-1.5 h-4 w-4" />Pagamento em Aberto</span>
            default: return <span className="usuarios-badge usuarios-badge-success"><BadgeCheck className="mr-1.5 h-4 w-4" />Inscrito</span>
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

    // Estatísticas
    const totalUsers = dataUsers.length
    const inscritos = dataUsers.filter(user => user.pagamento.situacao === 1).length
    const naoInscritos = dataUsers.filter(user => user.pagamento.situacao === 0).length
    const pagamentoAberto = dataUsers.filter(user => user.pagamento.situacao === 2).length

    if (loading) {
        return (
            <div className="usuarios-loading-container" style={{
                background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
                backgroundAttachment: 'fixed',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat'
            }}>
                <div className="usuarios-spinner"><Loader2 size={48} className="animate-spin" /></div>
                <span className="usuarios-loading-text">Carregando congressistas...</span>
            </div>
        );
    }

    return (
        <>
            <LoadingModal isLoading={loading} />

            <div className="usuarios-main-container" style={{
                background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
                backgroundAttachment: 'fixed',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat'
            }}>
                <h1 className="usuarios-title">CONGRESSISTAS</h1>
                <p className="usuarios-subtitle">Visualize e gerencie as informações dos usuários cadastrados</p>

                {/* Estatísticas */}
                <div className="usuarios-estatisticas">
                    <div className="usuarios-estatistica-card">
                        <Users size={32} style={{ marginBottom: '0.3rem', color: 'var(--azul)' }} />
                        <span className="usuarios-estatistica-valor">{totalUsers}</span>
                        <span className="usuarios-estatistica-label">Total de Usuários</span>
                    </div>
                    <div className="usuarios-estatistica-card">
                        <BadgeCheck size={32} style={{ marginBottom: '0.3rem', color: '#4CAF50' }} />
                        <span className="usuarios-estatistica-valor">{inscritos}</span>
                        <span className="usuarios-estatistica-label">Inscritos</span>
                    </div>
                    <div className="usuarios-estatistica-card">
                        <BadgeX size={32} style={{ marginBottom: '0.3rem', color: '#F44336' }} />
                        <span className="usuarios-estatistica-valor">{naoInscritos}</span>
                        <span className="usuarios-estatistica-label">Não Inscritos</span>
                    </div>
                    <div className="usuarios-estatistica-card">
                        <BadgeAlert size={32} style={{ marginBottom: '0.3rem', color: '#FF9800' }} />
                        <span className="usuarios-estatistica-valor">{pagamentoAberto}</span>
                        <span className="usuarios-estatistica-label">Pagamento Aberto</span>
                    </div>
                </div>

                {/* Filtros */}
                <div className="usuarios-filtros">
                    <div className="usuarios-filtros-grid">
                        <div className="usuarios-filtro-busca">
                            <label htmlFor="search" className="usuarios-label">
                                <Search className="h-5 w-5" />
                                Busca
                            </label>
                            <input
                                id="search"
                                type="text"
                                placeholder="Buscar por nome, e-mail, ID ou telefone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="usuarios-input"
                            />
                        </div>

                        <div className="usuarios-filtro-select">
                            <label htmlFor="status" className="usuarios-label">Status de Inscrição</label>
                            <select
                                id="status"
                                value={selectedStatus}
                                onChange={e => setSelectedStatus(e.target.value)}
                                className="usuarios-select"
                            >
                                <option value="">Todos os Status</option>
                                <option value="1">Inscrito</option>
                                <option value="0">Não Inscrito</option>
                                <option value="2">Pagamento em Aberto</option>
                            </select>
                        </div>

                        <div className="usuarios-filtro-select">
                            <label htmlFor="paymentType" className="usuarios-label">Tipo de Pagamento</label>
                            <select
                                id="paymentType"
                                value={selectedPaymentType}
                                onChange={e => setSelectedPaymentType(e.target.value)}
                                className="usuarios-select"
                            >
                                <option value="">Todos os Tipos</option>
                                {paymentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>

                        <div className="usuarios-filtro-datas">
                            <div className="usuarios-filtro-data">
                                <label htmlFor="startDate" className="usuarios-label">Criado de</label>
                                <input
                                    type="date"
                                    id="startDate"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="usuarios-input"
                                />
                            </div>
                            <div className="usuarios-filtro-data">
                                <label htmlFor="endDate" className="usuarios-label">Criado até</label>
                                <input
                                    type="date"
                                    id="endDate"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="usuarios-input"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex justify-between items-center content-center">
                        <button onClick={handleResetFilters} className="usuarios-btn usuarios-btn-secondary">
                            <FilterX className="h-5 w-5" />
                            Limpar Filtros
                        </button>
                    </div>
                </div>
                <div className="pb-5">
                    <QrCodeUserSearch titleText={"Pesquisa por QrCode"}/>
                </div>
                {/* Lista de Usuários */}
                {filteredUsers.length > 0 && (
                    <>
                        <div className="usuarios-header">
                            <h2 className="usuarios-header-title">
                                <List size={24} />
                                CLIQUE PARA VER DETALHES
                            </h2>
                        </div>

                        <div className="usuarios-grid">
                            {filteredUsers.map((user) => (
                                <div key={user._id} className="usuarios-card">
                                    <div className="usuarios-card-header">
                                        <div className="usuarios-avatar">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <div className="usuarios-user-info">
                                            <h3 className="usuarios-user-name" title={user.informacoes_usuario.nome}>
                                                {user.informacoes_usuario.nome}
                                            </h3>
                                            <p className="usuarios-user-email" title={user.informacoes_usuario.email}>
                                                <Mail className="h-4 w-4" />
                                                {user.informacoes_usuario.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="usuarios-card-content">
                                        <div className="usuarios-info-item">
                                            <Hash className="h-4 w-4" />
                                            <span className="usuarios-info-label">ID:</span>
                                            <span className="usuarios-info-value">{user._id}</span>
                                        </div>
                                        <div className="usuarios-info-item">
                                            <Phone className="h-4 w-4" />
                                            <span className="usuarios-info-label">Telefone:</span>
                                            <span className="usuarios-info-value">{user.informacoes_usuario.numero_telefone}</span>
                                        </div>
                                        <div className="usuarios-info-item">
                                            <CalendarDays className="h-4 w-4" />
                                            <span className="usuarios-info-label">Criação:</span>
                                            <span className="usuarios-info-value">
                                                {new Date(user.informacoes_usuario.data_criacao).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="usuarios-card-payment">
                                        <h4 className="usuarios-payment-title">
                                            <CreditCard className="h-5 w-5" />
                                            Informações de Pagamento
                                        </h4>
                                        <div className="usuarios-payment-info">
                                            <div className="usuarios-payment-item">
                                                <span className="usuarios-payment-label">Situação:</span>
                                                {getSituacaoBadge(user.pagamento.situacao)}
                                            </div>
                                            <div className="usuarios-payment-item">
                                                <span className="usuarios-payment-label">Tipo:</span>
                                                <span className="usuarios-payment-type">
                                                    {user.pagamento.tipo_pagamento || "N/D"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="usuarios-card-actions">
                                        <button
                                            className="usuarios-btn usuarios-btn-primary"
                                            onClick={() => router.push(`/usuarios/informacoes/${user._id}`)}
                                        >
                                            <ExternalLink size={18} />
                                            VER DETALHES
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Estado vazio */}
                {filteredUsers.length === 0 && (
                    <div className="usuarios-empty">
                        {searchTerm || selectedStatus || selectedPaymentType || startDate || endDate ? (
                            <>
                                <SearchX className="usuarios-empty-icon" />
                                <h3 className="usuarios-empty-title">Nenhum resultado encontrado</h3>
                                <p className="usuarios-empty-text">Tente ajustar ou limpar os filtros aplicados.</p>
                            </>
                        ) : (
                            <>
                                <Ticket className="usuarios-empty-icon" />
                                <h3 className="usuarios-empty-title">Nenhum congressista encontrado</h3>
                                <p className="usuarios-empty-text">Ainda não há usuários cadastrados no sistema.</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}