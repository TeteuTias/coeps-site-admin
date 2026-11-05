import { ExternalLink } from "lucide-react"
import { Aviso, Selo, TabelaRolavel, classeTd, classeTh } from "@/app/components/ui"
import { formatarCentavos } from "@/app/lib/formatar"
import type { AdminModernPayment, AdminRefundsSnapshot } from "@/app/lib/types/payments/payment-admin.t"
import { Codigo, Dado, Tecnico } from "./comuns"
import { dataEstorno, dataOuNaoInformado, metodoPagamento, situacaoAtribuicao, situacaoEstorno, situacaoFalha, situacaoPagamento, tomPagamento } from "./textos-pagamento"

function Estornos({ snapshot }: { snapshot: AdminRefundsSnapshot }) {
    if (snapshot.items.length === 0) return <p className="mt-2 text-sm">Nenhum registro de estorno.</p>
    return (
        <ul className="mt-2 grid gap-2">
            {snapshot.items.map((item, i) => (
                <li key={`${item.dateCreated ?? "estorno"}-${i}`} className="rounded-lg bg-cartao/80 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                        <strong>{situacaoEstorno(item.status)}</strong>
                        <span className="num">{formatarCentavos(item.valueCentavos)}</span>
                    </div>
                    <p className="mt-1 text-xs text-sutil">Criado em {dataEstorno(item.dateCreated)}</p>
                    {item.transactionReceiptUrl && (
                        <a href={item.transactionReceiptUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-info underline">
                            Abrir comprovante do estorno<ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                    )}
                </li>
            ))}
        </ul>
    )
}

export function CompraAtual({ payment }: { payment: AdminModernPayment }) {
    const risco = Boolean(payment.financialRisk || payment.missingAssignment || payment.missingSession || payment.webhookIssues.length > 0 || payment.reconciliationReason)
    const tomAtribuicao = risco ? "alerta" : payment.attributionStatus === "CONFIRMADA" ? "ok" : payment.attributionStatus === "ESTORNADA" ? "erro" : "neutro"
    const titulo = payment.productType === "remote-work-access" ? "Apresentação remota" : "Inscrição regular"
    const flags = ([
        ["Evento em revisão", payment.financialReviewEvent],
        ["Recebimento em dinheiro", payment.cashReceiptStatus],
        ["Falha de pagamento", payment.paymentFailureStatus],
        ["Restauração", payment.restorationStatus],
        ["Liquidação Pix", payment.pixSettlementStatus],
    ] as [string, string | null][]).filter((e): e is [string, string] => Boolean(e[1]))
    const valores = payment.amountCentavos
    const plano = payment.installmentPlan

    return (
        <article className="grid gap-4 rounded-xl border border-linha p-4 sm:p-5" aria-label={`Compra: ${titulo}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h3 className="titulo text-lg">{titulo}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Selo tom={tomAtribuicao}>{situacaoAtribuicao(payment.attributionStatus)}</Selo>
                        {payment.sessionStatus && <Selo tom="info">Sessão: {situacaoAtribuicao(payment.sessionStatus)}</Selo>}
                    </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:text-right">
                    <Dado rotulo="Valor cobrado"><span className="num titulo text-xl">{formatarCentavos(valores.final)}</span></Dado>
                    <Dado rotulo="Líquido após estornos"><span className="num font-semibold text-ok">{formatarCentavos(valores.net)}</span></Dado>
                    {valores.refundDone > 0 && <Dado rotulo="Estornado"><span className="num text-alerta">{formatarCentavos(valores.refundDone)}</span></Dado>}
                    {valores.desconto !== null && valores.desconto > 0 && <Dado rotulo="Desconto"><span className="num">{formatarCentavos(valores.desconto)}</span></Dado>}
                </dl>
            </div>

            {(payment.missingAssignment || payment.missingSession) && (
                <Aviso tom="erro" titulo="Registro da compra incompleto">
                    Faltam {[payment.missingAssignment && "a atribuição", payment.missingSession && "a sessão"].filter(Boolean).join(" e ")}. A compra precisa de conciliação antes de qualquer ação manual.
                </Aviso>
            )}

            {(payment.chargebackStatus || payment.chargebackResolution) && (
                <Aviso tom="erro" titulo={`Contestação do pagamento (chargeback): ${situacaoPagamento(payment.chargebackStatus ?? "resolvida")}`}>
                    {payment.chargebackResolution && <p>Resolução: {payment.chargebackResolution}</p>}
                    {payment.chargebackStatus && <p>Esta compra continua destacada como valor em risco até a resolução.</p>}
                </Aviso>
            )}

            {payment.reconciliationReason && <Aviso tom="alerta" titulo="Conciliação necessária">{payment.reconciliationReason}</Aviso>}

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Dado rotulo="Forma de pagamento">{metodoPagamento(payment.method)}</Dado>
                <Dado rotulo="Situação no Asaas">{payment.gatewayState ? situacaoPagamento(payment.gatewayState) : "Não informada"}</Dado>
                <Dado rotulo="Criada em">{dataOuNaoInformado(payment.createdAt)}</Dado>
                <Dado rotulo="Confirmada em">{dataOuNaoInformado(payment.confirmedAt)}</Dado>
                <Dado rotulo="Atualizada em">{dataOuNaoInformado(payment.updatedAt)}</Dado>
            </dl>

            {flags.length > 0 && (
                <dl className="grid gap-2 rounded-xl border border-alerta/20 bg-alerta-fundo p-4 text-sm text-alerta sm:grid-cols-2">
                    {flags.map(([rotulo, valor]) => (
                        <div key={rotulo}><dt className="font-semibold">{rotulo}</dt><dd className="break-words">{situacaoPagamento(valor)}</dd></div>
                    ))}
                </dl>
            )}

            {plano && (
                <section className="rounded-xl border border-info/20 bg-info-fundo p-4" aria-label="Plano de parcelamento">
                    <h4 className="font-semibold text-info">Parcelamento no Asaas</h4>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Dado rotulo="Parcelas"><span className="num">{plano.count} × {formatarCentavos(plano.installmentValueCentavos)}</span></Dado>
                        <Dado rotulo="Total do plano"><span className="num">{formatarCentavos(plano.totalValueCentavos)}</span></Dado>
                        <Dado rotulo="Estornos concluídos (soma)"><span className="num">{formatarCentavos(plano.refundTotalDoneCentavos)}</span></Dado>
                    </dl>

                    <h5 className="mt-4 text-sm font-semibold">Cobranças acompanhadas</h5>
                    {plano.observedPayments.length === 0 ? (
                        <p className="mt-1 text-sm">Nenhuma cobrança individual acompanhada ainda.</p>
                    ) : (
                        <TabelaRolavel rotulo="Cobranças do parcelamento" className="mt-2">
                            <thead><tr>
                                <th className={classeTh}>Parcela</th><th className={classeTh}>Situação</th>
                                <th className={`${classeTh} text-right`}>Valor</th><th className={classeTh}>Acompanhada em</th><th className={classeTh}>Códigos</th>
                            </tr></thead>
                            <tbody>
                                {plano.observedPayments.map((o) => (
                                    <tr key={o.paymentId}>
                                        <td className={`${classeTd} num`}>{o.installmentNumber ?? "—"}</td>
                                        <td className={classeTd}><Selo tom={tomPagamento(o.status)}>{situacaoPagamento(o.status)}</Selo></td>
                                        <td className={`${classeTd} num text-right`}>{formatarCentavos(o.valueCentavos)}</td>
                                        <td className={classeTd}>{dataOuNaoInformado(o.observedAt)}</td>
                                        <td className={classeTd}>
                                            <details>
                                                <summary className="min-h-9 cursor-pointer py-1.5 text-xs font-medium">Ver códigos</summary>
                                                <div className="grid gap-1.5 pb-1">
                                                    <Codigo rotulo="ID da cobrança" texto={o.paymentId} />
                                                    <Codigo rotulo="Fatura" texto={o.invoiceNumber} />
                                                    <p className="text-xs text-sutil">Último evento: {situacaoPagamento(o.lastEvent)}</p>
                                                    <Codigo rotulo="ID do último evento" texto={o.lastEventId} />
                                                </div>
                                            </details>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </TabelaRolavel>
                    )}

                    {plano.refundsByPayment.length > 0 && (
                        <>
                            <h5 className="mt-4 text-sm font-semibold">Estornos por cobrança</h5>
                            <ul className="mt-2 grid gap-2">
                                {plano.refundsByPayment.map((r) => (
                                    <li key={r.paymentId} className="rounded-lg bg-cartao/80 p-3 text-sm">
                                        <p className="font-semibold">Concluído: <span className="num">{formatarCentavos(r.refundsSnapshot.totalDoneCentavos)}</span></p>
                                        <p className="text-xs text-sutil">
                                            {r.refundsSnapshot.items.length} registro(s) · consultado em {dataOuNaoInformado(r.refundsSnapshot.capturedAt)}
                                        </p>
                                        <Codigo rotulo="ID da cobrança" texto={r.paymentId} />
                                        <Estornos snapshot={r.refundsSnapshot} />
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            )}

            {(payment.refundStatus || payment.refundsSnapshot) && (
                <section className="rounded-xl border border-alerta/20 bg-alerta-fundo p-4 text-alerta" aria-label="Estorno">
                    <h4 className="font-semibold">Estorno: {situacaoEstorno(payment.refundStatus)}</h4>
                    {payment.refundsSnapshot && (
                        <>
                            <p className="mt-1 text-sm">Total concluído: <span className="num font-semibold">{formatarCentavos(payment.refundsSnapshot.totalDoneCentavos)}</span></p>
                            <p className="text-xs">Consultado em {dataOuNaoInformado(payment.refundsSnapshot.capturedAt)}</p>
                            <div className="text-tinta"><Estornos snapshot={payment.refundsSnapshot} /></div>
                        </>
                    )}
                </section>
            )}

            {payment.webhookIssues.length > 0 && (
                <section className="rounded-xl border border-alerta/20 bg-alerta-fundo p-4" aria-label="Eventos que exigem atenção">
                    <h4 className="font-semibold text-alerta">Eventos do Asaas que exigem atenção</h4>
                    <p className="mt-0.5 text-xs text-alerta">Só metadados operacionais seguros são exibidos.</p>
                    <ul className="mt-3 grid gap-2">
                        {payment.webhookIssues.map((issue) => (
                            <li key={issue.eventId} className="rounded-lg bg-cartao/80 p-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <strong>{situacaoFalha(issue.status)} · {situacaoPagamento(issue.eventType)}</strong>
                                    <span className="text-xs text-sutil">{issue.attempts} tentativa(s)</span>
                                </div>
                                <p className="mt-1 text-xs text-sutil">Recebido em {dataOuNaoInformado(issue.receivedAt)}</p>
                                <details className="mt-1">
                                    <summary className="min-h-9 cursor-pointer py-1.5 text-xs font-medium">Ver códigos</summary>
                                    <div className="grid gap-1.5 pb-1">
                                        <Codigo rotulo="Motivo técnico" texto={issue.reason} />
                                        <Codigo rotulo="ID do evento" texto={issue.eventId} />
                                        {issue.installmentId && <Codigo rotulo="ID do parcelamento" texto={issue.installmentId} />}
                                    </div>
                                </details>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <Tecnico>
                <Codigo rotulo="ID da compra" texto={payment.compraId} />
                <Codigo rotulo="ID da cobrança" texto={payment.paymentId} />
                <Codigo rotulo="ID do checkout" texto={payment.checkoutId} />
                <Codigo rotulo="Fatura" texto={payment.invoiceNumber} />
                <Codigo rotulo="Edição" texto={payment.edicaoId} />
                {payment.remoteAccessId && <Codigo rotulo="ID do acesso remoto" texto={payment.remoteAccessId} />}
                {plano && <Codigo rotulo="ID do parcelamento" texto={plano.installmentId} />}
            </Tecnico>
        </article>
    )
}
