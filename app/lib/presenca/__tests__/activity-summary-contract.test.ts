import assert from "node:assert/strict"
import test from "node:test"
import { parseDataArrayPayload } from "../../api-data-contract.ts"
import { isRawActivity, toCourseSummary, toLectureSummary } from "../activity-summary-contract.ts"

test("maxParticipants infinito (null no JSON) não derruba a lista de minicursos", () => {
    // Infinity e NaN no Mongo chegam ao navegador como null após o JSON.
    const payload = JSON.parse(JSON.stringify({
        data: [
            { _id: "1", name: "Normal", type: "TODOS", maxParticipants: 30, participants: ["a", "b"] },
            { _id: "2", name: "Visita", type: "TODOS", maxParticipants: Infinity, participants: [] },
            { _id: "3", name: "Coffee", type: "TODOS", maxParticipants: NaN, participants: [] },
        ],
    }))
    const parsed = parseDataArrayPayload(payload, isRawActivity)
    assert.ok(parsed)
    const courses = parsed.map(toCourseSummary)
    assert.equal(courses.length, 3)
    assert.deepEqual(courses.map((c) => c.maxParticipants), [30, 0, 0])
    assert.deepEqual(courses[0].participants, ["a", "b"])
})

test("campos ausentes ganham valores padrão sem perder os demais", () => {
    const course = toCourseSummary({ _id: "1", name: "Antigo", description: "x" })
    assert.equal(course.type, "")
    assert.equal(course.maxParticipants, 0)
    assert.deepEqual(course.participants, [])
    assert.equal(course.description, "x")
    assert.equal(toLectureSummary({ _id: "2", name: "Palestra" }).type, "")
})

test("itens sem _id ou name string continuam inválidos", () => {
    for (const item of [null, "x", [], {}, { _id: "1" }, { name: "x" }, { _id: 1, name: "x" }]) {
        assert.equal(isRawActivity(item), false)
    }
    assert.equal(parseDataArrayPayload({ data: [{ _id: "1", name: "ok" }, {}] }, isRawActivity), null)
    assert.equal(parseDataArrayPayload({ data: "x" }, isRawActivity), null)
})
