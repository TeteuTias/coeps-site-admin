import assert from "node:assert/strict"
import test from "node:test"
import { formatActivitySchedule, formatExtraSchedules } from "../activity-schedule.ts"

test("formata data e horário no fuso de São Paulo", () => {
    const result = formatActivitySchedule([
        { date_init: "2026-11-14T08:00:00-03:00", date_end: "2026-11-14T12:00:00-03:00", local: "Auditório 1", local_description: "Bloco A" },
    ])
    assert.equal(result.when, "14/11 · 08:00–12:00")
    assert.equal(result.where, "Auditório 1")
    assert.equal(result.extra, 0)
})

test("converte instantes UTC para o horário de Brasília", () => {
    const result = formatActivitySchedule([{ date_init: "2026-11-14T11:00:00.000Z", date_end: "2026-11-14T15:30:00.000Z" }])
    assert.equal(result.when, "14/11 · 08:00–12:30")
})

test("usa local_description quando não há local e conta horários extras", () => {
    const result = formatActivitySchedule([
        { date_init: "2026-11-14T08:00:00-03:00", date_end: "2026-11-14T10:00:00-03:00", local: " ", local_description: "Sala 3" },
        { date_init: "2026-11-15T08:00:00-03:00", date_end: "2026-11-15T10:00:00-03:00" },
        { date_init: "2026-11-16T08:00:00-03:00", date_end: "2026-11-16T10:00:00-03:00" },
    ])
    assert.equal(result.where, "Sala 3")
    assert.equal(result.extra, 2)
    assert.equal(formatExtraSchedules(1), "+ 1 outro horário")
    assert.equal(formatExtraSchedules(2), "+ 2 outros horários")
})

test("timeline ausente, vazia ou inválida não quebra", () => {
    for (const value of [undefined, null, "x", {}, [], [null], [{ date_init: "lixo" }]]) {
        const result = formatActivitySchedule(value)
        assert.equal(result.when, "Data e horário a confirmar")
        assert.equal(result.extra, 0)
    }
})

test("sem data final mostra só o início", () => {
    assert.equal(formatActivitySchedule([{ date_init: "2026-11-14T08:00:00-03:00" }]).when, "14/11 · 08:00")
})
