import assert from "node:assert/strict"
import test from "node:test"
import {
    WORK_EMAIL_LIMITS,
    buildWorkEmailMessage,
    buildWorkEmailMessages,
    chunkWorkIds,
    countUniqueEmails,
    parseWorkEmailRequest,
    resolveWorkRecipients,
} from "../work-email.ts"

const WORK_ID = "66bbc8c2db29318201acc2b1"

const WORK = {
    id: WORK_ID,
    titulo: "Efeitos de <b>X</b> & Y",
    modalidade: "Resumo simples",
    status: "Em Avaliação",
    remetente: { nome: "Ana Souza", email: "Ana@Example.com " },
    autores: [
        { nome: "Ana S.", email: "ana@example.com" },
        { nome: "Bruno Lima", email: "bruno@example.com" },
        { nome: "Sem Email", email: "" },
        { nome: "Inválido", email: "nao-e-email" },
    ],
}

const VALID_PAYLOAD = {
    assunto: "Resultado",
    corpoHtml: "<p>Olá {{nome}}</p>",
    trabalhoIds: [WORK_ID],
    destinatarios: { remetente: true, autores: false },
}

test("resolve destinatários sem repetir e-mail e descarta inválidos", () => {
    const recipients = resolveWorkRecipients(WORK, { remetente: true, autores: true })

    assert.deepEqual(recipients, [
        { trabalhoId: WORK_ID, email: "ana@example.com", nome: "Ana Souza" },
        { trabalhoId: WORK_ID, email: "bruno@example.com", nome: "Bruno Lima" },
    ])
})

test("respeita o público escolhido", () => {
    assert.deepEqual(
        resolveWorkRecipients(WORK, { remetente: true, autores: false }).map(r => r.email),
        ["ana@example.com"],
    )
    assert.deepEqual(
        resolveWorkRecipients(WORK, { remetente: false, autores: true }).map(r => r.nome),
        ["Ana S.", "Bruno Lima"],
    )
    assert.deepEqual(resolveWorkRecipients(WORK, { remetente: false, autores: false }), [])
    assert.deepEqual(
        resolveWorkRecipients({ ...WORK, remetente: null, autores: "x" }, { remetente: true, autores: true }),
        [],
    )
})

test("filtro de e-mails só restringe, nunca adiciona endereços", () => {
    const recipients = resolveWorkRecipients(
        WORK,
        { remetente: true, autores: true },
        ["bruno@example.com", "intruso@example.com"],
    )

    assert.deepEqual(recipients.map(r => r.email), ["bruno@example.com"])
})

test("conta e-mails únicos entre trabalhos", () => {
    const other = { ...WORK, id: "66bbc8c2db29318201acc2b2" }
    const recipients = [WORK, other].flatMap(work =>
        resolveWorkRecipients(work, { remetente: true, autores: true }),
    )

    assert.equal(recipients.length, 4)
    assert.equal(countUniqueEmails(recipients), 2)
})

test("substitui variáveis escapando HTML só no corpo", () => {
    const message = buildWorkEmailMessage(
        WORK,
        { email: "ana@example.com", nome: "Ana <script>" },
        "Trabalho {{ titulo }} - {{STATUS}}",
        "<p>Olá {{nome}}, seu trabalho {{titulo}} ({{modalidade}}) {{desconhecida}}</p>",
    )

    assert.equal(message.para, "ana@example.com")
    assert.equal(message.assunto, "Trabalho Efeitos de <b>X</b> & Y - Em Avaliação")
    assert.equal(
        message.corpoHtml,
        "<p>Olá Ana &lt;script&gt;, seu trabalho Efeitos de &lt;b&gt;X&lt;/b&gt; &amp; Y (Resumo simples) {{desconhecida}}</p>",
    )
})

test("usa tratamento genérico quando o destinatário não tem nome", () => {
    const message = buildWorkEmailMessage(WORK, { email: "x@example.com", nome: "" }, "a", "Olá {{nome}}")
    assert.equal(message.corpoHtml, "Olá participante")
})

