"use client"

import { useState } from "react"
import { Calendar, ListChecks, MapPin, Users } from "lucide-react"
import { Botao, BotaoLink, Secao, Selo } from "@/app/components/ui"
import { Estado } from "@/app/components/Estado"
import { useAvisos } from "@/app/components/Avisos"
import { useUser } from "@/app/lib/auth0-client"
import { renderEmojiAsLucide } from "@/app/lib/utils/emojiToLucide"
import { formatarDataHora, formatarHora, formatarMoeda, formatarNumero } from "@/app/lib/formatar"
import type { ICourse } from "@/app/lib/types/events/event.t"
import { mensagemDe, pedirJson, type Carga } from "./carga"
import { CorpoCarga } from "./comuns"

const contem = (lista: unknown, id: string) => Array.isArray(lista) && lista.some((x) => String(x) === id)

export function AtividadesSecao({ carga, userId }: { carga: Carga<ICourse[]>; userId: string }) {
    return (
        <Secao id="atividades" titulo="Atividades" descricao="Minicursos em que a pessoa está inscrita ou tem presença registrada." className="scroll-mt-4">
            <CorpoCarga carga={carga} titulo="Atividades">
                {(cursos) =>
                    cursos.length === 0 ? (
                        <Estado tipo="vazio" titulo="Nenhuma atividade" texto="Esta pessoa não está inscrita em minicursos." />
                    ) : (
                        <ul className="grid gap-3 lg:grid-cols-2">
                            {cursos.map((curso) => <li key={curso._id}><Atividade curso={curso} userId={userId} aoRetirar={carga.recarregar} /></li>)}
                        </ul>
                    )
                }
            </CorpoCarga>
        </Secao>
    )
}

function Atividade({ curso, userId, aoRetirar }: { curso: ICourse; userId: string; aoRetirar: () => Promise<void> }) {
    const { avisar, escolher } = useAvisos()
    // conta de admin (mesmo id de userPermissionsServerSide); as outras contas levam 403 na remoção
    const ehAdmin = Boolean(useUser()?.user?.sub?.includes("6a8799078ecd649be9bdb061"))
    const [retirando, setRetirando] = useState(false)
    const linhas = curso.timeline ?? []
    const max = curso.maxParticipants
    const percentual = max > 0 ? Math.min(100, (curso.participantsCount / max) * 100) : 0

    const inscrito = contem(curso.participants, userId)

    const retirarInscricao = async () => {
        const pago = !curso.isFree
        const escolha = await escolher({
            titulo: "Retirar a inscrição deste minicurso?",
            descricao: <>Você vai retirar a inscrição da pessoa do minicurso &ldquo;{curso.name}&rdquo;. Se houver cobrança em aberto no Asaas, ela será cancelada. Pagamento já recebido <strong>NÃO</strong> será estornado.</>,
            conteudo: pago ? <p className="text-sm text-sutil"><strong className="text-tinta">Cancelar sem estorno</strong>: o congressista aceitou perder o dinheiro. A inscrição sai só do site e nada é cancelado nem estornado no Asaas. Se uma cobrança em aberto for paga depois, a pessoa não volta para o minicurso.</p> : undefined,
            rotuloConfirmar: "Retirar inscrição",
            rotuloAlternativa: pago ? "Cancelar sem estorno" : undefined,
            rotuloCancelar: "Voltar",
            perigo: true,
        })
        if (escolha === "cancelar") return
        const semEstorno = escolha === "alternativa"
        setRetirando(true)
        try {
            const r = await pedirJson("/api/delete/removerInscricaoMinicurso/", {
                method: "DELETE",
                body: JSON.stringify({ eventId: curso._id, userId, semEstorno }),
            })
            if (!r.ok) {
                avisar("erro", "Não foi possível retirar a inscrição", mensagemDe(r.corpo) ?? "Tente novamente.")
                return
            }
            const mantido = typeof r.corpo === "object" && r.corpo !== null && "pagamentoMantido" in r.corpo && r.corpo.pagamentoMantido === true
            if (semEstorno) avisar("ok", "Inscrição cancelada sem estorno", "Nada foi cancelado nem estornado no Asaas.")
            else if (mantido) avisar("alerta", "Inscrição retirada, mas o pagamento NÃO foi estornado", "A cobrança desta atividade já estava paga e foi mantida. O estorno, se houver, é feito pelo painel do Asaas.")
            else avisar("ok", "Inscrição retirada do minicurso")
            await aoRetirar()
        } catch (error) {
            avisar("erro", "Não foi possível retirar a inscrição", error instanceof Error ? error.message : "Tente novamente.")
        } finally {
            setRetirando(false)
        }
    }

    return (
        <article className="flex h-full flex-col gap-3 rounded-xl border border-linha p-4">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-acao" aria-hidden="true">{curso.emoji ? renderEmojiAsLucide(curso.emoji, { size: 28 }) : null}</span>
                <div className="min-w-0 flex-1">
                    <h3 className="titulo text-lg leading-snug">{curso.name}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {inscrito && <Selo tom="info">Inscrito(a)</Selo>}
                        {contem(curso.attendanceList, userId) && <Selo tom="ok">Presença registrada</Selo>}
                        <Selo tom={curso.isOpen ? "ok" : "neutro"}>{curso.isOpen ? "Inscrições abertas" : "Inscrições encerradas"}</Selo>
                        <Selo tom={curso.isFree ? "info" : "alerta"}>{curso.isFree ? "Gratuito" : formatarMoeda(curso.value)}</Selo>
                    </div>
                </div>
            </div>

            {curso.description && <p className="line-clamp-3 text-sm text-sutil">{curso.description}</p>}

            <ul className="grid gap-1.5 text-sm">
                {linhas.map((t) => (
                    <li key={t._id} className="flex items-start gap-2">
                        <Calendar className="mt-0.5 size-4 shrink-0 text-sutil" aria-hidden="true" />
                        <span>
                            {formatarDataHora(t.date_init)} às {formatarHora(t.date_end)}
                            {t.local && <span className="text-sutil"> · <MapPin className="inline size-3.5" aria-hidden="true" /> {t.local}</span>}
                        </span>
                    </li>
                ))}
            </ul>

            <div>
                <p className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-sutil"><Users className="size-4" aria-hidden="true" />Vagas preenchidas</span>
                    <span className="num font-semibold">{formatarNumero(curso.participantsCount)} de {formatarNumero(max)}</span>
                </p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-recuo" aria-hidden="true">
                    <div className="h-full rounded-full bg-tinta" style={{ width: `${percentual}%` }} />
                </div>
            </div>

            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-linha pt-3">
                {inscrito && ehAdmin && (
                    <Botao estilo="perigo" tamanho="pequeno" carregando={retirando} onClick={() => void retirarInscricao()} aria-label={`Cancelar inscrição no minicurso ${curso.name}`}>Cancelar inscrição</Botao>
                )}
                <BotaoLink href={`/presenca/gerarListaMinicursoPresenca/${curso._id}`} estilo="contorno" tamanho="pequeno"><ListChecks className="size-4" aria-hidden="true" />Lista de presença</BotaoLink>
                <BotaoLink href={`/gerenciarMinicursos/configurar/${curso._id}`} estilo="contorno" tamanho="pequeno">Abrir atividade</BotaoLink>
            </div>
        </article>
    )
}
