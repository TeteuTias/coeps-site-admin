import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import {
  buildCourseCreateDocument,
  formatEventDate,
  updateCourseEditorial,
} from "../course-editorial.ts";

const id = new ObjectId();
const stepId = new ObjectId().toHexString();

function storedCourse() {
  return {
    _id: id,
    name: "Suporte básico de vida",
    participants: ["u1"],
    attendanceList: ["u1"],
    participantsCount: 1,
    _nSerie: "serie-original",
    timeline: [{ _id: stepId, speakers: ["s1"], presence_list: ["u1"] }],
  };
}

// banco em memória: aplica o $set como o Mongo faz (só troca as chaves enviadas)
function fakeCollection(doc: Record<string, any> | null) {
  return {
    doc,
    async findOne() { return doc as any; },
    async updateOne(_filter: unknown, update: { $set: Record<string, unknown> }) {
      if (!doc) return { matchedCount: 0 };
      Object.assign(doc, update.$set);
      return { matchedCount: 1 };
    },
  };
}

const form = (extra: Record<string, unknown> = {}) => ({
  _id: id.toHexString(),
  name: "Suporte básico de vida 2",
  dateOpen: "2026-11-04T10:00",
  timeline: [{ _id: stepId, name: "Aula", date_init: "2026-11-05T09:00", date_end: "2026-11-05T11:00", speakers: [], presence_list: [] }],
  ...extra,
});

test("editar o nome preserva inscritos, presenças, contador e série", async () => {
  const col = fakeCollection(storedCourse());
  const result = await updateCourseEditorial(col, form({
    participants: [], attendanceList: [], participantsCount: 99, _nSerie: "outra",
  }));
  assert.equal(result.status, 200);
  assert.equal(col.doc!.name, "Suporte básico de vida 2");
  assert.deepEqual(col.doc!.participants, ["u1"]);
  assert.deepEqual(col.doc!.attendanceList, ["u1"]);
  assert.equal(col.doc!.participantsCount, 1);
  assert.equal(col.doc!._nSerie, "serie-original");
});

test("etapas já salvas mantêm quem fala e quem passou, mesmo que o formulário envie vazio", async () => {
  const col = fakeCollection(storedCourse());
  await updateCourseEditorial(col, form());
  assert.deepEqual(col.doc!.timeline[0].speakers, ["s1"]);
  assert.deepEqual(col.doc!.timeline[0].presence_list, ["u1"]);
});

test("etapas antigas sem _id não herdam speakers de outra etapa", async () => {
  const doc = { ...storedCourse(), timeline: [{ speakers: ["s1"], presence_list: ["u1"] }, { _id: stepId, speakers: ["s2"], presence_list: [] }] };
  const col = fakeCollection(doc);
  const novo = form({ timeline: [{ name: "A", date_init: "2026-11-05T09:00", date_end: "2026-11-05T10:00" }, { _id: stepId, date_init: "2026-11-05T11:00", date_end: "2026-11-05T12:00" }] });
  await updateCourseEditorial(col, novo);
  assert.deepEqual(col.doc!.timeline[0].speakers, []);
  assert.deepEqual(col.doc!.timeline[1].speakers, ["s2"]);
});

test("campo ausente no formulário não vira null no banco", async () => {
  const col = fakeCollection(storedCourse());
  await updateCourseEditorial(col, form());
  assert.equal("description" in col.doc!, false);
});

test("data com e sem segundos é aceita e gravada em horário de Brasília", async () => {
  assert.equal(formatEventDate("2026-11-04T10:00", "d"), "2026-11-04T10:00:00-03:00");
  assert.equal(formatEventDate("2026-11-04T10:00:00", "d"), "2026-11-04T10:00:00-03:00");
});

test("data inválida é recusada com o campo e nada é gravado", async () => {
  const col = fakeCollection(storedCourse());
  const result = await updateCourseEditorial(col, form({ dateOpen: "2026-13-40T10:00" }));
  assert.deepEqual(result, { status: 400, message: "Data inválida. Use o formato dia/mês/ano e hora.", field: "dateOpen" });
  assert.equal(col.doc!.name, "Suporte básico de vida");
});

test("data de etapa inválida aponta a etapa", async () => {
  const col = fakeCollection(storedCourse());
  const bad = form({ timeline: [{ _id: stepId, date_init: "", date_end: "2026-11-05T11:00" }] });
  const result = await updateCourseEditorial(col, bad);
  assert.equal(result.status, 400);
  assert.equal((result as { field?: string }).field, "timeline.0.date_init");
});

test("atividade inexistente responde 404 e id malformado 400", async () => {
  assert.equal((await updateCourseEditorial(fakeCollection(null), form())).status, 404);
  assert.equal((await updateCourseEditorial(fakeCollection(storedCourse()), form({ _id: "abc" }))).status, 400);
});

test("criar começa sem inscritos, com série nova e contador zero", () => {
  const doc = buildCourseCreateDocument({ ...form(), participantsCount: 50 });
  assert.equal(doc.participantsCount, 0);
  assert.deepEqual(doc.participants, []);
  assert.deepEqual(doc.attendanceList, []);
  assert.equal(doc.dateOpen, "2026-11-04T10:00:00-03:00");
  assert.match(doc._nSerie, /^[0-9a-f]{24}$/);
});