test("monta uma mensagem por trabalho e destinatário", () => {
    const messages = buildWorkEmailMessages([WORK, { ...WORK, id: "66bbc8c2db29318201acc2b2" }], {
        assunto: "Aviso",
        corpoHtml: "<p>{{titulo}}</p>",
        destinatarios: { remetente: true, autores: true },
        somenteEmails: null,
    })

    assert.equal(messages.length, 4)
    assert.deepEqual(
        messages.map(m => `${m.trabalhoId}:${m.para}`),
        [
            `${WORK_ID}:ana@example.com`,
            `${WORK_ID}:bruno@example.com`,
            "66bbc8c2db29318201acc2b2:ana@example.com",
            "66bbc8c2db29318201acc2b2:bruno@example.com",
        ],
    )
})

test("aceita payload válido e normaliza os campos", () => {
    const result = parseWorkEmailRequest({
        ...VALID_PAYLOAD,
        assunto: "  Resultado\nfinal ",
        trabalhoIds: [WORK_ID, WORK_ID.toUpperCase()],
        somenteEmails: ["ANA@example.com"],
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.request.assunto, "Resultado final")
    assert.deepEqual(result.request.trabalhoIds, [WORK_ID])
    assert.deepEqual(result.request.somenteEmails, ["ana@example.com"])
    assert.equal(result.request.teste, false)
})

test("rejeita payloads inválidos", () => {
    const cases: Array<[unknown, string]> = [
        [null, "invalid_payload"],
        [{ ...VALID_PAYLOAD, assunto: " " }, "invalid_subject"],
        [{ ...VALID_PAYLOAD, assunto: "a".repeat(WORK_EMAIL_LIMITS.subjectLength + 1) }, "invalid_subject"],
        [{ ...VALID_PAYLOAD, corpoHtml: "<p><br></p>" }, "invalid_body"],
        [{ ...VALID_PAYLOAD, corpoHtml: "a".repeat(WORK_EMAIL_LIMITS.bodyBytes + 1) }, "invalid_body"],
        [{ ...VALID_PAYLOAD, trabalhoIds: [] }, "invalid_works"],
        [{ ...VALID_PAYLOAD, trabalhoIds: ["abc"] }, "invalid_works"],
        [{ ...VALID_PAYLOAD, trabalhoIds: [{ $ne: null }] }, "invalid_works"],
        [
            { ...VALID_PAYLOAD, trabalhoIds: Array(WORK_EMAIL_LIMITS.worksPerRequest + 1).fill(WORK_ID) },
            "invalid_works",
        ],
        [{ ...VALID_PAYLOAD, destinatarios: { remetente: false, autores: false } }, "invalid_audience"],
        [{ ...VALID_PAYLOAD, destinatarios: { remetente: "true" } }, "invalid_audience"],
        [{ ...VALID_PAYLOAD, somenteEmails: "ana@example.com" }, "invalid_filter"],
        [{ ...VALID_PAYLOAD, somenteEmails: ["nao-e-email"] }, "invalid_filter"],
    ]

    for (const [payload, error] of cases) {
        const result = parseWorkEmailRequest(payload)
        assert.equal(result.ok, false)
        if (!result.ok) assert.equal(result.error, error)
    }
})

test("modo teste dispensa a escolha de público", () => {
    const result = parseWorkEmailRequest({ ...VALID_PAYLOAD, destinatarios: undefined, teste: true })

    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.request.teste, true)
})

test("fatia os trabalhos no limite por requisição", () => {
    const ids = Array.from({ length: 23 }, (_, index) => `id-${index}`)
    const chunks = chunkWorkIds(ids)

    assert.deepEqual(chunks.map(chunk => chunk.length), [10, 10, 3])
    assert.deepEqual(chunks.flat(), ids)
})
