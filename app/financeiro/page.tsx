"use client"

import { useEffect, useState, useMemo } from "react"
import LoadingModal from "../components/LoadingModal"
import { IPaymentConfig } from "../lib/types/payments/payment.t"
import { IUser } from "../lib/types/user/user.t"
import { useRouter } from "next/navigation"
import './style.css'
import { Search, FilterX, CreditCard, DollarSign, Users, Settings, Plus, Trash2, Edit3, Save, X, AlertTriangle, Info, UserCheck, UserX } from 'lucide-react'

type IParcelamento = IPaymentConfig["parcelamentos"][0];

export default function Page() {
    const [loading, setLoading] = useState<boolean>(true)
    const [searchTerm, setSearchTerm] = useState<string>("")
    const [selectedStatus, setSelectedStatus] = useState<string>("")
    const [selectedPaymentType, setSelectedPaymentType] = useState<string>("")
    const [startDate, setStartDate] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [paymentData, setPaymentData] = useState<IPaymentConfig | null>(null)
    const [payedUsers, setPayedUsers] = useState<IUser[]>([])
    const [editableParcelamentos, setEditableParcelamentos] = useState<IParcelamento[]>([]);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [isEditingParcelamentos, setIsEditingParcelamentos] = useState(false);
    const [editableInfo, setEditableInfo] = useState({
        nome: '',
        valorAVista: 0,
        valorBoleto: 0,
        valorDebito: 0,
        valorPix: 0
    });
    const allPaymentTypes: IPaymentConfig["pagamentosAceitos"] = ["PIX", "BOLETO", "CREDIT_CARD", "DEBIT_CARD"]

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

    const filteredUsers = payedUsers.filter(user => {
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
        const fetchData = async () => {
            const data = await fetch("/api/get/pagamentos/configuracaoPagamento")
            if (!data.ok) {
                alert("Ocorreu algum erro ao se conectar ao banco de dados. Recarregue a página e tente novamente")
            }
            const fetchedData = await data.json()
            setPaymentData(fetchedData)
            setEditableInfo({
                nome: fetchedData.nome,
                valorAVista: fetchedData.valorAVista,
                valorBoleto: fetchedData.valorBoleto,
                valorDebito: fetchedData.valorDebito,
                valorPix: fetchedData.valorPix
            })
            setLoading(false)
        }

        const fetchDataPayedUsers = async () => {
            const data = await fetch("/api/get/pagamentos/listaInscritos/")
            if (!data.ok) {
                alert("Ocorreu algum erro ao se conectar ao banco de dados. Recarregue a página e tente novamente")
            }
            setPayedUsers(await data.json())
            setLoading(false)
        }

        fetchData()
        fetchDataPayedUsers()
    }, [])

    const handleInfoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditableInfo(prev => ({
            ...prev,
            [name]: name === 'valorAVista' ? parseFloat(value) || 0 : value
        }));
    };

    const handleSaveChanges = async () => {
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

            const updatedData = await response.json();
            setPaymentData(prev => ({ ...prev, ...updatedData }));
            setLoading(false)

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Não foi possível salvar as alterações. Tente novamente.");
        }

        if (paymentData) {
            setPaymentData({ ...paymentData, ...editableInfo });
        }

        setIsEditingInfo(false);
    };

    const handleCancelEdit = () => {
        if (paymentData) {
            setEditableInfo({
                nome: paymentData.nome,
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

        const fetchData = async () => {
            const data = await fetch("/api/get/pagamentos/configuracaoPagamento")
            if (!data.ok) {
                alert("Ocorreu algum erro ao se conectar ao banco de dados. Recarregue a página e tente novamente")
            }
            const fetchedData = await data.json()
            setPaymentData(fetchedData)
            setEditableInfo({
                nome: fetchedData.nome,
                valorAVista: fetchedData.valorAVista,
                valorBoleto: fetchedData.valorBoleto,
                valorDebito: fetchedData.valorDebito,
                valorPix: fetchedData.valorPix
            })
            setLoading(false)
        }

        const fetchDataPayedUsers = async () => {
            const data = await fetch("/api/get/pagamentos/listaInscritos/")
            if (!data.ok) {
                alert("Ocorreu algum erro ao se conectar ao banco de dados. Recarregue a página e tente novamente")
            }
            setPayedUsers(await data.json())
            setLoading(false)
        }

        await fetchData()
        await fetchDataPayedUsers()
        setLoading(false)
        alert("Pagamentos aceitos alterados com sucesso!")
    }

    const paymentTypes = useMemo(() => {
        if (!payedUsers.length) return []
        const types = new Set(payedUsers.map(user => user.pagamento.tipo_pagamento).filter(Boolean))
        return Array.from(types)
    }, [payedUsers])

    if (loading) {
        return (
            <div className="financeiro-loading-container" style={{
                background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
                backgroundAttachment: 'fixed',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat'
            }}>
                <div className="financeiro-spinner"></div>
                <span className="financeiro-loading-text">Carregando configurações financeiras...</span>
            </div>
        );
    }

    if (!paymentData) {
        return <div className="text-red-500">Erro ao carregar dados de pagamento</div>;
    }

    return (
        <>
            <LoadingModal isLoading={loading} />

            <div className="financeiro-main-container" style={{
                background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
                backgroundAttachment: 'fixed',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat'
            }}>
                <h1 className="financeiro-title">CONFIGURAÇÕES FINANCEIRAS</h1>

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
                        <span className="financeiro-estatistica-valor">{paymentData.parcelamentos.length}</span>
                        <span className="financeiro-estatistica-label">Parcelamentos</span>
                    </div>
                </div>

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
                        Informações Gerais de Pagamento
                    </h2>

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
                                Editar Informações
                            </button>
                        </div>
                    )}
                </div>

                {/* Parcelamentos */}
                <div className="financeiro-section">
                    <div className="financeiro-warning">
                        <AlertTriangle size={20} />
                        <span>Pagamentos já criados anteriormente manterão os valores antigos, a menos que sejam cancelados pelo banco.</span>
                    </div>

                    <h2 className="financeiro-section-title">
                        <CreditCard size={24} />
                        Formas de Parcelamento
                    </h2>

                    {!isEditingParcelamentos ? (
                        <div className="financeiro-parcelamentos-grid">
                            {paymentData.parcelamentos.map((payment) => (
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
                        {filteredUsers.length > 0 ? payedUsers.map((user) => (
                            <div key={user._id} className="financeiro-user-card">
                                <div className="financeiro-user-info">
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">Nome:</span>
                                        <span className="financeiro-user-value">{user.informacoes_usuario.nome}</span>
                                    </div>
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">Email:</span>
                                        <span className="financeiro-user-value">{user.informacoes_usuario.email}</span>
                                    </div>
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">Telefone:</span>
                                        <span className="financeiro-user-value">{user.informacoes_usuario.numero_telefone}</span>
                                    </div>
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">CPF:</span>
                                        <span className="financeiro-user-value">{user.informacoes_usuario.cpf}</span>
                                    </div>
                                    <div className="financeiro-user-item">
                                        <span className="financeiro-user-label">ID Asaas:</span>
                                        <span className="financeiro-user-value">{user.id_api}</span>
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