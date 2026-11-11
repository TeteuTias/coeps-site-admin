"use client"
import { useEffect, useState } from "react"
import {
    type AdminUserSummary,
    adminDateToIso,
    displayUserField,
    displayUserName,
    normalizeAdminUserList,
} from "../lib/users/admin-user-contract"
import { CONGRESSISTAS_MIN_QUERY_LENGTH } from "../lib/users/congressistas-busca"
import { participationModeLabel } from "../lib/users/admin-remote-work"
import { User, Mail, Hash, Phone, Award, CreditCard, Ticket, BadgeCheck, BadgeX, BadgeAlert, ExternalLink, List, Search, SearchX, FilterX, CalendarDays, Users, Loader2, Laptop, MapPin, FileCheck2, Briefcase, IdCard, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"
import './style.css'
import QrCodeUserSearch from "../components/QrCodeUserSearch"

const formatUserCreationDate = (value: string | null) => {
    const iso = adminDateToIso(value)
    const date = iso ? new Date(iso) : null
    return date ? date.toLocaleDateString("pt-BR") : "Data não informada"
}

interface CongressistasResumo {
    total: number
    inscritos: number
    naoInscritos: number
    pagamentoAberto: number
    participantesRemotos: number
    paymentTypes: string[]
}

interface CongressistasPagina {
    users: AdminUserSummary[]
    total: number
    page: number
    totalPages: number
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

const parseResumo = (value: unknown): CongressistasResumo | null => {
    if (typeof value !== "object" || value === null) return null
    const r = value as Record<string, unknown>
    if (![r.total, r.inscritos, r.naoInscritos, r.pagamentoAberto, r.participantesRemotos].every(isCount)) return null
    if (!Array.isArray(r.paymentTypes) || !r.paymentTypes.every((type) => typeof type === "string")) return null
    return r as unknown as CongressistasResumo
}

const parsePagina = (value: unknown): CongressistasPagina | null => {
    if (typeof value !== "object" || value === null) return null
    const r = value as Record<string, unknown>
    const users = normalizeAdminUserList(r.data)
    if (!users || !isCount(r.total) || !isCount(r.page) || !isCount(r.totalPages)) return null
    return { users, total: r.total, page: r.page, totalPages: r.totalPages }
}

const responseMessage = (payload: unknown, fallback: string) =>
    typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : fallback

export default function Page() {
    const router = useRouter()

    const [resumo, setResumo] = useState<CongressistasResumo | null>(null)
    const [resumoFailed, setResumoFailed] = useState<boolean>(false)

    const [searchTerm, setSearchTerm] = useState<string>("")
    const [debouncedTerm, setDebouncedTerm] = useState<string>("")
    const [selectedStatus, setSelectedStatus] = useState<string>("")
    const [selectedPaymentType, setSelectedPaymentType] = useState<string>("")
    const [selectedParticipationMode, setSelectedParticipationMode] = useState<string>("")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")

    const [pageState, setPageState] = useState<{ key: string, page: number }>({ key: "", page: 1 })
    const [retryTick, setRetryTick] = useState<number>(0)
    const [results, setResults] = useState<CongressistasPagina | null>(null)
    const [searching, setSearching] = useState<boolean>(false)
    const [searchError, setSearchError] = useState<string | null>(null)

    // Resumo (estatísticas e tipos de pagamento): carregado uma vez, sem bloquear a tela.
    useEffect(() => {
        const controller = new AbortController()
        const loadResumo = async () => {
            try {
                const response = await fetch("/api/get/congressistasResumo/", { cache: "no-store", signal: controller.signal })
                const payload: unknown = await response.json().catch(() => null)
                const parsed = response.ok ? parseResumo(payload) : null
                if (!parsed) throw new Error("resumo inválido")
                setResumo(parsed)
            } catch {
                if (!controller.signal.aborted) setResumoFailed(true)
            }
        }
        void loadResumo()
        return () => controller.abort()
    }, [])

    // Debounce da digitação.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 400)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const hasOtherFilter = Boolean(selectedStatus || selectedPaymentType || selectedParticipationMode || startDate || endDate)
    const searchActive = debouncedTerm.length >= CONGRESSISTAS_MIN_QUERY_LENGTH || hasOtherFilter
    const queryKey = JSON.stringify([debouncedTerm, selectedStatus, selectedPaymentType, selectedParticipationMode, startDate, endDate])
    // Mudou busca ou filtro: volta para a página 1.
    const currentPage = pageState.key === queryKey ? pageState.page : 1

    useEffect(() => {
        if (!searchActive) {
            setResults(null)
            setSearching(false)
            setSearchError(null)
            return
        }
        // O AbortController descarta a resposta antiga quando uma nova busca começa.
        const controller = new AbortController()
        const run = async () => {
            setSearching(true)
            setSearchError(null)
            try {
                const params = new URLSearchParams()
                if (debouncedTerm) params.set("q", debouncedTerm)
                if (selectedStatus) params.set("status", selectedStatus)
                if (selectedPaymentType) params.set("paymentType", selectedPaymentType)
                if (selectedParticipationMode) params.set("mode", selectedParticipationMode)
                if (startDate) params.set("startDate", startDate)
                if (endDate) params.set("endDate", endDate)
                params.set("page", String(currentPage))
                const response = await fetch(`/api/get/congressistasBusca/?${params.toString()}`, { cache: "no-store", signal: controller.signal })
                const payload: unknown = await response.json().catch(() => null)
                const parsed = response.ok ? parsePagina(payload) : null
                if (!parsed) {
                    throw new Error(responseMessage(payload, response.ok
                        ? "A lista de congressistas recebida está em formato inválido."
                        : "Não foi possível buscar os congressistas."))
                }
                if (controller.signal.aborted) return
                setResults(parsed)
                setSearching(false)
            } catch (cause) {
                if (controller.signal.aborted) return
                setResults(null)
                setSearchError(cause instanceof Error ? cause.message : "Não foi possível buscar os congressistas.")
                setSearching(false)
            }
        }
        void run()
        return () => controller.abort()
    }, [searchActive, debouncedTerm, selectedStatus, selectedPaymentType, selectedParticipationMode, startDate, endDate, currentPage, retryTick])

    const paymentTypes = resumo?.paymentTypes ?? []

    const handleResetFilters = () => {
        setSearchTerm("")
        setDebouncedTerm("")
        setSelectedStatus("")
        setSelectedPaymentType("")
        setSelectedParticipationMode("")
        setStartDate("")
        setEndDate("")
    }

    const getSituacaoBadge = (situacao: AdminUserSummary["pagamento"]["situacao"]) => {
        switch (situacao) {
            case 0: return <span className="usuarios-badge usuarios-badge-error"><BadgeX className="mr-1.5 h-4 w-4" />Não Inscrito</span>
            case 1: return <span className="usuarios-badge usuarios-badge-success"><BadgeCheck className="mr-1.5 h-4 w-4" />Inscrito</span>
            case 2: return <span className="usuarios-badge usuarios-badge-warning"><BadgeAlert className="mr-1.5 h-4 w-4" />Pagamento em Aberto</span>
            case 3: return <span className="usuarios-badge usuarios-badge-warning"><BadgeAlert className="mr-1.5 h-4 w-4" />Suspenso</span>
            default: return <span className="usuarios-badge usuarios-badge-warning"><BadgeAlert className="mr-1.5 h-4 w-4" />Status não informado</span>
        }
    }

    const stat = (value: number | undefined) => resumo ? value : resumoFailed ? "—" : "…"

    return (
        <>
            <div className="usuarios-main-container">
                <span className="main-eyebrow">CIEPS / Pessoas</span>
                <h1 className="usuarios-title">Congressistas</h1>
                <p className="usuarios-subtitle">Visualize e gerencie as informações dos usuários cadastrados.</p>

                {/* Estatísticas */}
                <div className="usuarios-estatisticas">
                    <div className="usuarios-estatistica-card">
                        <Users size={32} style={{ marginBottom: '0.3rem', color: 'var(--azul)' }} />
                        <span className="usuarios-estatistica-valor">{stat(resumo?.total)}</span>
                        <span className="usuarios-estatistica-label">Total de Usuários</span>
                    </div>
                    <div className="usuarios-estatistica-card">
                        <BadgeCheck size={32} style={{ marginBottom: '0.3rem', color: '#4CAF50' }} />
                        <span className="usuarios-estatistica-valor">{stat(resumo?.inscritos)}</span>
                        <span className="usuarios-estatistica-label">Inscritos</span>
                    </div>
                    <div className="usuarios-estatistica-card">
                        <BadgeX size={32} style={{ marginBottom: '0.3rem', color: '#F44336' }} />
                        <span className="usuarios-estatistica-valor">{stat(resumo?.naoInscritos)}</span>
                        <span className="usuarios-estatistica-label">Não Inscritos</span>
                    </div>
                    <div className="usuarios-estatistica-card">
                        <BadgeAlert size={32} style={{ marginBottom: '0.3rem', color: '#FF9800' }} />
                        <span className="usuarios-estatistica-valor">{stat(resumo?.pagamentoAberto)}</span>
                        <span className="usuarios-estatistica-label">Pagamento Aberto</span>
                    </div>
                    <div className="usuarios-estatistica-card">
                        <Laptop size={32} style={{ marginBottom: '0.3rem', color: '#2563EB' }} />
                        <span className="usuarios-estatistica-valor">{stat(resumo?.participantesRemotos)}</span>
                        <span className="usuarios-estatistica-label">Acesso Remoto</span>
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
                                placeholder="Digite pelo menos 4 letras: nome, e-mail, ID ou telefone..."
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
                                <option value="3">Suspenso</option>
                            </select>
                        </div>

                        <div className="usuarios-filtro-select">
                            <label htmlFor="participationMode" className="usuarios-label">Modalidade de Participação</label>
                            <select
                                id="participationMode"
                                value={selectedParticipationMode}
                                onChange={e => setSelectedParticipationMode(e.target.value)}
                                className="usuarios-select"
                            >
                                <option value="">Todas as Modalidades</option>
                                <option value="REGULAR">Regular</option>
                                <option value="REMOTE">Somente remoto</option>
                                <option value="BOTH">Regular + remoto</option>
                                <option value="NONE">Sem acesso</option>
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
                {results && results.users.length > 0 && (
                    <>
                        <div className="usuarios-header">
                            <h2 className="usuarios-header-title">
                                <List size={24} />
                                CLIQUE PARA VER DETALHES
                                {searching && <Loader2 size={18} className="animate-spin" aria-label="Atualizando resultados" />}
                            </h2>
                        </div>

                        <div className="usuarios-grid">
                            {results?.users.map((user) => (
                                <div key={user._id} className="usuarios-card">
                                    <div className="usuarios-card-header">
                                        <div className="usuarios-avatar">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <div className="usuarios-user-info">
                                            <h3 className="usuarios-user-name" title={displayUserName(user)}>
                                                {displayUserName(user)}
                                            </h3>
                                            <p className="usuarios-user-email" title={displayUserField(user.informacoes_usuario.email)}>
                                                <Mail className="h-4 w-4" />
                                                {displayUserField(user.informacoes_usuario.email)}
                                            </p>
                                            {user.cadastroPendente && (
                                                <span className="usuarios-badge usuarios-badge-warning">
                                                    <BadgeAlert className="mr-1.5 h-4 w-4" />Cadastro pendente
                                                </span>
                                            )}
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
                                            <span className="usuarios-info-value">{displayUserField(user.informacoes_usuario.numero_telefone)}</span>
                                        </div>
                                        {user.informacoes_usuario.profissao && (
                                            <div className="usuarios-info-item">
                                                <Briefcase className="h-4 w-4" />
                                                <span className="usuarios-info-label">Profissão:</span>
                                                <span className="usuarios-info-value">{user.informacoes_usuario.profissao}</span>
                                            </div>
                                        )}
                                        {user.informacoes_usuario.matricula_municipio && (
                                            <div className="usuarios-info-item">
                                                <IdCard className="h-4 w-4" />
                                                <span className="usuarios-info-label">Matrícula do município:</span>
                                                <span className="usuarios-info-value">{user.informacoes_usuario.matricula_municipio}</span>
                                            </div>
                                        )}
                                        {user.informacoes_usuario.unidade_origem && (
                                            <div className="usuarios-info-item">
                                                <Building2 className="h-4 w-4" />
                                                <span className="usuarios-info-label">Unidade de Origem:</span>
                                                <span className="usuarios-info-value">{user.informacoes_usuario.unidade_origem}</span>
                                            </div>
                                        )}
                                        <div className="usuarios-info-item">
                                            <CalendarDays className="h-4 w-4" />
                                            <span className="usuarios-info-label">Criação:</span>
                                            <span className="usuarios-info-value">
                                                {formatUserCreationDate(user.informacoes_usuario.data_criacao)}
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

                                    <div className="usuarios-card-payment">
                                        <h4 className="usuarios-payment-title">
                                            <Laptop className="h-5 w-5" />
                                            Participação em Trabalhos
                                        </h4>
                                        <div className="usuarios-payment-info">
                                            <div className="usuarios-payment-item">
                                                <span className="usuarios-payment-label">Modalidade:</span>
                                                <span className="usuarios-payment-type">{participationModeLabel(user.participacao.mode)}</span>
                                            </div>
                                            <div className="usuarios-info-item">
                                                <MapPin className="h-4 w-4" />
                                                <span className="usuarios-info-label">Cidade/UF:</span>
                                                <span className="usuarios-info-value">
                                                    {user.participacao.municipalityName && user.participacao.uf
                                                        ? `${user.participacao.municipalityName}/${user.participacao.uf}`
                                                        : "Não informado"}
                                                </span>
                                            </div>
                                            <div className="usuarios-info-item">
                                                <FileCheck2 className="h-4 w-4" />
                                                <span className="usuarios-info-label">Comprovante:</span>
                                                <span className="usuarios-info-value">
                                                    {user.participacao.proof
                                                        ? `${user.participacao.reviewStatus ?? "PENDING"} · ${formatUserCreationDate(user.participacao.proof.uploadedAt)}`
                                                        : "Não enviado"}
                                                </span>
                                            </div>
                                            <div className="usuarios-payment-item">
                                                <span className="usuarios-payment-label">Financeiro:</span>
                                                <span className="usuarios-payment-type">{user.participacao.status ?? "SEM ACESSO"}</span>
                                            </div>
                                            <div className="usuarios-payment-item">
                                                <span className="usuarios-payment-label">Trabalhos remotos:</span>
                                                <span className="usuarios-payment-type">{user.participacao.remoteWorkCount}</span>
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

                {results && results.users.length > 0 && (
                    <div className="usuarios-paginacao">
                        <button
                            type="button"
                            className="usuarios-btn usuarios-btn-secondary"
                            disabled={searching || results.page <= 1}
                            onClick={() => setPageState({ key: queryKey, page: results.page - 1 })}
                        >
                            Anterior
                        </button>
                        <span className="usuarios-paginacao-texto" role="status" aria-live="polite">
                            Página {results.page} de {results.totalPages} · {results.total} {results.total === 1 ? "resultado" : "resultados"}
                        </span>
                        <button
                            type="button"
                            className="usuarios-btn usuarios-btn-secondary"
                            disabled={searching || results.page >= results.totalPages}
                            onClick={() => setPageState({ key: queryKey, page: results.page + 1 })}
                        >
                            Próxima
                        </button>
                    </div>
                )}

                {/* Estados sem lista */}
                {!searchActive && (
                    <div className="usuarios-empty">
                        <Search className="usuarios-empty-icon" />
                        <h3 className="usuarios-empty-title">Digite pelo menos 4 letras para buscar um congressista</h3>
                        <p className="usuarios-empty-text">Pesquise por nome, e-mail, ID ou telefone, ou use algum dos filtros acima.</p>
                    </div>
                )}
                {searchActive && searching && !results && !searchError && (
                    <div className="usuarios-empty" role="status" aria-live="polite">
                        <Loader2 className="usuarios-empty-icon animate-spin" />
                        <h3 className="usuarios-empty-title">Buscando congressistas...</h3>
                    </div>
                )}
                {searchActive && searchError && (
                    <div className="usuarios-empty" role="alert">
                        <SearchX className="usuarios-empty-icon" />
                        <h3 className="usuarios-empty-title">Não foi possível buscar os congressistas</h3>
                        <p className="usuarios-empty-text">{searchError}</p>
                        <button type="button" className="usuarios-btn usuarios-btn-primary" onClick={() => setRetryTick((tick) => tick + 1)}>
                            Tentar novamente
                        </button>
                    </div>
                )}
                {searchActive && !searching && !searchError && results && results.users.length === 0 && (
                    <div className="usuarios-empty">
                        <SearchX className="usuarios-empty-icon" />
                        <h3 className="usuarios-empty-title">Nenhum resultado encontrado</h3>
                        <p className="usuarios-empty-text">Tente ajustar ou limpar os filtros aplicados.</p>
                    </div>
                )}
            </div>
        </>
    )
}
