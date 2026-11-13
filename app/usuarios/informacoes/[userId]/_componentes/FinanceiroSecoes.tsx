"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ObjectId } from "bson"
import { ExternalLink, Save } from "lucide-react"
import { Aviso, Botao, Campo, Escolha, Secao, Selo } from "@/app/components/ui"
import { Estado } from "@/app/components/Estado"
import { useAvisos } from "@/app/components/Avisos"
import { formatarMoeda } from "@/app/lib/formatar"
import type { AdminModernPayment, AdminUserPaymentsResponse } from "@/app/lib/types/payments/payment-admin.t"
import type { ICourse } from "@/app/lib/types/events/event.t"
import type { IPayment } from "@/app/lib/types/payments/payment.t"
import type { AdminUserDetails } from "@/app/lib/users/admin-user-contract"
import { enviarPut, pedirJson, type Carga } from "./carga"
import { Codigo, CorpoCarga, Dado, Tecnico } from "./comuns"
import { CompraAtual } from "./CompraAtual"
import { situacaoPagamento, tomPagamento } from "./textos-pagamento"

export type ComprasAtuais = { negado: true } | { negado: false; payments: AdminModernPayment[]; issueCounts: AdminUserPaymentsResponse["issueCounts"] }

const SITUACOES: { valor: string; rotulo: string }[] = [
    { valor: "1", rotulo: "Pago" },
    { valor: "2", rotulo: "Pagamento pendente" },
    { valor: "0", rotulo: "Não pago" },
    { valor: "3", rotulo: "Suspenso" },
]
const rotuloSituacao = (v: string) => SITUACOES.find((s) => s.valor === v)?.rotulo ?? "Não informada"

/** Ação financeira: altera só o registro da pessoa; fica separada do cadastro de propósito. */
export function SituacaoPagamentoSecao({ carga, userId }: { carga: Carga<AdminUserDetails>; userId: string }) {
    return (
        <Secao id="situacao-pagamento" titulo="Situação do pagamento" descricao="Ação financeira, separada do cadastro. Muda o registro da pessoa no sistema." className="scroll-mt-4">
            <CorpoCarga carga={carga} titulo="Situação do pagamento" linhas={1}>
                {(usuario) => {
                    const chave = `${usuario.pagamento.situacao}|${usuario.pagamento.tipo_pagamento}`
                    return <FormularioSituacao key={chave} usuario={usuario} userId={userId} aoSalvar={carga.recarregar} />
                }}
            </CorpoCarga>
        </Secao>
    )
}

