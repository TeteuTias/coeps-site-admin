"use client"

import { useParams } from "next/navigation"
import { Cabecalho, Pagina, Selo, type TomSelo } from "@/app/components/ui"
import { Copiavel } from "@/app/components/Copiavel"
import { parseAdminUserDetailsHttpResponse, type AdminUserDetails } from "@/app/lib/users/admin-user-contract"
import type { AdminUserPaymentsResponse } from "@/app/lib/types/payments/payment-admin.t"
import type { ICourse } from "@/app/lib/types/events/event.t"
import { mensagemDe, pedirJson, useCarga } from "./_componentes/carga"
import { CadastroSecao } from "./_componentes/CadastroSecao"
import { ParticipacaoRemotaSecao } from "./_componentes/ParticipacaoRemotaSecao"
import { AtividadesSecao } from "./_componentes/AtividadesSecao"
import { ComprasSecao, HistoricoLegadoSecao, SituacaoPagamentoSecao, type ComprasAtuais } from "./_componentes/FinanceiroSecoes"

const SITUACAO: Record<number, { rotulo: string; tom: TomSelo }> = {
    1: { rotulo: "Pago", tom: "ok" },
    2: { rotulo: "Pagamento pendente", tom: "alerta" },
    0: { rotulo: "Não pago", tom: "neutro" },
    3: { rotulo: "Suspenso", tom: "erro" },
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
                etiqueta="Ficha da pessoa"
                titulo={u ? u.informacoes_usuario.nome ?? "Cadastro pendente" : usuario.carregando ? "Carregando ficha…" : "Ficha indisponível"}
                sub={u ? <span className="inline-flex flex-wrap items-center gap-1.5">ID <Copiavel texto={u._id} rotulo="ID da pessoa" /></span> : undefined}
                voltar={{ href: "/usuarios", rotulo: "Voltar para a lista" }}
            />

            {u && (
                <div className="flex flex-wrap gap-2">
                    {situacao ? <Selo tom={situacao.tom}>{situacao.rotulo}</Selo> : <Selo>Situação não informada</Selo>}
                    {u.cadastroPendente && <Selo tom="alerta">Cadastro incompleto</Selo>}
                </div>
            )}

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
