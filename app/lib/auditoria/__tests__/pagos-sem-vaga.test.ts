import test from "node:test";
import assert from "node:assert/strict";
import { dataDoObjectId, encontrarPagosSemVaga, mascararEmail } from "../pagos-sem-vaga.ts";

const U1 = "6a0000000000000000000001";
const U2 = "6a0000000000000000000002";
const U3 = "6a0000000000000000000003";
const M1 = "6b0000000000000000000001";
const ETAPA = "6b0000000000000000000002";

// ObjectId com a data embutida: 12/11/2026 15:00 UTC
const nSerieDepois = Math.floor(Date.parse("2026-11-12T15:00:00Z") / 1000).toString(16).padStart(8, "0") + "0000000000000000";

const minicurso = (extra: Record<string, unknown> = {}) => ({
    _id: M1, name: "Sutura", isFree: false, maxParticipants: 30, participants: [U2], attendanceList: [],
    timeline: [{ date_init: "2026-11-20T08:00:00-03:00" }], _nSerie: nSerieDepois, ...extra,
});
const pago = (userId: string, id: string, eventId = M1) => ({
    _type: "activity", _eventID: eventId, _userId: userId, id, value: 50, status: "PAYMENT_RECEIVED", lastWebhookAt: new Date("2026-11-10T13:00:00Z"),
});
const usuario = (id: string, nome: string, pagamentos: unknown[]) => ({
    _id: id, informacoes_usuario: { nome, email: `${nome.toLowerCase()}@x.com` }, pagamento: { lista_pagamentos: pagamentos },
});

test("data do ObjectId", () => {
    assert.equal(dataDoObjectId(nSerieDepois)?.toISOString(), "2026-11-12T15:00:00.000Z");
    assert.equal(dataDoObjectId("abc"), null);
});

test("pagou e saiu da lista depois de uma edição do minicurso", () => {
    const r = encontrarPagosSemVaga({
        minicursos: [minicurso()],
        usuarios: [usuario(U1, "Ana", [pago(U1, "pay_1")]), usuario(U2, "Bia", [pago(U2, "pay_2")])],
        agora: new Date("2026-11-13T12:00:00Z"),
    });
    assert.equal(r.linhas.length, 1, "Bia está inscrita, só Ana aparece");
    const [l] = r.linhas;
    assert.equal(l.nome, "Ana");
    assert.equal(l.causa, "lista_apagada_ao_editar_minicurso");
    assert.equal(l.sumiuEm, "2026-11-12T15:00:00.000Z");
    assert.equal(l.vagasLivres, 29);
    assert.equal(l.minicursoJaComecou, false);
    assert.equal(r.minicursos[0].pagosSemVaga, 1);
    assert.equal(r.minicursos[0].cobrancasPagas, 2);
});

test("cancelado sem estorno pelo admin tem prioridade e traz a conta", () => {
    const r = encontrarPagosSemVaga({
        minicursos: [minicurso({ cancelamentosSemEstorno: [{ userId: U1, cobrancas: ["pay_1"], canceladoEm: new Date("2026-11-12T18:00:00Z"), canceladoPor: "6a8799078ecd649be9bdb061" }] })],
        usuarios: [usuario(U1, "Ana", [pago(U1, "pay_1")])],
    });
    assert.equal(r.linhas[0].causa, "cancelado_sem_estorno_pelo_admin");
    assert.match(r.linhas[0].detalheCausa, /6a8799078ecd649be9bdb061/);
});

test("data do pagamento vem do ledger de webhooks; webhook de exclusão vira a causa", () => {
    const r = encontrarPagosSemVaga({
        minicursos: [minicurso({ _nSerie: "nao-e-objectid" })],
        usuarios: [usuario(U1, "Ana", [pago(U1, "pay_1")])],
        eventos: [
            { eventType: "PAYMENT_RECEIVED", paymentId: "pay_1", receivedAt: new Date("2026-11-09T10:00:00Z"), payload: { payment: { paymentDate: "2026-11-09", clientPaymentDate: "2026-11-09" } } },
            { eventType: "PAYMENT_REFUNDED", paymentId: "pay_1", receivedAt: new Date("2026-11-11T10:00:00Z") },
        ],
    });
    assert.equal(r.linhas[0].pagoEm, "2026-11-09T03:00:00.000Z");
    assert.equal(r.linhas[0].causa, "cobranca_excluida_ou_estornada");
});

test("pacote: principal ok mas falta a etapa", () => {
    const r = encontrarPagosSemVaga({
        minicursos: [
            minicurso({ participants: [U3], incluiAtividades: [ETAPA], _nSerie: undefined }),
            { _id: ETAPA, name: "Teórica", isFree: false, participants: [], somenteViaPacote: true, maxParticipants: 30 },
        ],
        usuarios: [usuario(U3, "Caio", [pago(U3, "pay_3")])],
    });
    assert.equal(r.linhas.length, 1);
    assert.equal(r.linhas[0].etapaFaltando, "Teórica");
});

test("cobrança não paga ou de outro tipo não entra", () => {
    const r = encontrarPagosSemVaga({
        minicursos: [minicurso()],
        usuarios: [usuario(U1, "Ana", [{ ...pago(U1, "p"), status: "PENDING" }, { ...pago(U1, "t"), _type: "ticket" }])],
    });
    assert.equal(r.linhas.length, 0);
});

test("e-mail mascarado", () => {
    assert.equal(mascararEmail("fulano@gmail.com"), "fu***@gmail.com");
});
