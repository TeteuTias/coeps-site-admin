"use client"

import { useState } from "react"
import { Download, ExternalLink, Laptop, ShieldAlert, ShieldCheck } from "lucide-react"
import { Aviso, Botao, BotaoLink, Secao, Selo, classeBotao, type TomSelo } from "@/app/components/ui"
import { useAvisos } from "@/app/components/Avisos"
import { formatarDataHora } from "@/app/lib/formatar"
import { participationModeLabel, type AdminRemoteAccessStatus, type AdminRemoteParticipation, type AdminRemoteProofReviewStatus } from "@/app/lib/users/admin-remote-work"
import type { AdminUserDetails } from "@/app/lib/users/admin-user-contract"
import { enviarPut, type Carga } from "./carga"
import { Codigo, CorpoCarga, Dado, Tecnico, capitalizar } from "./comuns"

const ACESSO: Record<AdminRemoteAccessStatus, string> = {
    ELIGIBLE: "Elegível",
    PAYMENT_PENDING: "Pagamento pendente",
    ACTIVE: "Acesso ativo",
    REVIEW_REQUIRED: "Em revisão",
    REVOKED: "Acesso revogado",
}
const AUDITORIA: Record<AdminRemoteProofReviewStatus, string> = { PENDING: "Pendente", APPROVED: "Aprovado", INCONSISTENT: "Inconsistente" }

const naoInformado = (v: string | null) => formatarDataHora(v, "Não informado")

export function ParticipacaoRemotaSecao({ carga, userId }: { carga: Carga<AdminUserDetails>; userId: string }) {
    const { avisar, confirmar } = useAvisos()
    const [revisando, setRevisando] = useState<"APPROVED" | "INCONSISTENT" | null>(null)

    async function revisar(status: "APPROVED" | "INCONSISTENT") {
        if (status === "INCONSISTENT") {
            const ok = await confirmar({
                titulo: "Marcar o comprovante como inconsistente?",
                descricao: "Isso bloqueia novas submissões remotas desta pessoa e sinaliza os trabalhos vinculados para revisão.",
                perigo: true,
                rotuloConfirmar: "Marcar inconsistente",
            })
            if (!ok) return
        }
        setRevisando(status)
        try {
            await enviarPut(`/api/put/usuarios/${userId}/participacao-remota`, { status })
            avisar("ok", status === "APPROVED" ? "Comprovante aprovado" : "Comprovante marcado como inconsistente")
            await carga.recarregar()
        } catch (error) {
            avisar("erro", "Não foi possível registrar a auditoria", error instanceof Error ? error.message : undefined)
        } finally {
            setRevisando(null)
        }
    }

    return (
        <Secao
            id="participacao-remota"
            titulo="Participação remota de trabalhos"
            descricao="Acesso, comprovante de residência e trabalhos vinculados na edição atual."
            className="scroll-mt-4"
        >
            <CorpoCarga carga={carga} titulo="Participação remota">
                {(usuario) => <Conteudo p={usuario.participacao} userId={usuario._id} revisando={revisando} aoRevisar={revisar} />}
            </CorpoCarga>
        </Secao>
    )
}

