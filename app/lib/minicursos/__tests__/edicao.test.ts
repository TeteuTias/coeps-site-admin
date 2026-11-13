import test from "node:test";
import assert from "node:assert/strict";
import { camposEditaveisMinicurso, formatarDataComFuso } from "../edicao.ts";

const formulario = {
    _id: "6af1d3cf857c1e368ecd01d7",
    showToUser: true,
    name: "APH Tático",
    description: "desc",
    maxParticipants: 40,
    participantsCount: 0,
    participants: [],
    attendanceList: [],
    cancelamentosSemEstorno: [],
    _nSerie: "x",
    isFree: false,
    timeline: [{ name: "Dia 1", date_init: "2026-11-14T08:00:00", date_end: "2026-11-14T12:00:00", local: "Sala 1" }],
    isOpen: true,
    dateOpen: "2026-11-01T08:00:00",
    type: "MINICURSO",
    organization_name: "CIEPS",
    emoji: "🚑",
    value: 50,
};

test("edição nunca grava inscritos, presença, contagem, cancelamentos nem _nSerie", () => {
    const set = camposEditaveisMinicurso(formulario) as unknown as Record<string, unknown>;
    for (const campo of ["participants", "participantsCount", "attendanceList", "cancelamentosSemEstorno", "_nSerie", "_id"]) {
        assert.equal(campo in set, false, `${campo} não pode estar no $set`);
    }
});

test("edição mantém os campos editáveis e põe o fuso de Brasília", () => {
    const set = camposEditaveisMinicurso(formulario);
    assert.equal(set.name, "APH Tático");
    assert.equal(set.value, 50);
    assert.equal(set.maxParticipants, 40);
    assert.equal(set.dateOpen, "2026-11-01T08:00:00-03:00");
    assert.equal(set.timeline[0].date_init, "2026-11-14T08:00:00-03:00");
    assert.equal(set.timeline[0].local, "Sala 1");
});

test("data fora do formato é recusada", () => {
    assert.throws(() => formatarDataComFuso("14/11/2026"));
});
