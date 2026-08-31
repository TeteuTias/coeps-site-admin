"use client"
import { IPayment } from "@/app/lib/types/payments/payment.t"
import type { AdminModernPayment, AdminUserPaymentsResponse } from "@/app/lib/types/payments/payment-admin.t"
import {
    type AdminUserDetails,
    parseAdminUserDetailsHttpResponse,
} from "@/app/lib/users/admin-user-contract"
import { ArrowLeft, Save, CheckCircle, AlertCircle, XCircle, Clock, Bookmark, FileText, Tag, Hash, Calendar, MapPin, Users, ListChecks, ArrowRight } from "lucide-react";
import { renderEmojiAsLucide } from "@/app/lib/utils/emojiToLucide";
import { useCallback, useEffect, useState, FormEvent, ChangeEvent } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ICourse } from "@/app/lib/types/events/event.t";
import { ObjectId } from "bson";
import { getPaymentStatusTone } from "@/app/lib/payments/payment-status-appearance";


//
const getPaymentStatusTranslation = (status?: string): string => {
    switch (status) {
        case "PAYMENT_CREATED": return "Gerada";
        case "PAYMENT_AWAITING_RISK_ANALYSIS": return "Análise de Risco";
        case "PAYMENT_APPROVED_BY_RISK_ANALYSIS": return "Análise Aprovada";
        case "PAYMENT_REPROVED_BY_RISK_ANALYSIS": return "Análise Reprovada";
        case "PAYMENT_AUTHORIZED": return "Autorizado";
        case "PAYMENT_UPDATED": return "Atualizada";
        case "PAYMENT_CONFIRMED": return "Confirmado";
        case "PAYMENT_RECEIVED": return "Recebido";
        case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED": return "Falha no Cartão";
        case "PAYMENT_ANTICIPATED": return "Antecipado";
        case "PAYMENT_OVERDUE": return "Vencido";
        case "PAYMENT_DELETED": return "Removida";
        case "PAYMENT_RESTORED": return "Restaurada";
        case "PAYMENT_REFUNDED": return "Estornado";
        case "PAYMENT_PARTIALLY_REFUNDED": return "Estorno Parcial";
        case "PAYMENT_REFUND_IN_PROGRESS": return "Estorno em Progresso";
        case "PAYMENT_REFUND_DENIED": return "Estorno Negado";
        case "PAYMENT_RECEIVED_IN_CASH_UNDONE": return "Recebimento Desfeito";
        case "PAYMENT_CHARGEBACK_REQUESTED": return "Chargeback Solicitado";
        case "PAYMENT_CHARGEBACK_DISPUTE": return "Chargeback em Disputa";
        case "PAYMENT_AWAITING_CHARGEBACK_REVERSAL": return "Aguardando Reversão";
        case "PAYMENT_DUNNING_RECEIVED": return "Negativação Recebida";
        case "PAYMENT_DUNNING_REQUESTED": return "Negativação Solicitada";
        case "PAYMENT_BANK_SLIP_VIEWED": return "Boleto Visualizado";
        case "PAYMENT_CHECKOUT_VIEWED": return "Fatura Visualizada";
        case "PAYMENT_SPLIT_CANCELLED": return "Split Cancelado";
        case "PAYMENT_SPLIT_DIVERGENCE_BLOCK": return "Bloqueio por Split";
        case "PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED": return "Bloqueio Finalizado";
        case "CONFIRMED": return "Confirmado";
        case "RECEIVED": return "Recebido";
        case "PENDING": return "Pendente";
        case "OVERDUE": return "Vencido";
        case "REFUNDED": return "Estornado";
        default: return status || "Não informado";
    }
};
//
const getPaymentStatusIconAndColor = (status?: string) => {
    switch (getPaymentStatusTone(status)) {
        case "success":
            return { Icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-100" };
        case "danger":
            return { Icon: XCircle, color: "text-red-500", bgColor: "bg-red-100" };
        case "warning":
            return { Icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" };
        default:
            return { Icon: AlertCircle, color: "text-gray-500", bgColor: "bg-gray-100" };
    }
};
//


export default function Page() {
    const { userId } = useParams<{ userId: string }>()
    const [user, setUser] = useState<AdminUserDetails | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        id_api: '',
        nome: '',
        email: '',
        numero_telefone: '',
        situacao: "" as number | "",
        situacao_animacao: false,
        isPos_registration: false,
        tipo_pagamento: '' // Campo adicionado ao estado
    });
    const [dataCourses, setCourses] = useState<ICourse[]>([])
    const [modernPayments, setModernPayments] = useState<AdminModernPayment[]>([])
    const [modernPaymentIssues, setModernPaymentIssues] = useState({ reviewRequired: 0, failed: 0 })
    const [canViewModernPayments, setCanViewModernPayments] = useState(false)
    const [modernPaymentsError, setModernPaymentsError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter()

    const fetchData = useCallback(async () => {
        setLoadError(null)
        try {
            const responseCourses = await fetch(`/api/get/minicursosDeUsuario/${userId}`)
            if (!responseCourses.ok) throw new Error("Erro ao carregar informações de minicursos")
            const courses: unknown = await responseCourses.json().catch(() => null)
            if (
                typeof courses !== "object" || courses === null ||
                !("data" in courses) || !Array.isArray(courses.data)
            ) {
                throw new Error("As informações de minicursos estão em formato inválido.")
            }
            setCourses(courses.data as ICourse[])
            const response = await fetch(`/api/get/usuarioPorId/${userId}`)
            const userPayload: unknown = await response.json().catch(() => null)
            const userData = parseAdminUserDetailsHttpResponse(response.ok, userPayload)
            if (!userData) {
                const message = typeof userPayload === "object" && userPayload !== null &&
                    "message" in userPayload && typeof userPayload.message === "string"
                    ? userPayload.message
                    : response.ok
                        ? "Os dados do usuário estão em formato inválido."
                        : "Usuário não encontrado."
                throw new Error(message)
            }
            setUser(userData)
            // Popula o estado do formulário com todos os dados, incluindo o novo campo
            setFormData({
                id_api: userData.id_api || "",
                nome: userData.informacoes_usuario.nome || '',
                email: userData.informacoes_usuario.email || '',
                numero_telefone: userData.informacoes_usuario.numero_telefone || '',
                situacao: userData.pagamento.situacao ?? "",
                situacao_animacao: userData.pagamento.situacao_animacao,
                tipo_pagamento: userData.pagamento.tipo_pagamento || '',
                isPos_registration: userData.isPos_registration,
            });

            try {
                setModernPaymentsError(null)
                const modernResponse = await fetch(`/api/get/pagamentos/usuario/${userId}`)
                if (modernResponse.ok) {
                    const modernData = await modernResponse.json() as Partial<AdminUserPaymentsResponse>
                    if (
                        !Array.isArray(modernData.payments) ||
                        typeof modernData.issueCounts !== "object" || modernData.issueCounts === null ||
                        typeof modernData.issueCounts.reviewRequired !== "number" ||
                        typeof modernData.issueCounts.failed !== "number"
                    ) {
                        throw new Error("Resposta de pagamentos modernos inválida.")
                    }
                    setModernPayments(modernData.payments)
                    setModernPaymentIssues(modernData.issueCounts)
                    setCanViewModernPayments(true)
                } else if (modernResponse.status === 403) {
                    setModernPayments([])
                    setCanViewModernPayments(false)
                } else {
                    setModernPayments([])
                    setCanViewModernPayments(true)
                    setModernPaymentsError("Não foi possível carregar as compras modernas.")
                }
            } catch {
                setModernPayments([])
                setCanViewModernPayments(true)
                setModernPaymentsError("Não foi possível carregar as compras modernas.")
            }
        } catch (error) {
            console.error("Falha ao buscar usuário:", error)
            setUser(null)
            setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o usuário.")
        } finally {
            setIsLoading(false)
        }
    }, [userId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {

            const { situacao, ...fields } = formData
            const response = await fetch(`/api/put/usuario/atualizarUsuario/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...fields,
                    ...(situacao === "" ? {} : { situacao }),
                    userId,
                })
            });

            if (!response.ok) throw new Error("Falha ao salvar os dados.");
            await fetchData()
            setIsSaving(false)
            alert("Dados salvos com sucesso!");

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Ocorreu um erro ao salvar. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <div className="admin-state" role="status" aria-live="polite">
                <span className="admin-state__spinner" aria-hidden="true" />
                <h1>Carregando congressista</h1>
                <p>Buscando cadastro, inscrições e pagamentos.</p>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="admin-state admin-state--error" role="alert">
                <span className="admin-state__mark">!</span>
                <h1>Não foi possível carregar o usuário</h1>
                <p>{loadError ?? "Volte para a lista de congressistas e selecione outro cadastro."}</p>
                <Link href="/usuarios/" className="admin-state__action">Voltar para congressistas</Link>
            </div>
        )
    }

    const legacyPayments = user.pagamento?.lista_pagamentos ?? []

    //
    //
    return (
        <div className="admin-detail-page space-y-10">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <Link href="/usuarios/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para a lista
                    </Link>
                </div>
                <span className="main-eyebrow">CIEPS / Congressistas</span>
                <h1 className="main-title">Perfil do congressista</h1>
                <p className="main-subtitle">
                    Revise dados cadastrais, pagamento, inscrições e documentos associados.
                </p>
                {user.cadastroPendente && (
                    <div className="financeiro-warning" role="note">
                        <AlertCircle className="h-5 w-5" />
                        <span>Cadastro pendente: alguns dados pessoais ainda não foram informados.</span>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-bold text-gray-900">Dados cadastrais</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    ID: <span className="font-mono text-xs">{user._id}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <h2 className="text-lg font-medium text-gray-800">Informações Pessoais</h2>
                        <div className="cursor-pointer" onClick={() => alert("*O QUE É ESSE CÓDIGO?* - Esse código é o código de identificação do congressista no banco ASSAS. Isso significa que cada congressista cadastrado possui também foi cadastrado no banco como um cliente do DADG. *COMO ALTERAR COM SEGURANÇA?* - Para alterar com segurança você deve pegar esse código diretamente do banco ASAAS. Caso não consiga fazer isso, marque o campo 'Preenchimento de Informações Iniciais' como 'Preencher Novamente'; isso vai fazer com que o usuário preencha todas as informações novamente e assim, o sistema vai gerar um novo ID já sincronizado com o banco.")}>
                            <label htmlFor="id_api" className="block text-sm font-medium text-gray-700">Identificação Assas</label>
                            <span className="text-red-500 font-bold text-[10px]">* CUIDADO AO TROCAR ESSA INFORMAÇÃO *</span>
                            <p className="text-red-500 font-bold text-[10px] cursor-pointer">* COMO ALTERAR COM SEGURANÇA? *</p>
                            <input type="text" name="id_api" id="id_api" value={formData.id_api} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                        </div>
                        <div>
                            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome Completo</label>
                            <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-mail</label>
                            <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                        </div>
                        <div>
                            <label htmlFor="numero_telefone" className="block text-sm font-medium text-gray-700">Telefone</label>
                            <input type="tel" name="numero_telefone" id="numero_telefone" value={formData.numero_telefone} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-6">
                        <h2 className="text-lg font-medium text-gray-800">Status e Configurações</h2>
                        <div>
                            <label htmlFor="situacao" className="block text-sm font-medium text-gray-700">Situação do Pagamento</label>
                            <select id="situacao" name="situacao" value={formData.situacao} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
                                <option value="" disabled>Status não informado</option>
                                <option value="1">Pago</option>
                                <option value="2">Pagamento Pendente</option>
                                <option value="0">Não Pago</option>
                            </select>
                        </div>

                        {/* ## CAMPO CORRIGIDO ## */}
                        <div>
                            <label htmlFor="tipo_pagamento" className="block text-sm font-medium text-gray-700">Tipo de Pagamento</label>
                            <input type="text" name="tipo_pagamento" id="tipo_pagamento" value={formData.tipo_pagamento} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5" />
                        </div>

                        <div>
                            <label htmlFor="situacao_animacao" className="block text-sm font-medium text-gray-700 mb-2">Animação de Boas-Vindas</label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">Exibir Novamente</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="situacao_animacao" name="situacao_animacao" checked={formData.situacao_animacao} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <span className="text-sm text-gray-600">Já exibida</span>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="isPos_registration" className="block text-sm font-medium text-gray-700 mb-2">Preenchimento de Informações Iniciais</label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">Preencher Novamente</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="isPos_registration" name="isPos_registration" checked={formData.isPos_registration} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <span className="text-sm text-gray-600">Já Preenchido</span>
                            </div>
                        </div>

                    </div>

                    <div className="p-6 flex justify-end gap-4 border-t border-gray-200">
                        <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed">
                            <Save className="h-5 w-5" />
                            {isSaving ? "Salvando..." : "Salvar Alterações"}
                        </button>
                    </div>
                </form>
            </div>
            <div className="w-full text-center font-bold text-2xl text-white">
                <h1>MINICURSOS INSCRITOS</h1>
            </div>
            <div className="max-w-2xl mx-auto bg-gray-200 p-1 rounded-lg space-y-5">
                {
                    dataCourses.length === 0 ?
                        <p className="w-full text-center py-2 font-semibold">Não há pagamentos prévios</p> :
                        dataCourses.map((minicurso) => <CourseCard key={minicurso._id} minicurso={{ ...minicurso }} />)
                }
            </div>
            {canViewModernPayments && (
                <section className="w-full max-w-4xl mx-auto space-y-4" aria-labelledby="modern-payments-heading">
                    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 id="modern-payments-heading" className="text-xl font-bold text-gray-900">Compras modernas</h2>
                                <p className="mt-1 text-sm text-gray-600">
                                    Dados conciliados entre atribuição, sessão e eventos operacionais. O payload bruto do webhook não é exibido.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                                    {modernPaymentIssues.reviewRequired} em revisão
                                </span>
                                <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
                                    {modernPaymentIssues.failed} falhas
                                </span>
                            </div>
                        </div>
                    </div>
                    {modernPaymentsError ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">
                            {modernPaymentsError}
                        </p>
                    ) : modernPayments.length === 0 ? (
                        <p className="rounded-lg border border-gray-200 bg-white p-5 text-center text-sm font-semibold text-gray-600">
                            Não há compras na estrutura moderna para este usuário.
                        </p>
                    ) : (
                        modernPayments.map((payment) => (
                            <ModernPaymentCard key={payment.compraId} payment={payment} />
                        ))
                    )}
                </section>
            )}
            <div className="w-full text-center text-white font-bold text-2xl">
                <h1>HISTÓRICO LEGADO DE PAGAMENTOS</h1>
            </div>
            <div className="flex flex-col items-center justify-center content-center max-w-2xl mx-auto bg-gray-200 p-1 rounded-lg space-y-5 px-10">
                {
                    legacyPayments.length === 0 ?
                        <p className="w-full text-center py-2 font-semibold">Não há pagamentos prévios</p> :
                        legacyPayments.map((pagamento) => <UserComponent key={pagamento._id} pagamento={{ ...pagamento }} />)
                }
            </div>
        </div >
    )
}

const CourseCard: React.FC<{ minicurso: ICourse }> = ({ minicurso }) => {
    const router = useRouter()
    const { name, description, maxParticipants, participantsCount, timeline, isOpen, isFree, value, emoji } = minicurso;

    const vagasPercentual = maxParticipants > 0 ? (participantsCount / maxParticipants) * 100 : 0;



    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden w-full">

            {/* Cabeçalho do Card */}
            <div className="p-6">
                <div className="flex justify-between items-end gap-4">
                    <span className="text-5xl leading-none">{emoji ? renderEmojiAsLucide(emoji, { size: 44, className: "text-indigo-600" }) : '🎓'}</span>
                    <div className="text-right">
                        {isOpen ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Inscrições Abertas
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                <XCircle className="h-3.5 w-3.5" />
                                Inscrições Encerradas
                            </span>
                        )}
                        <span className={`w-fit mt-2 block px-3 py-1 text-xs font-medium rounded-full ${isFree ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {isFree ? 'Gratuito' : `R$ ${value.toFixed(2).replace('.', ',')}`}
                        </span>
                    </div>
                </div>

                <h2 className="mt-4 text-2xl font-bold text-gray-800">{name}</h2>
                <p className="mt-2 text-sm text-gray-600 h-20 overflow-hidden text-ellipsis">{description}</p>
            </div>

            {/* Detalhes com Ícones */}
            <div className="p-6 space-y-4 border-t border-gray-100">
                <div className="flex items-center gap-3 text-sm">
                    {
                        minicurso.timeline.map((time) => {
                            const dataInicio = new Date(time.date_init);
                            const dataFim = new Date(time.date_end);
                            const dataFormatada = `${dataInicio.toLocaleDateString('pt-BR')} das ${dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${dataFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                            return (
                                <div className="flex flex-row space-x-1" key={`${time._id}`}>
                                    <Calendar className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                                    <span className="text-gray-700 font-medium">{dataFormatada}</span>
                                </div>
                            )
                        })
                    }
                </div>
                <div className="flex items-center gap-3 text-sm">
                    {
                        timeline.map((line) =>
                            <div className="flex flex-row space-x-1" key={`${line._id}`}>
                                <MapPin className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                                <span className="text-gray-700 font-medium">{line?.local || "---"}</span>
                                <span className="font-extrabold">-</span>
                                <span className="">{new Date(line.date_init).toDateString()}</span>

                            </div>
                        )
                    }
                </div>
                {/* Barra de Progresso de Vagas */}
                <div>
                    <div className="flex items-center justify-between mb-1 text-sm">
                        <div className="flex items-center gap-3">
                            <Users className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                            <span className="text-gray-700 font-medium">Vagas</span>
                        </div>
                        <span className="font-semibold text-indigo-600">{participantsCount} / {maxParticipants}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${vagasPercentual}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Rodapé com Botões */}
            <div className="mt-auto bg-gray-50 p-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <button className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                        onClick={() => router.push(`/presenca/gerarListaMinicursoPresenca/${minicurso._id}`)}
                    >
                        <ListChecks className="h-4 w-4" />
                        Abrir Lista de Presença
                    </button>
                    {/* Substitua a tag 'button' por 'Link' do Next.js se necessário */}
                    <button className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
                        onClick={() => alert("Em Breve")}
                    >
                        <span>Abrir Minicurso</span>
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

function formatPaymentCents(value: number | null) {
    if (value === null) return "Não informado"
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value / 100)
}

function formatAdminDate(value: string | null) {
    if (!value) return "Não informado"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Não informado"
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date)
}

const ModernPaymentCard: React.FC<{ payment: AdminModernPayment }> = ({ payment }) => {
    const hasOperationalRisk = Boolean(
        payment.financialRisk ||
        payment.missingAssignment ||
        payment.missingSession ||
        payment.webhookIssues.length > 0 ||
        payment.reconciliationReason,
    )
    const statusStyle = hasOperationalRisk
        ? "bg-amber-100 text-amber-900"
        : payment.attributionStatus === "CONFIRMADA"
            ? "bg-green-100 text-green-800"
            : payment.attributionStatus === "ESTORNADA"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
    const financialFlags = [
        ["Evento em revisão", payment.financialReviewEvent],
        ["Recebimento em dinheiro", payment.cashReceiptStatus],
        ["Falha de pagamento", payment.paymentFailureStatus],
        ["Restauração", payment.restorationStatus],
        ["Liquidação PIX", payment.pixSettlementStatus],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]))

    return (
        <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle}`}>
                            {payment.attributionStatus ?? "ATRIBUIÇÃO AUSENTE"}
                        </span>
                        {payment.sessionStatus && (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                                Sessão: {payment.sessionStatus}
                            </span>
                        )}
                    </div>
                    <p className="mt-3 text-xs text-gray-500">Compra</p>
                    <code className="break-all text-xs font-semibold text-gray-800">{payment.compraId}</code>
                </div>
                <div className="sm:text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Valor bruto</p>
                    <p className="text-2xl font-bold text-indigo-700">
                        {formatPaymentCents(payment.amountCentavos.final)}
                    </p>
                    <p className="text-sm font-semibold text-green-700">
                        Líquido após refund DONE: {formatPaymentCents(payment.amountCentavos.net)}
                    </p>
                    {payment.amountCentavos.refundDone > 0 && (
                        <p className="text-xs text-orange-700">
                            Refund DONE: {formatPaymentCents(payment.amountCentavos.refundDone)}
                        </p>
                    )}
                    {payment.amountCentavos.desconto !== null && payment.amountCentavos.desconto > 0 && (
                        <p className="text-xs text-gray-500">
                            Desconto: {formatPaymentCents(payment.amountCentavos.desconto)}
                        </p>
                    )}
                </div>
            </div>

            {(payment.missingAssignment || payment.missingSession) && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
                    Integridade incompleta:
                    {payment.missingAssignment ? " atribuição ausente." : ""}
                    {payment.missingSession ? " sessão ausente." : ""}
                    {" "}A compra exige conciliação antes de qualquer ação manual.
                </div>
            )}

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="font-semibold text-gray-500">Edição</dt><dd>{payment.edicaoId ?? "Não informada"}</dd></div>
                <div><dt className="font-semibold text-gray-500">Método</dt><dd>{payment.method ?? "Não informado"}</dd></div>
                <div><dt className="font-semibold text-gray-500">Estado Asaas</dt><dd>{payment.gatewayState ?? "Não informado"}</dd></div>
                <div><dt className="font-semibold text-gray-500">Criada em</dt><dd>{formatAdminDate(payment.createdAt)}</dd></div>
                <div><dt className="font-semibold text-gray-500">Confirmada em</dt><dd>{formatAdminDate(payment.confirmedAt)}</dd></div>
                <div><dt className="font-semibold text-gray-500">Atualizada em</dt><dd>{formatAdminDate(payment.updatedAt)}</dd></div>
            </dl>

            <div className="mt-4 grid gap-2 rounded-md bg-gray-50 p-4 text-xs text-gray-700">
                <p>Payment ID: <code className="break-all font-semibold">{payment.paymentId ?? "—"}</code></p>
                <p>Checkout ID: <code className="break-all font-semibold">{payment.checkoutId ?? "—"}</code></p>
                <p>Invoice: <code className="break-all font-semibold">{payment.invoiceNumber ?? "—"}</code></p>
            </div>

            {payment.installmentPlan && (
                <section className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
                    <h3 className="font-bold text-blue-950">Plano de parcelamento Asaas</h3>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div><dt className="font-semibold text-blue-700">Installment ID</dt><dd className="break-all font-mono text-xs">{payment.installmentPlan.installmentId}</dd></div>
                        <div><dt className="font-semibold text-blue-700">Parcelas</dt><dd>{payment.installmentPlan.count} × {formatPaymentCents(payment.installmentPlan.installmentValueCentavos)}</dd></div>
                        <div><dt className="font-semibold text-blue-700">Total do plano</dt><dd>{formatPaymentCents(payment.installmentPlan.totalValueCentavos)}</dd></div>
                        <div><dt className="font-semibold text-blue-700">Refund DONE acumulado</dt><dd>{formatPaymentCents(payment.installmentPlan.refundTotalDoneCentavos)}</dd></div>
                    </dl>
                    <h4 className="mt-4 text-sm font-bold text-blue-950">Cobranças observadas</h4>
                    {payment.installmentPlan.observedPayments.length === 0 ? (
                        <p className="mt-2 text-xs text-blue-800">Nenhuma cobrança individual observada.</p>
                    ) : (
                        <ul className="mt-2 space-y-2">
                            {payment.installmentPlan.observedPayments.map((observed) => (
                                <li key={observed.paymentId} className="rounded bg-white/80 p-3 text-xs text-gray-800">
                                    <div className="flex flex-wrap justify-between gap-2">
                                        <strong>Parcela {observed.installmentNumber ?? "—"} · {observed.status}</strong>
                                        <span>{formatPaymentCents(observed.valueCentavos)}</span>
                                    </div>
                                    <p className="mt-1 break-all">Payment ID: <code>{observed.paymentId}</code></p>
                                    <p className="mt-1">Invoice: <code>{observed.invoiceNumber ?? "—"}</code></p>
                                    <p className="mt-1">Último evento: <code>{observed.lastEvent}</code></p>
                                    {observed.lastEventId && (
                                        <p className="mt-1 break-all">ID do último evento: <code>{observed.lastEventId}</code></p>
                                    )}
                                    <p className="mt-1 text-gray-500">Observado em {formatAdminDate(observed.observedAt)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    {payment.installmentPlan.refundsByPayment.length > 0 && (
                        <>
                            <h4 className="mt-4 text-sm font-bold text-blue-950">Estornos por cobrança</h4>
                            <ul className="mt-2 space-y-2">
                                {payment.installmentPlan.refundsByPayment.map((refund) => (
                                    <li key={refund.paymentId} className="rounded bg-white/80 p-3 text-xs text-gray-800">
                                        <p className="break-all">Payment ID: <code>{refund.paymentId}</code></p>
                                        <p className="mt-1 font-semibold">
                                            DONE: {formatPaymentCents(refund.refundsSnapshot.totalDoneCentavos)}
                                        </p>
                                        <p className="mt-1 text-gray-500">
                                            {refund.refundsSnapshot.items.length} registro(s) de refund
                                        </p>
                                        <p className="mt-1 text-gray-500">
                                            Snapshot capturado em {formatAdminDate(refund.refundsSnapshot.capturedAt)}
                                        </p>
                                        {refund.refundsSnapshot.items.length > 0 && (
                                            <ul className="mt-2 space-y-2 border-t border-blue-100 pt-2">
                                                {refund.refundsSnapshot.items.map((item, index) => (
                                                    <li key={`${item.dateCreated ?? "refund"}-${index}`}>
                                                        <div className="flex flex-wrap justify-between gap-2">
                                                            <strong>{item.status}</strong>
                                                            <span>{formatPaymentCents(item.valueCentavos)}</span>
                                                        </div>
                                                        <p className="mt-1 text-gray-500">Criado em {item.dateCreated ?? "data não informada"}</p>
                                                        {item.transactionReceiptUrl && (
                                                            <Link
                                                                href={item.transactionReceiptUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-1 inline-flex font-bold text-indigo-700 underline"
                                                            >
                                                                Abrir comprovante do estorno
                                                            </Link>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            )}

            {(payment.refundStatus || payment.refundsSnapshot) && (
                <section className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-4">
                    <h3 className="font-bold text-orange-900">Estorno: {payment.refundStatus ?? "registrado"}</h3>
                    {payment.refundsSnapshot && (
                        <>
                            <p className="mt-1 text-sm text-orange-900">
                                Total concluído: {formatPaymentCents(payment.refundsSnapshot.totalDoneCentavos)}
                            </p>
                            <p className="mt-1 text-xs text-orange-800">
                                Snapshot capturado em {formatAdminDate(payment.refundsSnapshot.capturedAt)}
                            </p>
                            <ul className="mt-3 space-y-2">
                                {payment.refundsSnapshot.items.map((refund, index) => (
                                    <li key={`${refund.dateCreated ?? "refund"}-${index}`} className="rounded bg-white/80 p-3 text-sm text-gray-800">
                                        <div className="flex flex-wrap justify-between gap-2">
                                            <strong>{refund.status}</strong>
                                            <span>{formatPaymentCents(refund.valueCentavos)}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">Criado em {refund.dateCreated ?? "data não informada"}</p>
                                        {refund.transactionReceiptUrl && (
                                            <Link
                                                href={refund.transactionReceiptUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-2 inline-flex text-xs font-bold text-indigo-700 underline"
                                            >
                                                Abrir comprovante do estorno
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            )}

            {(payment.chargebackStatus || payment.chargebackResolution) && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
                    Chargeback: {payment.chargebackStatus ?? "RESOLVIDO"}
                    {payment.chargebackResolution ? ` · Resolução: ${payment.chargebackResolution}` : ""}.
                    {payment.chargebackStatus && " Esta compra permanece destacada como valor em risco até a resolução."}
                </div>
            )}

            {financialFlags.length > 0 && (
                <dl className="mt-4 grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm sm:grid-cols-2">
                    {financialFlags.map(([label, value]) => (
                        <div key={label}>
                            <dt className="font-semibold text-amber-800">{label}</dt>
                            <dd className="break-all font-mono text-xs text-amber-950">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {payment.reconciliationReason && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <strong>Conciliação necessária:</strong> {payment.reconciliationReason}
                </div>
            )}

            {payment.webhookIssues.length > 0 && (
                <section className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
                    <h3 className="font-bold text-amber-950">Eventos que exigem atenção</h3>
                    <p className="mt-1 text-xs text-amber-800">Somente metadados operacionais seguros são exibidos.</p>
                    <ul className="mt-3 space-y-2">
                        {payment.webhookIssues.map((issue) => (
                            <li key={issue.eventId} className="rounded bg-white/80 p-3 text-xs text-gray-800">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <strong>{issue.status} · {issue.eventType}</strong>
                                    <span>{issue.attempts} tentativa(s)</span>
                                </div>
                                <p className="mt-1">Motivo: <code>{issue.reason}</code></p>
                                <p className="mt-1 break-all text-gray-500">Evento: {issue.eventId}</p>
                                {issue.installmentId && (
                                    <p className="mt-1 break-all text-gray-500">Installment: {issue.installmentId}</p>
                                )}
                                <p className="mt-1 text-gray-500">Recebido em {formatAdminDate(issue.receivedAt)}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </article>
    )
}

const UserComponent: React.FC<{ pagamento: IPayment["lista_pagamentos"][0] }> = ({ pagamento }) => {
    const [event, setEvent] = useState<ICourse | null>(null)

    useEffect(() => {
        const dataFetch = async () => {
            if (!ObjectId.isValid(pagamento._eventID)) {
                return
            }
            const response = await fetch(`/api/get/minicursoProps/${pagamento._eventID}`)
            if (!response.ok) {
                return;
            }
            const data: { data: ICourse } = await response.json()
            setEvent(data.data)

        }
        dataFetch()
    }, [pagamento._eventID])

    //
    //
    const latestWebhook = pagamento._webhook?.[pagamento._webhook.length - 1]?.event
    const currentStatus = pagamento.status || latestWebhook
    const statusInfo = getPaymentStatusIconAndColor(currentStatus);
    const StatusIcon = statusInfo.Icon
    return (
        <div className="">

            {/* Card de conteúdo */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                    {/* Status e Descrição */}
                    <div className="flex-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {getPaymentStatusTranslation(currentStatus)}
                        </span>
                        <p className="text-lg font-bold text-gray-800 mt-2">{pagamento.description || "Pagamento"}</p>
                    </div>
                    {/* Valor */}
                    <div className="text-left sm:text-right">
                        <p className="text-sm text-gray-500">Valor</p>
                        <p className="text-2xl font-bold text-indigo-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pagamento.value)}
                        </p>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        {/* IDs */}
                        <div className="text-xs text-gray-500 space-y-2">
                            <p>ID Pag.: <span className="font-mono bg-gray-100 p-1 rounded">{pagamento.id}</span></p>
                            {
                                ObjectId.isValid(pagamento?._eventID) &&
                                <p> ID Event.: <span className="font-mono bg-gray-100 p-1 rounded">{pagamento._eventID}</span></p>
                            }
                        </div>
                        {/* Botão de Recibo */}
                        <Link href={pagamento.invoiceUrl} target="_blank" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 transition-colors w-full sm:w-auto">
                            Ver Recibo
                        </Link>
                    </div>
                </div>
                {
                    (ObjectId.isValid(pagamento?._eventID) && event !== null) &&
                    /* INÍCIO DA SEÇÃO ALTERADA COM ÍCONES */
                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                        <h4 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                            {/* Supondo que o ícone 'Bookmark' esteja disponível */}
                            <Bookmark className="h-5 w-5 text-indigo-500" />
                            Informações da Inscrição
                        </h4>
                        <div className="mt-3 space-y-2 text-sm pl-1">
                            <div className="flex justify-between items-center">
                                <p className="flex items-center text-gray-500 font-medium">
                                    {/* Supondo que o ícone 'FileText' esteja disponível */}
                                    <FileText className="h-4 w-4 mr-2" />
                                    <span>Nome do Evento:</span>
                                </p>
                                <p className="text-gray-800 text-right">{event?.name || "Não encontrado"}</p>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="flex items-center text-gray-500 font-medium">
                                    {/* Supondo que o ícone 'Tag' esteja disponível */}
                                    <Tag className="h-4 w-4 mr-2" />
                                    <span>Tipo:</span>
                                </p>
                                <p className="text-gray-800">{event?.type || "Não encontrado"}</p>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="flex items-center text-gray-500 font-medium">
                                    {/* Supondo que o ícone 'Hash' esteja disponível */}
                                    <Hash className="h-4 w-4 mr-2" />
                                    <span>ID do Evento:</span>
                                </p>
                                <p className="font-mono text-xs bg-gray-100 p-1 rounded">{event?._id || "Não encontrado"}</p>
                            </div>
                        </div>
                    </div>
                    /* FIM DA SEÇÃO ALTERADA */
                }
            </div>
        </div>
    )
}