function FormularioSituacao({ usuario, userId, aoSalvar }: { usuario: AdminUserDetails; userId: string; aoSalvar: () => Promise<void> }) {
    const { avisar, confirmar } = useAvisos()
    const baseSituacao = String(usuario.pagamento.situacao ?? "")
    const baseTipo = usuario.pagamento.tipo_pagamento ?? ""
    const [situacao, setSituacao] = useState(baseSituacao)
    const [tipo, setTipo] = useState(baseTipo)
    const [salvando, setSalvando] = useState(false)
    const mudouSituacao = situacao !== baseSituacao
    const mudouTipo = tipo !== baseTipo

    async function salvar(e: FormEvent) {
        e.preventDefault()
        if (!mudouSituacao && !mudouTipo) return
        const ok = await confirmar({
            titulo: mudouSituacao ? `Mudar a situação para "${rotuloSituacao(situacao)}"?` : "Mudar o tipo de pagamento?",
            descricao: (
                <>
                    {mudouSituacao && <p>Situação: de {rotuloSituacao(baseSituacao)} para {rotuloSituacao(situacao)}.</p>}
                    {mudouTipo && <p>Tipo de pagamento: de &ldquo;{baseTipo || "vazio"}&rdquo; para &ldquo;{tipo || "vazio"}&rdquo;.</p>}
                    <p className="mt-2">Isso altera só o registro desta pessoa no sistema: não cria, cancela nem estorna cobranças no Asaas.</p>
                </>
            ),
            perigo: true,
            rotuloConfirmar: "Confirmar alteração",
        })
        if (!ok) return
        setSalvando(true)
        try {
            const corpo: Record<string, string | number> = { userId }
            if (mudouSituacao) corpo.situacao = Number(situacao)
            if (mudouTipo) corpo.tipo_pagamento = tipo
            await enviarPut("/api/put/usuario/atualizarUsuario/", corpo)
            avisar("ok", "Situação do pagamento atualizada")
            await aoSalvar()
        } catch (error) {
            avisar("erro", "Não foi possível salvar", error instanceof Error ? error.message : undefined)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <form onSubmit={salvar} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <Escolha rotulo="Situação do pagamento" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
                    <option value="" disabled>Não informada</option>
                    {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
                </Escolha>
                <Campo rotulo="Tipo de pagamento" autoComplete="off" value={tipo} onChange={(e) => setTipo(e.target.value)} ajuda="Texto livre registrado na pessoa (por exemplo, o perfil do lote)." />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-linha pt-4">
                <p className="text-sm text-sutil" role="status">{mudouSituacao || mudouTipo ? "Há alteração pendente." : "Altere um campo para poder salvar."}</p>
                <Botao type="submit" estilo="contorno" carregando={salvando} disabled={!mudouSituacao && !mudouTipo}>
                    <Save className="size-4" aria-hidden="true" />Salvar situação
                </Botao>
            </div>
        </form>
    )
}

export function ComprasSecao({ carga }: { carga: Carga<ComprasAtuais> }) {
    return (
        <Secao
            id="compras"
            titulo="Compras"
            descricao="Compras da estrutura atual, conciliadas entre atribuição, sessão e eventos. O conteúdo bruto do webhook não é exibido."
            className="scroll-mt-4"
            acoes={carga.dados && !carga.dados.negado && (
                <div className="flex flex-wrap gap-2">
                    <Selo tom={carga.dados.issueCounts.reviewRequired > 0 ? "alerta" : "neutro"}>{carga.dados.issueCounts.reviewRequired} em revisão</Selo>
                    <Selo tom={carga.dados.issueCounts.failed > 0 ? "erro" : "neutro"}>{carga.dados.issueCounts.failed} com falha</Selo>
                </div>
            )}
        >
            <CorpoCarga carga={carga} titulo="Compras" linhas={2}>
                {(dados) =>
                    dados.negado ? (
                        <Estado tipo="semPermissao" titulo="Sem acesso às compras" texto="Sua conta não tem permissão para ver as compras desta pessoa." />
                    ) : dados.payments.length === 0 ? (
                        <Estado tipo="vazio" titulo="Nenhuma compra" texto="Não há compras na estrutura atual para esta pessoa." />
                    ) : (
                        <div className="grid gap-4">{dados.payments.map((p) => <CompraAtual key={p.compraId} payment={p} />)}</div>
                    )
                }
            </CorpoCarga>
        </Secao>
    )
}

type Eventos = Record<string, ICourse | null>

/** Busca cada evento distinto uma única vez, mesmo que vários pagamentos apontem para ele. */
function useEventos(ids: string[]): Eventos | null {
    const chave = ids.join(",")
    const [resultado, setResultado] = useState<{ chave: string; eventos: Eventos } | null>(null)

    useEffect(() => {
        let ativo = true
        void (async () => {
            const lista = chave ? chave.split(",") : []
            const pares = await Promise.all(lista.map(async (id) => {
                try {
                    const r = await pedirJson(`/api/get/minicursoProps/${id}`)
                    const dados = r.ok && typeof r.corpo === "object" && r.corpo !== null && "data" in r.corpo ? (r.corpo.data as ICourse | null) : null
                    return [id, dados] as const
                } catch {
                    return [id, null] as const
                }
            }))
            if (ativo) setResultado({ chave, eventos: Object.fromEntries(pares) })
        })()
        return () => { ativo = false }
    }, [chave])

    return resultado?.chave === chave ? resultado.eventos : null
}

type Legado = IPayment["lista_pagamentos"][number]

export function HistoricoLegadoSecao({ carga }: { carga: Carga<AdminUserDetails> }) {
    return (
        <Secao id="historico-legado" titulo="Histórico legado de pagamentos" descricao="Cobranças anteriores à estrutura atual de compras. Somente consulta." className="scroll-mt-4">
            <CorpoCarga carga={carga} titulo="Histórico legado" linhas={2}>
                {(usuario) => <ListaLegado pagamentos={usuario.pagamento.lista_pagamentos ?? []} />}
            </CorpoCarga>
        </Secao>
    )
}

function ListaLegado({ pagamentos }: { pagamentos: Legado[] }) {
    const ids = [...new Set(pagamentos.map((p) => p._eventID).filter((id) => ObjectId.isValid(id)))]
    const eventos = useEventos(ids)
    if (pagamentos.length === 0) return <Estado tipo="vazio" titulo="Nenhum pagamento anterior" texto="Esta pessoa não tem cobranças no histórico legado." />
    return (
        <div className="grid gap-3">
            {pagamentos.map((p) => <PagamentoLegado key={p._id} pagamento={p} eventos={eventos} />)}
        </div>
    )
}

function PagamentoLegado({ pagamento, eventos }: { pagamento: Legado; eventos: Eventos | null }) {
    const ultimoEvento = pagamento._webhook?.[pagamento._webhook.length - 1]?.event
    const situacao = pagamento.status || ultimoEvento
    const temEvento = ObjectId.isValid(pagamento._eventID)
    const evento = temEvento && eventos ? eventos[pagamento._eventID] : null

    return (
        <article className="grid gap-3 rounded-xl border border-linha p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <Selo tom={tomPagamento(situacao)}>{situacaoPagamento(situacao)}</Selo>
                    <h3 className="mt-1.5 font-semibold">{pagamento.description || "Pagamento"}</h3>
                </div>
                <p className="num titulo text-xl">{formatarMoeda(pagamento.value)}</p>
            </div>

            {temEvento && (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {eventos === null ? (
                        <Dado rotulo="Evento">Carregando…</Dado>
                    ) : evento ? (
                        <>
                            <Dado rotulo="Evento">{evento.name || "Sem nome"}</Dado>
                            <Dado rotulo="Tipo">{evento.type || "Não informado"}</Dado>
                        </>
                    ) : (
                        <Dado rotulo="Evento">Não foi possível carregar os dados do evento.</Dado>
                    )}
                </dl>
            )}

            {pagamento.invoiceUrl && (
                <div>
                    <a href={pagamento.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-linha bg-cartao px-5 text-sm font-semibold hover:border-tinta/40">
                        Ver recibo<ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                </div>
            )}

            <Tecnico>
                <Codigo rotulo="ID da cobrança" texto={pagamento.id} />
                {temEvento && <Codigo rotulo="ID do evento" texto={pagamento._eventID} />}
            </Tecnico>
        </article>
    )
}
