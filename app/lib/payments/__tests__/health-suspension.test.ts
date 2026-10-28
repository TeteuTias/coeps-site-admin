import test from "node:test";
import assert from "node:assert/strict";
import {
  countHealthSuspension,
  reactivateHealthProfessionals,
  suspendHealthProfessionals,
} from "../health-suspension.ts";

type Call = { name: string; op: string; filter: Record<string, any>; update?: Record<string, any> };

function fakeDb() {
  const calls: Call[] = [];
  const collection = (name: string) => ({
    updateMany: async (filter: Record<string, any>, update: Record<string, any>) => {
      calls.push({ name, op: "updateMany", filter, update });
      return { modifiedCount: name === "usuarios" ? 4 : 7 };
    },
    countDocuments: async (filter: Record<string, any>) => {
      calls.push({ name, op: "countDocuments", filter });
      return 2;
    },
  });
  return { db: { collection } as never, calls };
}

const now = new Date("2026-10-28T12:00:00Z");

test("suspender: só inscritos ativos da edição e só códigos ATIVO de saúde", async () => {
  const { db, calls } = fakeDb();
  const result = await suspendHealthProfessionals(db, "CIEPS-2026", "admin-1", now);

  assert.deepEqual(result, { usuarios: 4, codigos: 7 });
  const users = calls.find((call) => call.name === "usuarios");
  assert.deepEqual(users?.filter, {
    "pagamento.tipo_pagamento": "profissional_saude",
    "pagamento.edicaoId": "CIEPS-2026",
    "pagamento.situacao": 1,
  });
  assert.equal(users?.update?.$set["pagamento.situacao"], 3);
  assert.deepEqual(users?.update?.$set["pagamento.suspensao"], {
    ativa: true,
    motivo: "REPASSE_PENDENTE",
    suspensoEm: now,
    suspensoPor: "admin-1",
  });

  const codes = calls.find((call) => call.name === "pagamentos.codigos");
  assert.deepEqual(codes?.filter, {
    edicaoId: "CIEPS-2026",
    perfilUtilizador: "PROFISSIONAL_SAUDE",
    status: "ATIVO",
  });
  assert.equal(codes?.update?.$set.status, "INATIVO");
  assert.equal(codes?.update?.$set.inativadoPorSuspensao, true);
});

test("reativar: usa a marca de suspensão e não reativa códigos desativados à mão", async () => {
  const { db, calls } = fakeDb();
  await reactivateHealthProfessionals(db, "CIEPS-2026", "admin-2", now);

  const users = calls.find((call) => call.name === "usuarios");
  assert.equal(users?.filter["pagamento.suspensao.ativa"], true);
  assert.equal(users?.filter["pagamento.situacao"], undefined);
  assert.equal(users?.update?.$set["pagamento.situacao"], 1);
  assert.equal(users?.update?.$set["pagamento.suspensao.ativa"], false);
  assert.equal(users?.update?.$set["pagamento.suspensao.reativadoPor"], "admin-2");

  const codes = calls.find((call) => call.name === "pagamentos.codigos");
  assert.equal(codes?.filter.inativadoPorSuspensao, true);
  assert.equal(codes?.filter.status, "INATIVO");
  assert.equal(codes?.update?.$set.status, "ATIVO");
  assert.deepEqual(codes?.update?.$unset, { inativadoPorSuspensao: "" });
});

test("contagem filtra pela edição ativa", async () => {
  const { db, calls } = fakeDb();
  const counts = await countHealthSuspension(db, "CIEPS-2026");

  assert.deepEqual(counts, { ativos: 2, suspensos: 2, codigosBloqueados: 2 });
  assert.ok(calls.every((call) => (call.filter["pagamento.edicaoId"] ?? call.filter.edicaoId) === "CIEPS-2026"));
});
