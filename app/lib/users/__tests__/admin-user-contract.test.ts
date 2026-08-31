import assert from "node:assert/strict"
import test from "node:test"
import {
    adminDateToIso,
    adminUserCreationDay,
    filterAdminUsers,
    normalizeAdminUserDetails,
    normalizeAdminUserSummary,
    parseAdminUserDetailsPayload,
    parseAdminUserListHttpResponse,
    parseAdminUserListPayload,
} from "../admin-user-contract.ts"
import {
    parseDataArrayPayload,
    parseDataObjectPayload,
    parseStringArrayDataPayload,
} from "../../api-data-contract.ts"

const FULL_USER = {
    _id: "66bbc8c2db29318201acc2a1",
    id_api: "cus_123",
    isPos_registration: true,
    informacoes_usuario: {
        cpf: "12345678900",
        numero_telefone: "34999999999",
        nome: "Ada Lovelace",
        email: "ada@example.com",
        data_criacao: new Date("2026-08-31T12:30:00.000Z"),
        titulo_honorario: "Dra.",
    },
    pagamento: {
        situacao: 1,
        situacao_animacao: true,
        tipo_pagamento: "PIX",
        lista_pagamentos: [{ _id: "legacy-payment" }],
    },
}

test("normaliza perfil completo, ObjectId e data BSON/ISO", () => {
    const user = normalizeAdminUserSummary({
        ...FULL_USER,
        _id: { toHexString: () => FULL_USER._id },
    })

    assert.ok(user)
    assert.equal(user._id, FULL_USER._id)
    assert.equal(user.informacoes_usuario.data_criacao, "2026-08-31T12:30:00.000Z")
    assert.equal(user.pagamento.situacao, 1)
    assert.equal(user.cadastroPendente, false)
})

test("mantém usuário com perfil e pagamento ausentes como cadastro pendente", () => {
    const user = normalizeAdminUserDetails({ _id: FULL_USER._id })

    assert.ok(user)
    assert.deepEqual(user.informacoes_usuario, {
        cpf: null,
        numero_telefone: null,
        nome: null,
        email: null,
        data_criacao: null,
        titulo_honorario: null,
    })
    assert.deepEqual(user.pagamento, {
        situacao: null,
        situacao_animacao: false,
        tipo_pagamento: null,
        lista_pagamentos: [],
    })
    assert.equal(user.cadastroPendente, true)
})

test("rejeita objeto ausente ou sem identificador", () => {
    assert.equal(normalizeAdminUserSummary(undefined), null)
    assert.equal(normalizeAdminUserSummary(null), null)
    assert.equal(normalizeAdminUserSummary({}), null)
})

test("rejeita tipos incorretos sem fabricar status ou campos pessoais", () => {
    const user = normalizeAdminUserSummary({
        _id: FULL_USER._id,
        id_api: 123,
        informacoes_usuario: {
            nome: 42,
            email: {},
            cpf: false,
            numero_telefone: [],
            data_criacao: { $date: "2026-08-31T12:30:00.000Z" },
        },
        pagamento: { situacao: 9, tipo_pagamento: 10 },
    })

    assert.ok(user)
    assert.equal(user.id_api, null)
    assert.equal(user.informacoes_usuario.nome, null)
    assert.equal(user.informacoes_usuario.data_criacao, null)
    assert.equal(user.pagamento.situacao, null)
    assert.equal(user.pagamento.tipo_pagamento, null)
})

test("datas nulas, vazias, inválidas, objetos e números nunca viram 1970", () => {
    const invalidValues = [undefined, null, "", "   ", "not-a-date", {}, 0]
    for (const value of invalidValues) {
        assert.equal(adminDateToIso(value), null)
    }
    assert.equal(adminDateToIso("2026-08-31T12:30:00.000Z"), "2026-08-31T12:30:00.000Z")
    assert.equal(adminUserCreationDay(null), null)
})

test("parsers rejeitam erro HTTP, envelope ausente, lista não-array e linha sem ID", () => {
    assert.equal(parseAdminUserListHttpResponse(false, { data: [FULL_USER] }), null)
    assert.equal(parseAdminUserListPayload({ message: "erro" }), null)
    assert.equal(parseAdminUserListPayload({}), null)
    assert.equal(parseAdminUserListPayload({ data: {} }), null)
    assert.equal(parseAdminUserListPayload({ data: [{}] }), null)
    assert.equal(parseAdminUserDetailsPayload({ message: "erro" }), null)
})

test("lista legada malformada vira lista vazia", () => {
    const user = normalizeAdminUserDetails({
        ...FULL_USER,
        pagamento: {
            ...FULL_USER.pagamento,
            lista_pagamentos: [{ _id: "legacy-payment" }],
        },
    })

    assert.ok(user)
    assert.deepEqual(user.pagamento.lista_pagamentos, [])
})

test("envelopes auxiliares exigem objeto e arrays somente de strings", () => {
    assert.deepEqual(parseStringArrayDataPayload({ data: ["a", "b"] }), ["a", "b"])
    assert.equal(parseStringArrayDataPayload({ data: ["a", null] }), null)
    assert.equal(parseStringArrayDataPayload({ message: "erro" }), null)
    assert.deepEqual(parseDataObjectPayload({ data: { name: "Evento" } }), { name: "Evento" })
    assert.equal(parseDataObjectPayload({ data: [] }), null)
    const hasName = (item: unknown): item is { name: string } => (
        typeof item === "object" && item !== null && "name" in item &&
        typeof item.name === "string"
    )
    assert.deepEqual(parseDataArrayPayload({ data: [{ name: "Evento" }] }, hasName), [{ name: "Evento" }])
    assert.equal(parseDataArrayPayload({ data: [{ name: null }] }, hasName), null)
})

test("filtros toleram campos nulos e preservam sem data apenas sem intervalo", () => {
    const full = normalizeAdminUserSummary(FULL_USER)
    const partial = normalizeAdminUserSummary({
        _id: "66bbc8c2db29318201acc2a2",
        informacoes_usuario: {},
        pagamento: { situacao: 1 },
    })
    assert.ok(full && partial)

    assert.equal(filterAdminUsers([full, partial], {}).length, 2)
    assert.deepEqual(
        filterAdminUsers([full, partial], { startDate: "2026-08-01" }).map((user) => user._id),
        [full._id],
    )
    assert.deepEqual(
        filterAdminUsers([full, partial], { searchTerm: "ADA", selectedStatus: "1" }).map((user) => user._id),
        [full._id],
    )
    assert.equal(filterAdminUsers([partial], { searchTerm: "inexistente" }).length, 0)
})
