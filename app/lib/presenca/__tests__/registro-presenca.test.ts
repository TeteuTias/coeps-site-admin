import assert from "node:assert/strict"
import test from "node:test"
import type { Db } from "mongodb"
import { gravarPresenca, lerPedidoPresenca } from "../registro-presenca.ts"

const EV = "6696b5adf287f4a45ed8f000"
const U1 = "6696b5adf287f4a45ed8f001"
const FANTASMA = "6696b5adf287f4a45ed8f0ff"

/** Banco falso: guarda as operações recebidas e aplica $addToSet/$pull como o Mongo (por campo, sem ler o documento). */
function bancoFalso() {
    const ops: { colecao: string; filtro: unknown; update: Record<string, Record<string, string>> }[] = []
    const docs: Record<string, Record<string, string[]>> = { [EV]: { participants: [], attendanceList: [], attendanceListInit: [], attendanceListEnd: [] } }
    const usuarios = new Set([U1])
    const db = {
        collection(nome: string) {
            return {
                async findOne(filtro: { _id: { toHexString(): string } }) {
                    return nome === "usuarios" && usuarios.has(filtro._id.toHexString()) ? { _id: filtro._id } : null
                },
                async updateOne(filtro: { _id: { toHexString(): string } }, update: Record<string, Record<string, string>>) {
                    ops.push({ colecao: nome, filtro, update })
                    const doc = docs[filtro._id.toHexString()]
                    if (!doc) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
                    let mudou = false
                    for (const [campo, id] of Object.entries(update.$addToSet ?? {})) if (!doc[campo].includes(id)) { doc[campo].push(id); mudou = true }
                    for (const [campo, id] of Object.entries(update.$pull ?? {})) if (doc[campo].includes(id)) { doc[campo] = doc[campo].filter((x) => x !== id); mudou = true }
                    return { acknowledged: true, matchedCount: 1, modifiedCount: mudou ? 1 : 0 }
                },
            }
        },
    }
    return { db: db as unknown as Db, ops, docs }
}

test("lerPedidoPresenca recusa corpo, atividade, credencial e turno inválidos com 400", () => {
    for (const corpo of [null, "x", {}, { eventId: "abc", userId: U1 }, { eventId: EV, userId: "https://x" }, { eventId: EV }]) {
        const r = lerPedidoPresenca(corpo, false)
        assert.ok("falha" in r && r.falha.status === 400, JSON.stringify(corpo))
    }
    const semTurno = lerPedidoPresenca({ eventId: EV, userId: U1 }, true)
    assert.ok("falha" in semTurno && semTurno.falha.corpo.error === "turno_invalido")
    const ok = lerPedidoPresenca({ eventId: EV, userId: ` ${U1.toUpperCase()} `, listType: "end" }, true)
    assert.deepEqual(ok, { pedido: { eventId: EV, userId: U1, listType: "end" } })
})

test("dar presença usa $addToSet só no id lido (nunca regrava a lista inteira) e é idempotente", async () => {
    const { db, ops, docs } = bancoFalso()
    const primeira = await gravarPresenca(db, "minicursos", "dar", { eventId: EV, userId: U1 })
    const repetida = await gravarPresenca(db, "minicursos", "dar", { eventId: EV, userId: U1 })
    assert.equal(primeira.status, 200)
    assert.deepEqual((primeira.corpo.data as { modifiedCount: number }).modifiedCount, 1)
    assert.deepEqual((repetida.corpo.data as { modifiedCount: number }).modifiedCount, 0)
    assert.deepEqual(ops[0].update, { $addToSet: { attendanceList: U1, participants: U1 } })
    assert.deepEqual(docs[EV].attendanceList, [U1])
    assert.deepEqual(docs[EV].participants, [U1])
})

test("palestra grava na lista do turno; retirar usa $pull", async () => {
    const { db, ops, docs } = bancoFalso()
    await gravarPresenca(db, "palestras", "dar", { eventId: EV, userId: U1, listType: "init" })
    await gravarPresenca(db, "palestras", "dar", { eventId: EV, userId: U1, listType: "end" })
    await gravarPresenca(db, "palestras", "retirar", { eventId: EV, userId: U1, listType: "init" })
    assert.deepEqual(ops.map((o) => o.update), [
        { $addToSet: { attendanceListInit: U1 } },
        { $addToSet: { attendanceListEnd: U1 } },
        { $pull: { attendanceListInit: U1 } },
    ])
    assert.deepEqual(docs[EV].attendanceListInit, [])
    assert.deepEqual(docs[EV].attendanceListEnd, [U1])
})

test("credencial sem cadastro não entra na lista (404) e atividade inexistente volta matchedCount 0", async () => {
    const { db, ops } = bancoFalso()
    const r = await gravarPresenca(db, "palestras", "dar", { eventId: EV, userId: FANTASMA, listType: "init" })
    assert.equal(r.status, 404)
    assert.equal(ops.length, 0)
    const outra = await gravarPresenca(db, "minicursos", "dar", { eventId: FANTASMA, userId: U1 })
    assert.equal((outra.corpo.data as { matchedCount: number }).matchedCount, 0)
})
