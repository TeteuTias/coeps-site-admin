// Quem pagou um minicurso e não está mais na lista de inscritos dele.
// Só leitura: recebe os documentos já lidos do banco e devolve o relatório. Não grava nada.
//
// Pistas de "como sumiu", da mais forte para a mais fraca:
//  1. cancelamentosSemEstorno do minicurso tem a pessoa → o admin cancelou sem estorno (data e conta).
//  2. Evento PAYMENT_DELETED/REFUNDED no ledger de webhooks depois do pagamento → saiu pelo webhook.
//  3. _nSerie do minicurso é um ObjectId criado DEPOIS do pagamento → a tela "Configurar atividade"
//     (rota alterarInformacoes, até o PR #50) gravou participants: [] nessa data.
//  4. Nenhuma das anteriores → desconhecida.

export const STATUS_PAGO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

export interface MinicursoLido {
    _id: unknown;
    name?: unknown;
    value?: unknown;
    isFree?: unknown;
    maxParticipants?: unknown;
    participants?: unknown;
    attendanceList?: unknown;
    incluiAtividades?: unknown;
    somenteViaPacote?: unknown;
    timeline?: unknown;
    _nSerie?: unknown;
    cancelamentosSemEstorno?: unknown;
}

export interface UsuarioLido {
    _id: unknown;
    informacoes_usuario?: { nome?: unknown; email?: unknown; telefone?: unknown } | null;
    pagamento?: { lista_pagamentos?: unknown } | null;
}

/** Evento do ledger pagamentos.webhook_eventos_v2 (só os campos usados). */
export interface EventoWebhookLido {
    eventType?: unknown;
    paymentId?: unknown;
    receivedAt?: unknown;
    payload?: { payment?: Record<string, unknown> } | null;
}

export type CausaProvavel =
    | "cancelado_sem_estorno_pelo_admin"
    | "cobranca_excluida_ou_estornada"
    | "lista_apagada_ao_editar_minicurso"
    | "desconhecida";

export interface LinhaPagoSemVaga {
    usuarioId: string;
    nome: string;
    email: string;
    minicursoId: string;
    minicurso: string;
    /** Etapa de pacote em que a pessoa falta (quando a principal está ok). */
    etapaFaltando: string | null;
    cobrancaId: string;
    valor: number | null;
    statusGravado: string;
    pagoEm: string | null;
    causa: CausaProvavel;
    sumiuEm: string | null;
    detalheCausa: string;
    vagasLivres: number | null;
    minicursoJaComecou: boolean | null;
}

export interface ResumoMinicurso {
    minicursoId: string;
    minicurso: string;
    inscritos: number;
    vagas: number | null;
    presencas: number;
    nSerieCriadoEm: string | null;
    cobrancasPagas: number;
    pagosSemVaga: number;
}

export interface RelatorioPagosSemVaga {
    geradoEm: string;
    linhas: LinhaPagoSemVaga[];
    minicursos: ResumoMinicurso[];
}

const texto = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Data embutida num ObjectId (24 hex). null se não for um. */
export function dataDoObjectId(valor: unknown): Date | null {
    const hex = texto(valor);
    if (!/^[0-9a-f]{24}$/i.test(hex)) return null;
    const segundos = parseInt(hex.slice(0, 8), 16);
    const data = new Date(segundos * 1000);
    return Number.isFinite(data.getTime()) ? data : null;
}

