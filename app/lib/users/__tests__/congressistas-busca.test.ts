import assert from "node:assert/strict"
import test from "node:test"
import { buildCongressistasMongoFilter, escapeRegex, parseCongressistasBuscaParams } from "../congressistas-busca.ts"

const parse = (query: string) => parseCongressistasBuscaParams(new URLSearchParams(query))

test("escapa caracteres especiais de regex", () => {
    assert.equal(escapeRegex("(a+)+$"), "\\(a\\+\\)\\+\\$")
    const filter = buildCongressistasMongoFilter({ q: ".*", status: "", paymentType: "" }) as { $or: { [k: string]: { $regex: string } }[] }
    assert.equal(filter.$or[0]["informacoes_usuario.nome"].$regex, "\\.\\*")
})

test("exige 4 letras quando não há outro filtro", () => {
    assert.equal(parse("q=abc").ok, false)
    assert.equal(parse("").ok, false)
    assert.equal(parse("q=%20%20abc%20").ok, false)
    const ok = parse("q=%20mari%20")
    assert.ok(ok.ok && ok.value.q === "mari" && ok.value.page === 1)
})

test("outro filtro dispensa o mínimo de letras", () => {
    assert.equal(parse("status=1").ok, true)
    assert.equal(parse("q=ab&paymentType=PIX").ok, true)
    assert.equal(parse("startDate=2026-11-01").ok, true)
})

test("rejeita status, modalidade, data e q fora do contrato", () => {
    assert.equal(parse("status=4&q=abcd").ok, false)
    assert.equal(parse("status=x&q=abcd").ok, false)
    assert.equal(parse("mode=OUTRO&q=abcd").ok, false)
    assert.equal(parse("startDate=11/2026&q=abcd").ok, false)
    assert.equal(parse(`q=${"a".repeat(81)}`).ok, false)
    assert.equal(parse(`q=${"a".repeat(80)}`).ok, true)
})

test("valida a página", () => {
    for (const page of ["0", "-1", "1.5", "abc", "99999999999999999999"]) {
        assert.equal(parse(`q=abcd&page=${page}`).ok, false, page)
    }
    const ok = parse("q=abcd&page=3")
    assert.ok(ok.ok && ok.value.page === 3)
})

test("monta o filtro Mongo combinando busca, status e tipo", () => {
    assert.deepEqual(buildCongressistasMongoFilter({ q: "", status: "", paymentType: "" }), {})
    assert.deepEqual(buildCongressistasMongoFilter({ q: "", status: "0", paymentType: "" }), { "pagamento.situacao": 0 })
    const combined = buildCongressistasMongoFilter({ q: "ana", status: "1", paymentType: "PIX" }) as { $and: unknown[] }
    assert.equal(combined.$and.length, 3)
})
