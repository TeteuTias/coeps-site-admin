"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import LoadingModal from "../components/LoadingModal"
import { IAutomaticLotOccupancy, ILoteAutomatico, IPaymentConfig } from "../lib/types/payments/payment.t"
import { parseAdminPaymentConfigHttpResponse } from "../lib/payments/payment-config-contract"
import {
    type AdminUserSummary,
    displayUserField,
    displayUserName,
    filterAdminUsers,
    parseAdminUserListHttpResponse,
} from "../lib/users/admin-user-contract"
import { useRouter } from "next/navigation"
import './style.css'
import { Search, FilterX, CreditCard, DollarSign, Users, Settings, Plus, Trash2, Edit3, Save, X, AlertTriangle, Info, UserCheck, UserX, Tag, RefreshCw } from 'lucide-react'

type IParcelamento = IPaymentConfig["parcelamentos"][0];

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatCount = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const formatRemainingPlaces = (value: number) =>
    value === 1 ? "Resta 1 vaga" : `Restam ${formatCount(value)} vagas`;

const formatOccupancyTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(date);
};

const hasValidAutomaticStructure = (lots: unknown): lots is ILoteAutomatico[] => {
    if (!Array.isArray(lots) || lots.length === 0) return false;
    const lotCodes = new Set<number>();

    return lots.every((candidate) => {
        if (typeof candidate !== "object" || candidate === null) return false;
        const lot = candidate as Partial<ILoteAutomatico>;
        const lotCode = lot.codigo;
        const capacity = lot.limiteVagas;
        const prices = lot.precos;
        if (
            typeof lotCode !== "number" || !Number.isInteger(lotCode) || lotCode < 0 || lotCodes.has(lotCode) ||
            typeof lot.nome !== "string" || !lot.nome.trim() ||
            typeof capacity !== "number" || !Number.isInteger(capacity) || capacity <= 0 ||
            typeof prices !== "object" || prices === null ||
            ![prices.valorAVista, prices.valorBoleto, prices.valorDebito, prices.valorPix]
                .every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) ||
            !Array.isArray(prices.parcelamentos)
        ) {
            return false;
        }

        lotCodes.add(lotCode);
        const installmentCodes = new Set<number>();
        return prices.parcelamentos.every((installment) => {
            if (typeof installment !== "object" || installment === null) return false;
            if (
                !Number.isInteger(installment.codigo) || installment.codigo < 0 ||
                installmentCodes.has(installment.codigo) ||
                !Number.isInteger(installment.totalParcelas) || installment.totalParcelas <= 0 ||
                typeof installment.valorCadaParcela !== "number" ||
                !Number.isFinite(installment.valorCadaParcela) || installment.valorCadaParcela < 0
            ) {
                return false;
            }
            installmentCodes.add(installment.codigo);
            return true;
        });
    });
};