function iso(valor: unknown): string | null {
    if (valor instanceof Date) return Number.isFinite(valor.getTime()) ? valor.toISOString() : null;
    if (typeof valor !== "string" || !valor) return null;
    // "2026-11-10" (data do Asaas) vira meia-noite de Brasília
    const data = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00:00-03:00`) : new Date(valor);
    return Number.isFinite(data.getTime()) ? data.toISOString() : null;
}

function inicioDoMinicurso(m: MinicursoLido): Date | null {
    let primeiro: Date | null = null;
    for (const item of lista(m.timeline)) {
        const d = new Date(texto((item as { date_init?: unknown })?.date_init));
        if (!Number.isFinite(d.getTime())) continue;
        if (!primeiro || d < primeiro) primeiro = d;
    }
    return primeiro;
}

/** Melhor data de pagamento: ledger (paymentDate/clientPaymentDate/confirmedDate) > lastWebhookAt > criação. */
function dataDoPagamento(cobranca: Record<string, unknown>, eventos: EventoWebhookLido[]): string | null {
    const pagos = eventos
        .filter((e) => ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(texto(e.eventType)))
        .sort((a, b) => texto(iso(a.receivedAt)).localeCompare(texto(iso(b.receivedAt))));
    for (const evento of pagos) {
        const p = evento.payload?.payment ?? {};
        const quando = iso(p.clientPaymentDate) ?? iso(p.paymentDate) ?? iso(p.confirmedDate) ?? iso(evento.receivedAt);
        if (quando) return quando;
    }
    return iso(cobranca.paymentDate) ?? iso(cobranca.clientPaymentDate) ?? iso(cobranca.lastWebhookAt) ?? null;
}

export function encontrarPagosSemVaga(input: {
    minicursos: MinicursoLido[];
    usuarios: UsuarioLido[];
    eventos?: EventoWebhookLido[];
    agora?: Date;
}): RelatorioPagosSemVaga {
    const agora = input.agora ?? new Date();
    const porId = new Map(input.minicursos.map((m) => [texto(m._id), m]));
    const eventosPorCobranca = new Map<string, EventoWebhookLido[]>();
    for (const evento of input.eventos ?? []) {
        const id = texto(evento.paymentId) || texto(evento.payload?.payment?.id);
        if (!id) continue;
        eventosPorCobranca.set(id, [...(eventosPorCobranca.get(id) ?? []), evento]);
    }

    const linhas: LinhaPagoSemVaga[] = [];
    const pagasPorMinicurso = new Map<string, number>();

    for (const usuario of input.usuarios) {
        const usuarioId = texto(usuario._id);
        const cobrancas = lista(usuario.pagamento?.lista_pagamentos) as Record<string, unknown>[];
        // Uma linha por (pessoa, minicurso): fica a primeira cobrança paga.
        const vistos = new Set<string>();
        for (const cobranca of cobrancas) {
            if (cobranca?._type !== "activity" || !STATUS_PAGO.has(texto(cobranca.status))) continue;
            const minicursoId = texto(cobranca._eventID);
            if (vistos.has(minicursoId)) continue;
            vistos.add(minicursoId);
            pagasPorMinicurso.set(minicursoId, (pagasPorMinicurso.get(minicursoId) ?? 0) + 1);
            const minicurso = porId.get(minicursoId);
            if (!minicurso) continue; // atividade apagada: fora deste relatório

            const inscritos = new Set(lista(minicurso.participants).map(texto));
            const faltaNaPrincipal = !inscritos.has(usuarioId);
            let etapaFaltando: string | null = null;
            if (!faltaNaPrincipal) {
                for (const etapaId of lista(minicurso.incluiAtividades).map(texto)) {
                    const etapa = porId.get(etapaId);
                    if (etapa && !lista(etapa.participants).map(texto).includes(usuarioId)) {
                        etapaFaltando = texto(etapa.name) || etapaId;
                        break;
                    }
                }
                if (!etapaFaltando) continue; // está inscrito em tudo
            }

            const cobrancaId = texto(cobranca.id);
            const eventos = eventosPorCobranca.get(cobrancaId) ?? [];
            const pagoEm = dataDoPagamento(cobranca, eventos);
            const alvo = etapaFaltando ? lista(minicurso.incluiAtividades).map((id) => porId.get(texto(id))).find((e) => e && texto(e.name) === etapaFaltando) ?? minicurso : minicurso;

            let causa: CausaProvavel = "desconhecida";
            let sumiuEm: string | null = null;
            let detalheCausa = "Sem rastro no banco. Ver logs da Vercel do Admin e do site na data.";

            const cancelamento = lista(minicurso.cancelamentosSemEstorno)
                .map((c) => c as Record<string, unknown>)
                .find((c) => texto(c?.userId) === usuarioId);
            const saida = eventos.find((e) => ["PAYMENT_DELETED", "PAYMENT_REFUNDED"].includes(texto(e.eventType)));
            const nSerieEm = dataDoObjectId(alvo._nSerie);

            if (cancelamento) {
                causa = "cancelado_sem_estorno_pelo_admin";
                sumiuEm = iso(cancelamento.canceladoEm);
                detalheCausa = `Cancelado sem estorno no Admin pela conta ${texto(cancelamento.canceladoPor) || "?"}.`;
            } else if (saida) {
                causa = "cobranca_excluida_ou_estornada";
                sumiuEm = iso(saida.receivedAt);
                detalheCausa = `Webhook ${texto(saida.eventType)} recebido para esta cobrança.`;
            } else if (nSerieEm && (!pagoEm || nSerieEm.getTime() > new Date(pagoEm).getTime())) {
                causa = "lista_apagada_ao_editar_minicurso";
                sumiuEm = nSerieEm.toISOString();
                detalheCausa = `"${texto(alvo.name)}" foi editado em Configurar atividade nesta data; a edição gravava participants: [].`;
            }

            const max = typeof alvo.maxParticipants === "number" ? alvo.maxParticipants : null;
            const inicio = inicioDoMinicurso(minicurso);
            const valor = typeof cobranca.value === "number" ? cobranca.value : Number(cobranca.value);
            linhas.push({
                usuarioId,
                nome: texto(usuario.informacoes_usuario?.nome),
                email: texto(usuario.informacoes_usuario?.email),
                minicursoId,
                minicurso: texto(minicurso.name),
                etapaFaltando,
                cobrancaId,
                valor: Number.isFinite(valor) ? valor : null,
                statusGravado: texto(cobranca.status),
                pagoEm,
                causa,
                sumiuEm,
                detalheCausa,
                vagasLivres: max == null ? null : Math.max(0, max - lista(alvo.participants).length),
                minicursoJaComecou: inicio ? inicio.getTime() <= agora.getTime() : null,
            });
        }
    }

    const semVagaPorMinicurso = new Map<string, number>();
    for (const l of linhas) semVagaPorMinicurso.set(l.minicursoId, (semVagaPorMinicurso.get(l.minicursoId) ?? 0) + 1);

    const minicursos: ResumoMinicurso[] = input.minicursos
        .filter((m) => !(m.isFree === true || m.isFree === 1))
        .map((m) => {
            const id = texto(m._id);
            const nSerie = dataDoObjectId(m._nSerie);
            return {
                minicursoId: id,
                minicurso: texto(m.name),
                inscritos: lista(m.participants).length,
                vagas: typeof m.maxParticipants === "number" ? m.maxParticipants : null,
                presencas: lista(m.attendanceList).length,
                nSerieCriadoEm: nSerie ? nSerie.toISOString() : null,
                cobrancasPagas: pagasPorMinicurso.get(id) ?? 0,
                pagosSemVaga: semVagaPorMinicurso.get(id) ?? 0,
            };
        })
        .sort((a, b) => b.pagosSemVaga - a.pagosSemVaga || a.minicurso.localeCompare(b.minicurso));

    linhas.sort((a, b) => a.minicurso.localeCompare(b.minicurso) || a.nome.localeCompare(b.nome));
    return { geradoEm: agora.toISOString(), linhas, minicursos };
}

/** E-mail parcialmente escondido, para mostrar em chat. */
export function mascararEmail(email: string): string {
    const [nome, dominio] = email.split("@");
    if (!dominio) return email ? `${email.slice(0, 2)}***` : "";
    return `${nome.slice(0, 2)}***@${dominio}`;
}