function Conteudo({ p, userId, revisando, aoRevisar }: {
    p: AdminRemoteParticipation; userId: string; revisando: "APPROVED" | "INCONSISTENT" | null; aoRevisar: (s: "APPROVED" | "INCONSISTENT") => void
}) {
    const proofUrl = p.proof ? `/api/get/usuarios/${encodeURIComponent(userId)}/comprovante-remoto/${encodeURIComponent(p.proof.id)}` : null
    const tom: TomSelo = p.status === "ACTIVE" ? "ok" : p.status === "REVIEW_REQUIRED" || p.reviewStatus === "INCONSISTENT" ? "erro" : "alerta"

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <Laptop className="size-5 text-sutil" aria-hidden="true" />
                <Selo tom="info">{participationModeLabel(p.mode)}</Selo>
                <Selo tom={tom}>{p.status ? ACESSO[p.status] : "Sem acesso remoto"}</Selo>
            </div>

            {!p.accessId ? (
                <p className="rounded-xl bg-recuo/60 px-4 py-5 text-center text-sm text-sutil">Esta pessoa não pediu apresentação remota na edição atual.</p>
            ) : (
                <>
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Dado rotulo="Situação do acesso">{p.status ? ACESSO[p.status] : "Não informada"}</Dado>
                        <Dado rotulo="Auditoria do comprovante">{p.reviewStatus ? AUDITORIA[p.reviewStatus] : "Pendente"}</Dado>
                        <Dado rotulo="Confirmação">{naoInformado(p.confirmedAt)}</Dado>
                        <Dado rotulo="Cidade/UF">{p.municipalityName && p.uf ? `${p.municipalityName}/${p.uf}` : "Não informado"}</Dado>
                    </dl>

                    {p.reviewReason && <Aviso tom="alerta" titulo="Motivo da revisão">{p.reviewReason}</Aviso>}

                    <div className="grid gap-3 rounded-xl border border-linha p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="font-semibold">Comprovante de residência</h3>
                                <p className="mt-0.5 text-sm text-sutil">
                                    {p.proof
                                        ? `${p.proof.originalName} · ${(p.proof.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB · enviado em ${naoInformado(p.proof.uploadedAt)}`
                                        : "Nenhum comprovante associado."}
                                </p>
                            </div>
                            {proofUrl && (
                                <div className="flex flex-wrap gap-2">
                                    <BotaoLink href={proofUrl} target="_blank" rel="noreferrer" estilo="contorno" prefetch={false}><ExternalLink className="size-4" aria-hidden="true" />Visualizar</BotaoLink>
                                    <a href={`${proofUrl}?download=1`} className={classeBotao("contorno")}><Download className="size-4" aria-hidden="true" />Baixar</a>
                                </div>
                            )}
                        </div>
                        {p.proof && (
                            <div className="flex flex-wrap gap-2 border-t border-linha pt-3">
                                <Botao estilo="contorno" carregando={revisando === "APPROVED"} disabled={revisando !== null} onClick={() => void aoRevisar("APPROVED")}>
                                    <ShieldCheck className="size-4" aria-hidden="true" />Aprovar comprovante
                                </Botao>
                                <Botao estilo="perigo" carregando={revisando === "INCONSISTENT"} disabled={revisando !== null} onClick={() => void aoRevisar("INCONSISTENT")}>
                                    <ShieldAlert className="size-4" aria-hidden="true" />Marcar inconsistente
                                </Botao>
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="font-semibold">Trabalhos remotos vinculados ({p.remoteWorkCount})</h3>
                        {p.works.length === 0 ? (
                            <p className="mt-2 rounded-xl bg-recuo/60 px-4 py-4 text-sm text-sutil">Nenhum trabalho remoto vinculado a este acesso.</p>
                        ) : (
                            <ul className="mt-3 grid gap-2">
                                {p.works.map((w) => (
                                    <li key={w.id} className="rounded-xl border border-linha p-4 text-sm">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <strong>{w.title}</strong>
                                            <Selo>{w.status ? capitalizar(w.status) : "Sem situação"}</Selo>
                                        </div>
                                        <p className="mt-1 text-xs text-sutil">Enviado em {naoInformado(w.submittedAt)}</p>
                                        {w.financialReviewStatus === "REVIEW_REQUIRED" && <p className="mt-2 font-semibold text-erro">Revisão financeira necessária</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <Tecnico>
                        <Codigo rotulo="Edição" texto={p.editionId} />
                        <Codigo rotulo="Código IBGE do município" texto={p.municipalityCode} />
                        <Codigo rotulo="ID do acesso remoto" texto={p.accessId} />
                        <Codigo rotulo="ID da compra" texto={p.purchaseId} />
                    </Tecnico>
                </>
            )}
        </>
    )
}