export default function Page() {
    const [loading, setLoading] = useState<boolean>(true)
    const [searchTerm, setSearchTerm] = useState<string>("")
    const [selectedStatus, setSelectedStatus] = useState<string>("")
    const [selectedPaymentType, setSelectedPaymentType] = useState<string>("")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [paymentData, setPaymentData] = useState<IPaymentConfig | null>(null)
    const [paymentDataError, setPaymentDataError] = useState<string | null>(null)
    const [payedUsers, setPayedUsers] = useState<AdminUserSummary[]>([])
    const [payedUsersLoading, setPayedUsersLoading] = useState(false)
    const [payedUsersError, setPayedUsersError] = useState<string | null>(null)
    const [editableParcelamentos, setEditableParcelamentos] = useState<IParcelamento[]>([]);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [isEditingParcelamentos, setIsEditingParcelamentos] = useState(false);
    const [editingLotCode, setEditingLotCode] = useState<number | null>(null);
    const [editableLot, setEditableLot] = useState<ILoteAutomatico | null>(null);
    const [lotOccupancy, setLotOccupancy] = useState<IAutomaticLotOccupancy | null>(null);
    const [lotOccupancyLoading, setLotOccupancyLoading] = useState(false);
    const [lotOccupancyError, setLotOccupancyError] = useState<string | null>(null);
    const [editableInfo, setEditableInfo] = useState({
        nome: '',
        edicaoId: '',
        valorAVista: 0,
        valorBoleto: 0,
        valorDebito: 0,
        valorPix: 0
    });
    const allPaymentTypes: IPaymentConfig["pagamentosAceitos"] = ["PIX", "BOLETO", "CREDIT_CARD", "DEBIT_CARD"]

    const loadLotOccupancy = useCallback(async (configId: string) => {
        setLotOccupancyLoading(true);
        setLotOccupancyError(null);

        try {
            const response = await fetch(
                `/api/get/pagamentos/ocupacaoLotes?configId=${encodeURIComponent(configId)}`,
                { cache: "no-store" },
            );
            const payload = await response.json().catch(() => ({})) as Partial<IAutomaticLotOccupancy> & {
                message?: string;
            };
            if (!response.ok) {
                throw new Error(payload.message ?? "Não foi possível atualizar a ocupação dos lotes.");
            }
            if (payload.configId !== configId || !Array.isArray(payload.lotes)) {
                throw new Error("A ocupação recebida não corresponde à configuração carregada.");
            }

            setLotOccupancy(payload as IAutomaticLotOccupancy);
        } catch (error) {
            setLotOccupancyError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar a ocupação dos lotes.",
            );
        } finally {
            setLotOccupancyLoading(false);
        }
    }, []);

    const loadPaymentConfig = useCallback(async () => {
        setPaymentDataError(null)
        try {
            const response = await fetch("/api/get/pagamentos/configuracaoPagamento", { cache: "no-store" })
            const payload: unknown = await response.json().catch(() => null)
            const config = parseAdminPaymentConfigHttpResponse(response.ok, payload)
            if (!config) {
                const message = typeof payload === "object" && payload !== null &&
                    "message" in payload && typeof payload.message === "string"
                    ? payload.message
                    : response.ok
                        ? "A configuração financeira recebida está em formato inválido."
                        : "Não foi possível carregar a configuração financeira."
                throw new Error(message)
            }

            setPaymentData(config)
            setEditableInfo({
                nome: config.nome,
                edicaoId: config.edicaoId ?? '',
                valorAVista: config.valorAVista,
                valorBoleto: config.valorBoleto,
                valorDebito: config.valorDebito,
                valorPix: config.valorPix,
            })
            if (config.modo === "automatico") {
                void loadLotOccupancy(config._id)
            }
        } catch (error) {
            setPaymentDataError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível carregar a configuração financeira.",
            )
        }
    }, [loadLotOccupancy])

    const loadPayedUsers = useCallback(async () => {
        setPayedUsersLoading(true)
        setPayedUsersError(null)
        try {
            const response = await fetch("/api/get/pagamentos/listaInscritos/", { cache: "no-store" })
            const payload: unknown = await response.json().catch(() => null)
            const users = parseAdminUserListHttpResponse(response.ok, payload)
            if (!users) {
                const message = typeof payload === "object" && payload !== null &&
                    "message" in payload && typeof payload.message === "string"
                    ? payload.message
                    : response.ok
                        ? "A lista de pagantes recebida está em formato inválido."
                        : "Não foi possível carregar a lista de pagantes."
                throw new Error(message)
            }
            setPayedUsers(users)
        } catch (error) {
            setPayedUsersError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível carregar a lista de pagantes.",
            )
        } finally {
            setPayedUsersLoading(false)
        }
    }, [])

    const reloadPageData = useCallback(async () => {
        setLoading(true)
        await Promise.all([loadPaymentConfig(), loadPayedUsers()])
        setLoading(false)
    }, [loadPaymentConfig, loadPayedUsers])

    const handleStartLotEdit = (lot: ILoteAutomatico) => {
        setEditingLotCode(lot.codigo);
        setEditableLot(structuredClone(lot));
    };

    const handleCancelLotEdit = () => {
        setEditingLotCode(null);
        setEditableLot(null);
    };

    const handleLotFieldChange = (field: "nome" | "limiteVagas", value: string) => {
        setEditableLot((current) => current ? ({
            ...current,
            [field]: field === "nome" ? value : Number(value),
        }) : current);
    };

    const handleLotPriceChange = (
        field: "valorAVista" | "valorBoleto" | "valorDebito" | "valorPix",
        value: string,
    ) => {
        setEditableLot((current) => current ? ({
            ...current,
            precos: { ...current.precos, [field]: Number(value) },
        }) : current);
    };

    const handleLotInstallmentChange = (
        index: number,
        field: "totalParcelas" | "valorCadaParcela",
        value: string,
    ) => {
        setEditableLot((current) => {
            if (!current) return current;
            const parcelamentos = [...current.precos.parcelamentos];
            parcelamentos[index] = { ...parcelamentos[index], [field]: Number(value) };
            return { ...current, precos: { ...current.precos, parcelamentos } };
        });
    };

    const handleAddLotInstallment = () => {
        setEditableLot((current) => {
            if (!current) return current;
            const nextCode = current.precos.parcelamentos.reduce(
                (maximum, installment) => Math.max(maximum, installment.codigo),
                -1,
            ) + 1;
            return {
                ...current,
                precos: {
                    ...current.precos,
                    parcelamentos: [
                        ...current.precos.parcelamentos,
                        { codigo: nextCode, totalParcelas: 2, valorCadaParcela: 0 },
                    ],
                },
            };
        });
    };

    const handleDeleteLotInstallment = (codigo: number) => {
        setEditableLot((current) => current ? ({
            ...current,
            precos: {
                ...current.precos,
                parcelamentos: current.precos.parcelamentos.filter(
                    (installment) => installment.codigo !== codigo,
                ),
            },
        }) : current);
    };

    const handleSaveAutomaticLot = async () => {
        if (!paymentData || !editableLot || editingLotCode === null) return;

        try {
            setLoading(true);
            const response = await fetch("/api/put/pagamentos/configuracaoLoteAutomatico", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    configId: paymentData._id,
                    loteCodigo: editingLotCode,
                    lote: {
                        nome: editableLot.nome,
                        limiteVagas: editableLot.limiteVagas,
                        precos: editableLot.precos,
                    },
                }),
            });
            const result: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                const message = typeof result === "object" && result !== null &&
                    "message" in result && typeof result.message === "string"
                    ? result.message
                    : "Falha ao salvar o lote."
                throw new Error(message);
            }

            await loadPaymentConfig();
            handleCancelLotEdit();
            await loadLotOccupancy(paymentData._id);
            alert("Lote automático atualizado com sucesso!");
        } catch (error) {
            alert(error instanceof Error ? error.message : "Não foi possível salvar o lote.");
        } finally {
            setLoading(false);
        }
    };

    const handleActivateEditParcelamentos = () => {
        if (paymentData) {
            setEditableParcelamentos(JSON.parse(JSON.stringify(paymentData.parcelamentos)));
        }
        setIsEditingParcelamentos(true);
    };

    const handleCancelParcelamentosEdit = () => {
        setIsEditingParcelamentos(false);
        if (paymentData) {
            setEditableParcelamentos(paymentData.parcelamentos);
        }
    };

    const handleResetFilters = () => {
        setSearchTerm("")
        setSelectedStatus("")
        setSelectedPaymentType("")
        setStartDate("")
        setEndDate("")
    }

    const handleParcelamentoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const updatedParcelamentos = [...editableParcelamentos];
        updatedParcelamentos[index] = {
            ...updatedParcelamentos[index],
            [name]: parseFloat(value) || 0,
        };
        setEditableParcelamentos(updatedParcelamentos);
    };

    const handleDeleteParcelamento = (codigoToDelete: number) => {
        const updatedParcelamentos = editableParcelamentos.filter(p => p.codigo !== codigoToDelete);
        setEditableParcelamentos(updatedParcelamentos);
    };

    const filteredUsers = useMemo(() => filterAdminUsers(payedUsers, {
        searchTerm,
        selectedStatus,
        selectedPaymentType,
        startDate,
        endDate,
    }), [payedUsers, searchTerm, selectedStatus, selectedPaymentType, startDate, endDate])

    const handleSaveParcelamentos = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/put/pagamentos/configuracaoParcelamentos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _id: paymentData?._id, parcelamentos: editableParcelamentos }),
            });
            if (!response.ok) throw new Error('Falha ao salvar parcelamentos');

            if (paymentData) {
                setPaymentData({ ...paymentData, parcelamentos: editableParcelamentos });
            }
            alert("Alteração feita com sucesso!")
            setIsEditingParcelamentos(false);

        } catch (error) {
            alert("Não foi possível salvar as alterações. Tente novamente.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const router = useRouter()

    useEffect(() => {
        void reloadPageData()
    }, [reloadPageData])

    const handleInfoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numericFields = ["valorAVista", "valorBoleto", "valorDebito", "valorPix"];
        setEditableInfo(prev => ({
            ...prev,
            [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value
        }));
    };

    const handleSaveChanges = async () => {
        const editionChanged = Boolean(
            editableInfo.edicaoId && editableInfo.edicaoId !== paymentData?.edicaoId
        )
        if (
            editionChanged &&
            !window.confirm("Iniciar uma nova edição zera o contador de pagantes legados. Deseja continuar?")
        ) {
            return
        }

        try {
            setLoading(true)
            const response = await fetch('/api/put/pagamentos/configuracaoGeralPagamento', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editableInfo, _id: paymentData?._id }),
            });

            if (!response.ok) {
                alert('Ocorreu algum erro ao salvar os dados. Recarregue a página e tente novamente.')
                setLoading(false)
                return;
            };

            await loadPaymentConfig();
            if (paymentData?.modo === "automatico" && paymentData._id) {
                void loadLotOccupancy(paymentData._id);
            }
            setLoading(false)

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Não foi possível salvar as alterações. Tente novamente.");
        }

        setIsEditingInfo(false);
    };

    const handleCancelEdit = () => {
        if (paymentData) {
            setEditableInfo({
                nome: paymentData.nome,
                edicaoId: paymentData.edicaoId ?? '',
                valorAVista: paymentData.valorAVista,
                valorBoleto: paymentData.valorBoleto,
                valorDebito: paymentData.valorDebito,
                valorPix: paymentData.valorPix
            });
        }
        setIsEditingInfo(false);
    };

    const handleAddParcelamento = () => {
        const maxCodigo = editableParcelamentos.reduce((max, p) => p.codigo > max ? p.codigo : max, 0);
        const newParcelamento: IParcelamento = {
            codigo: maxCodigo + 1,
            totalParcelas: 2,
            valorCadaParcela: 0,
        };
        setEditableParcelamentos([...editableParcelamentos, newParcelamento]);
    };

    const updateAllowedPayments = async () => {
        setLoading(true)
        const response = await fetch("/api/put/pagamentos/configuracaoTiposDePagamentosAceitos/", {
            method: "PUT",
            body: JSON.stringify({
                _id: paymentData?._id,
                parcelamentos: paymentData?.pagamentosAceitos
            })
        })
        if (!response.ok) {
            const error: { message: string } = await response.json()
            setLoading(false)
            alert(error.message)
            return
        }

        await Promise.all([loadPaymentConfig(), loadPayedUsers()])
        setLoading(false)
        alert("Pagamentos aceitos alterados com sucesso!")
    }

    const paymentTypes = useMemo(() => {
        if (!payedUsers.length) return []
        const types = new Set(
            payedUsers
                .map(user => user.pagamento.tipo_pagamento)
                .filter((type): type is string => Boolean(type)),
        )
        return Array.from(types)
    }, [payedUsers])

    if (loading) {
        return (
            <div className="financeiro-loading-container" role="status" aria-live="polite">
                <div className="financeiro-spinner"></div>
                <span className="financeiro-loading-text">Carregando configurações financeiras...</span>
            </div>
        );
    }

    if (!paymentData) {
        return (
            <div className="admin-state admin-state--error" role="alert">
                <span className="admin-state__mark">!</span>
                <h1>Não foi possível carregar o financeiro</h1>
                <p>{paymentDataError ?? "Atualize a página ou tente novamente em alguns instantes."}</p>
                <button type="button" className="financeiro-btn financeiro-btn-primary" onClick={() => void reloadPageData()}>
                    Tentar novamente
                </button>
            </div>
        );
    }

    const automaticLots = paymentData.configuracaoLotesAutomaticos?.lotes;
    const automaticStructureValid = hasValidAutomaticStructure(automaticLots);

    return (
        <>
            <LoadingModal isLoading={loading} />

            <div className="financeiro-main-container">
                <span className="main-eyebrow">CIEPS / Financeiro</span>
                <h1 className="financeiro-title">Configurações financeiras</h1>
                <p className="main-subtitle">
                    Gerencie valores, formas de pagamento, parcelamentos e inscrições.
                </p>

                <div className="financeiro-config-summary" aria-label="Configuração financeira carregada">
                    <div>
                        <span className="financeiro-config-summary-label">Documento</span>
                        <strong>{paymentData._id}</strong>
                    </div>
                    <div>
                        <span className="financeiro-config-summary-label">Edição</span>
                        <strong>{paymentData.edicaoId ?? "Não configurada"}</strong>
                    </div>
                    <div>
                        <span className="financeiro-config-summary-label">Modo</span>
                        <strong className={`financeiro-mode-badge financeiro-mode-badge--${paymentData.modo ?? "legado"}`}>
                            {paymentData.modo === "automatico"
                                ? "Automático"
                                : paymentData.modo === "manual" ? "Manual" : "Legado"}
                        </strong>
                    </div>
                </div>

                {/* Estatísticas */}
                <div className="financeiro-estatisticas">
                    <div className="financeiro-estatistica-card">
                        <Users size={32} style={{ marginBottom: '0.3rem', color: 'var(--azul)' }} />
                        <span className="financeiro-estatistica-valor">{payedUsers.length}</span>
                        <span className="financeiro-estatistica-label">Total de Inscritos</span>
                    </div>
                    <div className="financeiro-estatistica-card">
                        <CreditCard size={32} style={{ marginBottom: '0.3rem', color: 'var(--carmin)' }} />
                        <span className="financeiro-estatistica-valor">{paymentData.pagamentosAceitos?.length || 0}</span>
                        <span className="financeiro-estatistica-label">Métodos de Pagamento</span>
                    </div>
                    <div className="financeiro-estatistica-card">
                        <DollarSign size={32} style={{ marginBottom: '0.3rem', color: '#4CAF50' }} />
                        <span className="financeiro-estatistica-valor">
                            {paymentData.modo === "automatico"
                                ? (automaticLots?.length ?? 0)
                                : (paymentData.parcelamentos?.length ?? 0)}
                        </span>
                        <span className="financeiro-estatistica-label">
                            {paymentData.modo === "automatico" ? "Lotes automáticos" : "Parcelamentos"}
                        </span>
                    </div>
                </div>

                <div className="financeiro-section financeiro-codes-entry">
                    <div>
                        <h2 className="financeiro-section-title">
                            <Tag size={24} />
                            Códigos de desconto e rastreio
                        </h2>
                        <p>
                            Gere descontos de uso único, associe rastreios a divulgadores e acompanhe as vendas confirmadas por código.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="financeiro-btn financeiro-btn-primary"
                        onClick={() => router.push("/financeiro/codigos")}
                    >
                        <Tag size={18} />
                        Gerenciar códigos
                    </button>
                </div>

                {paymentData.modo === "automatico" && (
                    <div className="financeiro-section financeiro-automatic-section">
                        <div className="financeiro-section-heading-row">
                            <div>
                                <h2 className="financeiro-section-title">
                                    <DollarSign size={24} />
                                    Lotes usados pelo checkout
                                </h2>
                                <p className="financeiro-section-description">
                                    Cada lote tem preços próprios. Salvar um card altera somente aquele lote.
                                </p>
                            </div>
                            <div className="financeiro-lot-section-actions">
                                <span className="financeiro-mode-badge financeiro-mode-badge--automatico">
                                    Configuração automática
                                </span>
                                <button
                                    type="button"
                                    className="financeiro-btn financeiro-btn-primary financeiro-lot-refresh-button"
                                    onClick={() => void loadLotOccupancy(paymentData._id)}
                                    disabled={lotOccupancyLoading}
                                >
                                    <RefreshCw
                                        size={17}
                                        className={lotOccupancyLoading ? "financeiro-refresh-icon--spinning" : undefined}
                                    />
                                    {lotOccupancyLoading ? "Atualizando" : "Atualizar números"}
                                </button>
                            </div>
                        </div>

                        <div className="financeiro-warning">
                            <AlertTriangle size={20} />
                            <span>
                                Sessões de pagamento já criadas mantêm o lote e os valores originais. As alterações abaixo valem apenas para novas sessões.
                            </span>
                        </div>

                        {lotOccupancy && (
                            <div className="financeiro-lot-occupancy-summary" role="status" aria-live="polite">
                                <div>
                                    <strong>{formatCount(lotOccupancy.confirmadas.total)}</strong>
                                    <span>Vendas confirmadas</span>
                                </div>
                                <div>
                                    <strong>{formatCount(lotOccupancy.reservasAtivas)}</strong>
                                    <span>Em pagamento / reservadas</span>
                                </div>
                                <div>
                                    <strong>{formatCount(lotOccupancy.ocupadasEfetivas)}</strong>
                                    <span>Vagas ocupadas no checkout</span>
                                </div>
                                <small>
                                    Atualizado às {formatOccupancyTime(lotOccupancy.calculadoEm) ?? "—"}
                                </small>
                            </div>
                        )}

                        {lotOccupancyLoading && !lotOccupancy && (
                            <div className="financeiro-lot-occupancy-state" role="status">
                                <RefreshCw size={18} className="financeiro-refresh-icon--spinning" />
                                Calculando vendas e vagas disponíveis…
                            </div>
                        )}

                        {lotOccupancyError && (
                            <div className="financeiro-lot-occupancy-state financeiro-lot-occupancy-state--error" role="alert">
                                <AlertTriangle size={18} />
                                <span>
                                    {lotOccupancyError}
                                    {lotOccupancy ? " Os últimos números calculados permanecem visíveis." : ""}
                                </span>
                            </div>
                        )}

                        {lotOccupancy && lotOccupancy.excedente > 0 && (
                            <div className="financeiro-lot-occupancy-state financeiro-lot-occupancy-state--warning" role="alert">
                                <AlertTriangle size={18} />
                                A ocupação excede a capacidade configurada em {formatCount(lotOccupancy.excedente)} vagas.
                            </div>
                        )}

                        {!automaticStructureValid ? (
                            <div className="admin-state admin-state--error" role="alert">
                                <span className="admin-state__mark">!</span>
                                <h3>Estrutura automática inválida</h3>
                                <p>
                                    Nenhum lote será criado ou preenchido a partir dos valores legados. Corrija a estrutura da configuração antes de editar preços.
                                </p>
                            </div>
                        ) : (
                            <div className="financeiro-lots-grid">
                                {automaticLots!.map((lot) => {
                                    const isEditing = editingLotCode === lot.codigo && editableLot;
                                    const lotAvailability = lotOccupancy?.lotes.find(
                                        (item) => item.codigo === lot.codigo && item.limiteVagas === lot.limiteVagas,
                                    );
                                    return (
                                        <article key={lot.codigo} className="financeiro-lot-card">
                                            <div className="financeiro-lot-header">
                                                <div>
                                                    <span className="financeiro-lot-code">Lote #{lot.codigo}</span>
                                                    <h3>{lot.nome}</h3>
                                                </div>
                                                {!isEditing && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartLotEdit(lot)}
                                                        className="financeiro-btn financeiro-btn-primary"
                                                        disabled={editingLotCode !== null}
                                                    >
                                                        <Edit3 size={18} />
                                                        Editar lote
                                                    </button>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <div className="financeiro-lot-edit-form">
                                                    <div className="financeiro-form-row">
                                                        <div className="financeiro-form-group">
                                                            <label className="financeiro-label" htmlFor={`lot-name-${lot.codigo}`}>Nome</label>
                                                            <input
                                                                id={`lot-name-${lot.codigo}`}
                                                                className="financeiro-input"
                                                                value={editableLot.nome}
                                                                onChange={(event) => handleLotFieldChange("nome", event.target.value)}
                                                            />
                                                        </div>
                                                        <div className="financeiro-form-group">
                                                            <label className="financeiro-label" htmlFor={`lot-limit-${lot.codigo}`}>Limite de vagas</label>
                                                            <input
                                                                id={`lot-limit-${lot.codigo}`}
                                                                type="number"
                                                                min="1"
                                                                step="1"
                                                                className="financeiro-input"
                                                                value={editableLot.limiteVagas}
                                                                onChange={(event) => handleLotFieldChange("limiteVagas", event.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="financeiro-lot-prices-grid">
                                                        {([
                                                            ["valorPix", "PIX"],
                                                            ["valorBoleto", "Boleto"],
                                                            ["valorDebito", "Débito"],
                                                            ["valorAVista", "Crédito à vista"],
                                                        ] as const).map(([field, label]) => (
                                                            <div className="financeiro-form-group" key={field}>
                                                                <label className="financeiro-label" htmlFor={`${field}-${lot.codigo}`}>{label} (R$)</label>
                                                                <input
                                                                    id={`${field}-${lot.codigo}`}
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    className="financeiro-input"
                                                                    value={editableLot.precos[field]}
                                                                    onChange={(event) => handleLotPriceChange(field, event.target.value)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="financeiro-lot-installments">
                                                        <div className="financeiro-lot-subheading">
                                                            <h4>Parcelamentos do lote</h4>
                                                            <button
                                                                type="button"
                                                                onClick={handleAddLotInstallment}
                                                                className="financeiro-btn financeiro-btn-secondary"
                                                            >
                                                                <Plus size={17} />
                                                                Adicionar opção
                                                            </button>
                                                        </div>
                                                        {editableLot.precos.parcelamentos.length === 0 ? (
                                                            <p className="financeiro-info-note">Nenhuma opção de parcelamento cadastrada.</p>
                                                        ) : (
                                                            <div className="financeiro-lot-installment-list">
                                                                {editableLot.precos.parcelamentos.map((installment, index) => (
                                                                    <div className="financeiro-lot-installment-row" key={installment.codigo}>
                                                                        <span className="financeiro-lot-code">Código {installment.codigo}</span>
                                                                        <label>
                                                                            Parcelas
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                step="1"
                                                                                className="financeiro-input"
                                                                                value={installment.totalParcelas}
                                                                                onChange={(event) => handleLotInstallmentChange(index, "totalParcelas", event.target.value)}
                                                                            />
                                                                        </label>
                                                                        <label>
                                                                            Valor por parcela (R$)
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                className="financeiro-input"
                                                                                value={installment.valorCadaParcela}
                                                                                onChange={(event) => handleLotInstallmentChange(index, "valorCadaParcela", event.target.value)}
                                                                            />
                                                                        </label>
                                                                        <button
                                                                            type="button"
                                                                            className="financeiro-delete-btn financeiro-delete-btn--inline"
                                                                            onClick={() => handleDeleteLotInstallment(installment.codigo)}
                                                                            aria-label={`Remover parcelamento ${installment.codigo}`}
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="financeiro-form-actions">
                                                        <button type="button" onClick={handleSaveAutomaticLot} className="financeiro-btn financeiro-btn-success">
                                                            <Save size={18} />
                                                            Salvar este lote
                                                        </button>
                                                        <button type="button" onClick={handleCancelLotEdit} className="financeiro-btn financeiro-btn-secondary">
                                                            <X size={18} />
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="financeiro-lot-details-grid">
                                                        <div>
                                                            <span>Limite</span>
                                                            <strong>{formatCount(lot.limiteVagas)} vagas</strong>
                                                            <small className={lotAvailability ? "financeiro-lot-remaining" : "financeiro-lot-remaining financeiro-lot-remaining--unavailable"}>
                                                                {lotAvailability
                                                                    ? formatRemainingPlaces(lotAvailability.restantes)
                                                                    : lotOccupancyLoading ? "Calculando disponibilidade…" : "Disponibilidade indisponível"}
                                                            </small>
                                                        </div>
                                                        <div><span>PIX</span><strong>{formatCurrency(lot.precos.valorPix)}</strong></div>
                                                        <div><span>Boleto</span><strong>{formatCurrency(lot.precos.valorBoleto)}</strong></div>
                                                        <div><span>Débito</span><strong>{formatCurrency(lot.precos.valorDebito)}</strong></div>
                                                        <div><span>Crédito à vista</span><strong>{formatCurrency(lot.precos.valorAVista)}</strong></div>
                                                    </div>
                                                    <div className="financeiro-lot-installment-summary">
                                                        <h4>Parcelamentos</h4>
                                                        {lot.precos.parcelamentos.length === 0 ? (
                                                            <span>Nenhuma opção cadastrada</span>
                                                        ) : lot.precos.parcelamentos.map((installment) => (
                                                            <span key={installment.codigo}>
                                                                Código {installment.codigo}: {installment.totalParcelas}x de {formatCurrency(installment.valorCadaParcela)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Pagamentos Aceitos */}
                <div className="financeiro-section">
                    <h2 className="financeiro-section-title">
                        <Settings size={24} />
                        Pagamentos Aceitos
                    </h2>
                    <div className="financeiro-payment-types">
                        {allPaymentTypes.map((value) => {
                            const isSelected = paymentData.pagamentosAceitos?.includes(value);
                            return (
                                <button
                                    key={value}
                                    className={`financeiro-payment-type-btn ${isSelected ? 'active' : ''}`}
                                    onClick={() => {
                                        setPaymentData((prev) => {
                                            if (!prev) return prev;
                                            const atual = prev.pagamentosAceitos ?? [];
                                            const jaSelecionado = atual.includes(value);
                                            return {
                                                ...prev,
                                                pagamentosAceitos: jaSelecionado
                                                    ? atual.filter((item) => item !== value)
                                                    : [...atual, value],
                                            };
                                        });
                                    }}
                                >
                                    {value === "CREDIT_CARD" ? "Cartão de Crédito" :
                                        value === "DEBIT_CARD" ? "Cartão de Débito" : value}
                                </button>
                            )
                        })}
                    </div>
                    <button onClick={updateAllowedPayments} className="financeiro-btn financeiro-btn-primary">
                        <Save size={18} />
                        Salvar Alterações
                    </button>
                </div>

                {/* Informações Gerais */}
                <div className="financeiro-section">
                    <h2 className="financeiro-section-title">
                        <DollarSign size={24} />
                        Compatibilidade legada / modo manual
                    </h2>

                    {paymentData.modo === "automatico" && (
                        <div className="financeiro-legacy-warning" role="note">
                            <Info size={20} />
                            <span>
                                Os valores e o nome abaixo permanecem por compatibilidade, mas não são os preços usados pelo checkout enquanto o modo for automático. Edite os cards de lotes acima para alterar novas compras.
                            </span>
                        </div>
                    )}

                    {isEditingInfo ? (
                        <div className="financeiro-form">
                            <div className="financeiro-form-group">
                                <label htmlFor="nome" className="financeiro-label">
                                    Nome do Lote
                                    <span className="financeiro-info-text">
                                        Este nome aparecerá na fatura do cartão
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    id="nome"
                                    name="nome"
                                    value={editableInfo.nome}
                                    onChange={handleInfoInputChange}
                                    className="financeiro-input"
                                />
                            </div>
                            <div className="financeiro-form-group">
                                <label htmlFor="edicaoId" className="financeiro-label">
                                    Identificador da edição ativa
                                    <span className="financeiro-info-text">
                                        Exemplo: COEPS-2026. Alterar este campo inicia uma nova edição e zera os pagantes legados.
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    id="edicaoId"
                                    name="edicaoId"
                                    value={editableInfo.edicaoId}
                                    onChange={handleInfoInputChange}
                                    className="financeiro-input"
                                    maxLength={64}
                                    required
                                />
                            </div>
                            <div className="financeiro-form-row">
                                <div className="financeiro-form-group">
                                    <label htmlFor="valorAVista" className="financeiro-label">Crédito à Vista (R$)</label>
                                    <input
                                        type="number"
                                        id="valorAVista"
                                        name="valorAVista"
                                        value={editableInfo.valorAVista}
                                        onChange={handleInfoInputChange}
                                        className="financeiro-input"
                                    />
                                </div>
                                <div className="financeiro-form-group">
                                    <label htmlFor="valorDebito" className="financeiro-label">Débito (R$)</label>
                                    <input
                                        type="number"
                                        id="valorDebito"
                                        name="valorDebito"
                                        value={editableInfo.valorDebito}
                                        onChange={handleInfoInputChange}
                                        className="financeiro-input"
                                    />
                                </div>
                            </div>
                            <div className="financeiro-form-row">
                                <div className="financeiro-form-group">
                                    <label htmlFor="valorBoleto" className="financeiro-label">Boleto (R$)</label>
                                    <input
                                        type="number"
                                        id="valorBoleto"
                                        name="valorBoleto"
                                        value={editableInfo.valorBoleto}
                                        onChange={handleInfoInputChange}
                                        className="financeiro-input"
                                    />
                                </div>
                                <div className="financeiro-form-group">
                                    <label htmlFor="valorPix" className="financeiro-label">PIX (R$)</label>
                                    <input
                                        type="number"
                                        id="valorPix"
                                        name="valorPix"
                                        value={editableInfo.valorPix}
                                        onChange={handleInfoInputChange}
                                        className="financeiro-input"
                                    />
                                </div>
                            </div>
                            <div className="financeiro-form-actions">
                                <button onClick={handleSaveChanges} className="financeiro-btn financeiro-btn-success">
                                    <Save size={18} />
                                    Salvar
                                </button>
                                <button onClick={handleCancelEdit} className="financeiro-btn financeiro-btn-secondary">
                                    <X size={18} />
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="financeiro-info-display">
                            <div className="financeiro-info-item">
                                <span className="financeiro-info-label">Nome do Lote:</span>
                                <span className="financeiro-info-value">{paymentData.nome}</span>
                                <span className="financeiro-info-note">Aparecerá na fatura do cartão</span>
                            </div>
                            <div className="financeiro-info-item">
                                <span className="financeiro-info-label">Edição ativa:</span>
                                <span className="financeiro-info-value">{paymentData.edicaoId ?? "Não configurada"}</span>
                                <span className="financeiro-info-note">
                                    Pagantes legados: {paymentData.pagantesLegados ?? 0}
                                </span>
                            </div>
                            <div className="financeiro-info-grid">
                                <div className="financeiro-info-item">
                                    <span className="financeiro-info-label">Crédito à Vista:</span>
                                    <span className="financeiro-info-value">R$ {paymentData?.valorAVista}</span>
                                </div>
                                <div className="financeiro-info-item">
                                    <span className="financeiro-info-label">Débito:</span>
                                    <span className="financeiro-info-value">R$ {paymentData?.valorDebito}</span>
                                </div>
                                <div className="financeiro-info-item">
                                    <span className="financeiro-info-label">Boleto:</span>
                                    <span className="financeiro-info-value">R$ {paymentData?.valorBoleto}</span>
                                </div>
                                <div className="financeiro-info-item">
                                    <span className="financeiro-info-label">PIX:</span>
                                    <span className="financeiro-info-value">R$ {paymentData?.valorPix}</span>
                                </div>
                            </div>
                            <button onClick={() => setIsEditingInfo(true)} className="financeiro-btn financeiro-btn-primary">
                                <Edit3 size={18} />
                                Editar campos legados
                            </button>
                        </div>
                    )}
                </div>

                {/* Parcelamentos */}
                <div className="financeiro-section">
                    <div className="financeiro-warning">
                        <AlertTriangle size={20} />
                        <span>Pagamentos já criados preservam o snapshot dos valores originais e não são alterados por esta tela.</span>
                    </div>

                    <h2 className="financeiro-section-title">
                        <CreditCard size={24} />
                        Parcelamentos legados
                    </h2>

                    {!isEditingParcelamentos ? (
                        <div className="financeiro-parcelamentos-grid">
                            {(paymentData.parcelamentos ?? []).map((payment) => (
                                <div key={payment.codigo} className="financeiro-parcelamento-card">
                                    <div className="financeiro-parcelamento-header">
                                        <span className="financeiro-parcelamento-codigo">Código: {payment.codigo}</span>
                                    </div>
                                    <div className="financeiro-parcelamento-content">
                                        <div className="financeiro-parcelamento-item">
                                            <span className="financeiro-parcelamento-label">Parcelas:</span>
                                            <span className="financeiro-parcelamento-value">{payment.totalParcelas}x</span>
                                        </div>
                                        <div className="financeiro-parcelamento-item">
                                            <span className="financeiro-parcelamento-label">Valor por Parcela:</span>
                                            <span className="financeiro-parcelamento-value">R$ {payment.valorCadaParcela.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                        <div className="financeiro-parcelamento-total">
                                            <span className="financeiro-parcelamento-label">Valor Total:</span>
                                            <span className="financeiro-parcelamento-total-value">R$ {(payment.valorCadaParcela * payment.totalParcelas).toFixed(2).replace('.', ',')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="financeiro-parcelamentos-edit">
                            <div className="financeiro-parcelamentos-grid">
                                {editableParcelamentos.map((payment, index) => (
                                    <div key={payment.codigo} className="financeiro-parcelamento-card financeiro-parcelamento-edit">
                                        <button
                                            onClick={() => handleDeleteParcelamento(payment.codigo)}
                                            className="financeiro-delete-btn"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <div className="financeiro-parcelamento-header">
                                            <span className="financeiro-parcelamento-codigo">Código: {payment.codigo}</span>
                                        </div>
                                        <div className="financeiro-parcelamento-form">
                                            <div className="financeiro-form-group">
                                                <label className="financeiro-label">Total de Parcelas</label>
                                                <input
                                                    type="number"
                                                    name="totalParcelas"
                                                    value={payment.totalParcelas}
                                                    onChange={(e) => handleParcelamentoChange(index, e)}
                                                    className="financeiro-input"
                                                />
                                            </div>
                                            <div className="financeiro-form-group">
                                                <label className="financeiro-label">Valor por Parcela (R$)</label>
                                                <input
                                                    type="number"
                                                    name="valorCadaParcela"
                                                    value={payment.valorCadaParcela}
                                                    onChange={(e) => handleParcelamentoChange(index, e)}
                                                    className="financeiro-input"
                                                />
                                            </div>
                                            <div className="financeiro-parcelamento-total">
                                                <span className="financeiro-parcelamento-label">Novo Valor Total:</span>
                                                <span className="financeiro-parcelamento-total-value">R$ {(payment.valorCadaParcela * payment.totalParcelas).toFixed(2).replace('.', ',')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="financeiro-parcelamentos-actions">
                                <button onClick={handleAddParcelamento} className="financeiro-btn financeiro-btn-secondary">
                                    <Plus size={18} />
                                    Adicionar Parcelamento
                                </button>
                                <div className="financeiro-form-actions">
                                    <button onClick={handleSaveParcelamentos} className="financeiro-btn financeiro-btn-success">
                                        <Save size={18} />
                                        Salvar Alterações
                                    </button>
                                    <button onClick={handleCancelParcelamentosEdit} className="financeiro-btn financeiro-btn-secondary">
                                        <X size={18} />
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isEditingParcelamentos && (
                        <button onClick={handleActivateEditParcelamentos} className="financeiro-btn financeiro-btn-primary">
                            <Edit3 size={18} />
                            Editar Parcelamentos
                        </button>
                    )}
                </div>

                {/* Lista de Pagantes */}
                <div className="financeiro-section">
                    <h2 className="financeiro-section-title">
                        <UserCheck size={24} />
                        Lista de Pagantes
                    </h2>

                    <div className="financeiro-users-info">
                        <div className="financeiro-users-stats">
                            <span className="financeiro-users-count">
                                Total de Inscrições: {payedUsers.length > 0 ? payedUsers.length : "Ainda não há inscrições"}
                            </span>
                            <span className="financeiro-users-note">
                                Valor variável com a quantidade atual de inscrições
                            </span>
                        </div>

                        <div className="financeiro-users-actions">
                            <button
                                className="financeiro-btn financeiro-btn-primary"
                                onClick={() => router.push("/usuarios/")}
                            >
                                <Users size={18} />
                                Gerenciar Usuários
                            </button>
                            <button
                                className="financeiro-btn financeiro-btn-danger"
                                onClick={async () => {
                                    if (confirm("Tem certeza que deseja remover TODAS as inscrições? Esta ação não pode ser desfeita.")) {
                                        setLoading(true)
                                        const data = await fetch(`/api/delete/pagamentos/removerInscricao/ALL`, {
                                            method: "DELETE"
                                        })

                                        if (!data.ok) {
                                            alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                                            setLoading(false)
                                            return;
                                        }

                                        setPayedUsers([])
                                        setLoading(false)
                                        alert("Todas as inscrições foram removidas com sucesso!")
                                    }
                                }}
                            >
                                <UserX size={18} />
                                Remover Todas Inscrições
                            </button>
                        </div>
                    </div>

                    {payedUsersError && (
                        <div className="financeiro-lot-occupancy-state financeiro-lot-occupancy-state--error" role="alert">
                            <AlertTriangle size={18} />
                            <span>
                                {payedUsersError}
                                {payedUsers.length > 0 ? " A última lista válida permanece visível." : ""}
                            </span>
                            <button
                                type="button"
                                className="financeiro-btn financeiro-btn-secondary"
                                onClick={() => void loadPayedUsers()}
                                disabled={payedUsersLoading}
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {payedUsersLoading && (
                        <div className="financeiro-lot-occupancy-state" role="status">
                            <RefreshCw size={18} className="financeiro-refresh-icon--spinning" />
                            Atualizando lista de pagantes…
                        </div>
                    )}

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
                        <div className="usuarios-filtros-actions">
                            <button onClick={handleResetFilters} className="usuarios-btn usuarios-btn-secondary">
                                <FilterX className="h-5 w-5" />
                                Limpar Filtros
                            </button>
                        </div>
                    </div>

                    <div className="w-full text-center">
                        <h2 className="financeiro-section-title">
                            Congressistas - ({filteredUsers.length})
                        </h2>
                    </div>
                    <div className="financeiro-users-grid">
                        {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                            <div key={user._id} className="financeiro-user-card">
                                <div className="financeiro-user-info">
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">Nome:</span>
                                        <span className="financeiro-user-value">{displayUserName(user)}</span>
                                    </div>
                                    {user.cadastroPendente && (
                                        <div className="financeiro-user-item">
                                            <span className="financeiro-user-label">Cadastro:</span>
                                            <span className="financeiro-user-value">Cadastro pendente</span>
                                        </div>
                                    )}
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">Email:</span>
                                        <span className="financeiro-user-value">{displayUserField(user.informacoes_usuario.email)}</span>
                                    </div>
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">Telefone:</span>
                                        <span className="financeiro-user-value">{displayUserField(user.informacoes_usuario.numero_telefone)}</span>
                                    </div>
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">CPF:</span>
                                        <span className="financeiro-user-value">{displayUserField(user.informacoes_usuario.cpf)}</span>
                                    </div>
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">ID Asaas:</span>
                                        <span className="financeiro-user-value">{displayUserField(user.id_api)}</span>
                                    </div>
                                </div>
                                <div className="financeiro-user-actions">
                                    <button
                                        className="financeiro-btn financeiro-btn-success"
                                        onClick={() => router.push(`/usuarios/informacoes/${user._id}`)}
                                    >
                                        <UserCheck size={16} />
                                        Ver Perfil
                                    </button>
                                    <button
                                        className="financeiro-btn financeiro-btn-danger"
                                        onClick={async () => {
                                            if (confirm("Tem certeza que deseja remover esta inscrição?")) {
                                                setLoading(true)
                                                const data = await fetch(`/api/delete/pagamentos/removerInscricao/${user._id}`, {
                                                    method: "DELETE"
                                                })

                                                if (!data.ok) {
                                                    alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                                                    setLoading(false)
                                                    return;
                                                }

                                                setPayedUsers((prev) => prev.filter((value) => `${value._id}` !== `${user._id}`))
                                                setLoading(false)
                                                alert("A inscrição foi removida com sucesso!")
                                            }
                                        }}
                                    >
                                        <UserX size={16} />
                                        Remover Inscrição
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="financeiro-empty-state">
                                <Users size={48} />
                                <p>Nenhum usuário pagante encontrado.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
