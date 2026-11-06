"use client"

import { useParams } from "next/navigation"
import { Cabecalho, Metrica, Pagina } from "@/app/components/ui"
import { Copiavel } from "@/app/components/Copiavel"
import { parseAdminUserDetailsHttpResponse, type AdminUserDetails } from "@/app/lib/users/admin-user-contract"
import type { AdminUserPaymentsResponse } from "@/app/lib/types/payments/payment-admin.t"
import { participationModeLabel } from "@/app/lib/users/admin-remote-work"
import { formatarData } from "@/app/lib/formatar"
import type { ICourse } from "@/app/lib/types/events/event.t"
import { mensagemDe, pedirJson, useCarga } from "./_componentes/carga"
import { CadastroSecao } from "./_componentes/CadastroSecao"
import { ParticipacaoRemotaSecao } from "./_componentes/ParticipacaoRemotaSecao"
import { AtividadesSecao } from "./_componentes/AtividadesSecao"
import { ComprasSecao, HistoricoLegadoSecao, SituacaoPagamentoSecao, type ComprasAtuais } from "./_componentes/FinanceiroSecoes"

const SITUACAO: Record<number, string> = {
    1: "Pago",
    2: "Pagamento pendente",
    0: "Não pago",
    3: "Suspenso",
}

const SECOES = [
    ["cadastro", "Cadastro"],
    ["participacao-remota", "Participação remota"],
    ["atividades", "Atividades"],
    ["situacao-pagamento", "Situação do pagamento"],
    ["compras", "Compras"],
    ["historico-legado", "Histórico legado"],
] as const

export default function Page() {
    const { userId } = useParams<{ userId: string }>()
    // A chave reinicia as cargas se a rota passar de uma pessoa para outra.
    return <Ficha key={userId} userId={userId} />
}

function Ficha({ userId }: { userId: string }) {
    // Cada seção tem a própria carga: uma que falha não bloqueia as outras.
    const usuario = useCarga<AdminUserDetails>(async () => {
        const r = await pedirJson(`/api/get/usuarioPorId/${userId}`)
        const dados = parseAdminUserDetailsHttpResponse(r.ok, r.corpo)
        if (!dados) throw new Error(mensagemDe(r.corpo) ?? (r.ok ? "Os dados do cadastro estão em formato inválido." : "Cadastro não encontrado."))
        return dados
    })

    const cursos = useCarga<ICourse[]>(async () => {
        const r = await pedirJson(`/api/get/minicursosDeUsuario/${userId}`)
        if (!r.ok) throw new Error("Não foi possível carregar as atividades.")
        if (typeof r.corpo !== "object" || r.corpo === null || !("data" in r.corpo) || !Array.isArray(r.corpo.data)) {
            throw new Error("As informações de atividades estão em formato inválido.")
        }
        return r.corpo.data as ICourse[]
    })

    const compras = useCarga<ComprasAtuais>(async () => {
        const r = await pedirJson(`/api/get/pagamentos/usuario/${userId}`)
        if (r.status === 403) return { negado: true }
        if (!r.ok) throw new Error("Não foi possível carregar as compras.")
        const d = r.corpo as Partial<AdminUserPaymentsResponse> | null
        if (
            !d || !Array.isArray(d.payments) || typeof d.issueCounts !== "object" || d.issueCounts === null ||
            typeof d.issueCounts.reviewRequired !== "number" || typeof d.issueCounts.failed !== "number"
        ) {
            throw new Error("A resposta de compras está em formato inválido.")
        }
        return { negado: false, payments: d.payments, issueCounts: d.issueCounts }
    })

    const u = usuario.dados
    const situacao = u?.pagamento.situacao != null ? SITUACAO[u.pagamento.situacao] : null

    return (
        <Pagina>
            <Cabecalho
                acento="azul"
                etiqueta="Ficha da pessoa"
                titulo={u ? u.informacoes_usuario.nome ?? "Cadastro pendente" : usuario.carregando ? "Carregando ficha…" : "Ficha indisponível"}
                sub={u ? <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full bg-cartao py-0.5 pl-3 pr-1 text-sm text-tinta">ID <Copiavel texto={u._id} rotulo="ID da pessoa" /></span> : undefined}
                voltar={{ href: "/usuarios", rotulo: "Voltar para a lista" }}
            >
                {u && (
                    <section aria-label="Resumo da pessoa" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Metrica rotulo="Situação" valor={situacao ?? "Não informada"} detalhe={u.pagamento.tipo_pagamento ?? "Tipo não informado"} />
                        <Metrica rotulo="Participação" valor={participationModeLabel(u.participacao.mode)} detalhe={u.participacao.remoteWorkCount > 0 ? `${u.participacao.remoteWorkCount} trabalho(s) remoto(s)` : undefined} />
                        <Metrica rotulo="Cadastro" valor={u.cadastroPendente ? "Incompleto" : "Completo"} detalhe={`Criado em ${formatarData(u.informacoes_usuario.data_criacao, "data não informada")}`} />
                        <Metrica rotulo="Lote" valor={u.lote?.organizador ? "Organizador" : u.lote?.nome ?? "Sem lote"} />
                    </section>
                )}
            </Cabecalho>

            <nav aria-label="Seções da ficha" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {SECOES.map(([id, rotulo]) => (
                    <a key={id} href={`#${id}`} className="inline-flex min-h-9 items-center font-medium text-info hover:underline">{rotulo}</a>
                ))}
            </nav>

            <CadastroSecao carga={usuario} userId={userId} />
            <ParticipacaoRemotaSecao carga={usuario} userId={userId} />
            <AtividadesSecao carga={cursos} userId={userId} />
            <SituacaoPagamentoSecao carga={usuario} userId={userId} />
            <ComprasSecao carga={compras} />
            <HistoricoLegadoSecao carga={usuario} />
        </Pagina>
    )
}
