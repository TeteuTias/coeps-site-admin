import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ObjectId } from "mongodb";
import {
  buildAutomaticLotOccupancy,
  getAutomaticLotOccupancy,
} from "../automatic-lot-occupancy.ts";

const lots = [
  { codigo: 432, limiteVagas: 100 },
  { codigo: 433, limiteVagas: 130 },
];

test("distribui a ocupação cumulativamente sem fixar valores por lote", () => {
  const calculatedAt = new Date("2026-08-26T12:00:00.000Z");
  const occupancy = buildAutomaticLotOccupancy(
    "config-1",
    "CIEPS-2026",
    lots,
    { confirmadasLegadas: 1, confirmadasModernas: 3, reservasAtivas: 0 },
    calculatedAt,
  );

  assert.equal(occupancy.confirmadas.total, 4);
  assert.equal(occupancy.ocupadasEfetivas, 4);
  assert.equal(occupancy.capacidadeTotal, 230);
  assert.equal(occupancy.excedente, 0);
  assert.deepEqual(occupancy.lotes, [
    { codigo: 432, limiteVagas: 100, ocupadasEfetivas: 4, restantes: 96 },
    { codigo: 433, limiteVagas: 130, ocupadasEfetivas: 0, restantes: 130 },
  ]);
  assert.equal(occupancy.calculadoEm, calculatedAt.toISOString());
});

test("reservas ativas reduzem as vagas restantes sem virar venda confirmada", () => {
  const occupancy = buildAutomaticLotOccupancy(
    "config-1",
    "CIEPS-2026",
    lots,
    { confirmadasLegadas: 0, confirmadasModernas: 3, reservasAtivas: 1 },
  );

  assert.equal(occupancy.confirmadas.total, 3);
  assert.equal(occupancy.reservasAtivas, 1);
  assert.equal(occupancy.lotes[0].restantes, 96);
});

test("respeita as fronteiras dos lotes e nunca produz restante negativo", () => {
  const at99 = buildAutomaticLotOccupancy(
    "config-1",
    "CIEPS-2026",
    lots,
    { confirmadasLegadas: 0, confirmadasModernas: 99, reservasAtivas: 0 },
  );
  const at100 = buildAutomaticLotOccupancy(
    "config-1",
    "CIEPS-2026",
    lots,
    { confirmadasLegadas: 0, confirmadasModernas: 100, reservasAtivas: 0 },
  );
  const at104 = buildAutomaticLotOccupancy(
    "config-1",
    "CIEPS-2026",
    lots,
    { confirmadasLegadas: 0, confirmadasModernas: 104, reservasAtivas: 0 },
  );
  const overCapacity = buildAutomaticLotOccupancy(
    "config-1",
    "CIEPS-2026",
    lots,
    { confirmadasLegadas: 0, confirmadasModernas: 250, reservasAtivas: 0 },
  );

  assert.deepEqual(at99.lotes.map((lot) => lot.restantes), [1, 130]);
  assert.deepEqual(at100.lotes.map((lot) => lot.restantes), [0, 130]);
  assert.deepEqual(at104.lotes.map((lot) => lot.restantes), [0, 126]);
  assert.deepEqual(overCapacity.lotes.map((lot) => lot.restantes), [0, 0]);
  assert.equal(overCapacity.excedente, 20);
});

test("preserva a ordem configurada dos lotes", () => {
  const occupancy = buildAutomaticLotOccupancy(
    "config-1",
    "CIEPS-2026",
    [lots[1], lots[0]],
    { confirmadasLegadas: 0, confirmadasModernas: 4, reservasAtivas: 0 },
  );

  assert.deepEqual(occupancy.lotes.map((lot) => lot.codigo), [433, 432]);
  assert.deepEqual(occupancy.lotes.map((lot) => lot.restantes), [126, 100]);
});

test("consulta os mesmos grupos e estados usados pelo checkout", async () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const calls: Array<{ collection: string; filter: unknown }> = [];
  const counts: Record<string, number> = {
    usuarios: 1,
    "pagamentos.atribuicoes": 3,
    "pagamentos.sessoes": 2,
  };
  const db = {
    collection(name: string) {
      return {
        async countDocuments(filter: unknown) {
          calls.push({ collection: name, filter });
          return counts[name];
        },
      };
    },
  };
  const configId = new ObjectId();
  const occupancy = await getAutomaticLotOccupancy(
    db as never,
    {
      _id: configId,
      edicaoId: "cieps-2026",
      modo: "automatico",
      configuracaoLotesAutomaticos: {
        lotes: lots.map((lot) => ({ ...lot, nome: String(lot.codigo), precos: {
          valorAVista: 0,
          valorBoleto: 0,
          valorDebito: 0,
          valorPix: 0,
          parcelamentos: [],
        } })),
      },
    } as never,
    now,
  );

  assert.equal(occupancy.configId, String(configId));
  assert.equal(occupancy.edicaoId, "CIEPS-2026");
  assert.equal(occupancy.confirmadas.total, 4);
  assert.equal(occupancy.reservasAtivas, 2);
  assert.deepEqual(
    calls.find((call) => call.collection === "usuarios")?.filter,
    {
      "pagamento.situacao": 1,
      "pagamento.edicaoId": "CIEPS-2026",
      "pagamento.compraId": { $exists: false },
      "pagamento.tipo_pagamento": { $not: /^organizador$/i },
    },
  );
  assert.deepEqual(
    calls.find((call) => call.collection === "pagamentos.atribuicoes")?.filter,
    { edicaoId: "CIEPS-2026", status: "CONFIRMADA" },
  );
  assert.deepEqual(
    calls.find((call) => call.collection === "pagamentos.sessoes")?.filter,
    {
      type: "ticket",
      edicaoId: "CIEPS-2026",
      $or: [
        { status: "OPEN", expiresAt: { $gt: now } },
        {
          status: {
            $in: [
              "CREATING_PAYMENT",
              "PAYMENT_PENDING",
              "PAYMENT_REVIEW_REQUIRED",
            ],
          },
        },
      ],
    },
  );
});

test("a rota de leitura não adiciona uma segunda allowlist financeira", async () => {
  const routeSource = await readFile(
    new URL(
      "../../../api/get/pagamentos/ocupacaoLotes/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(routeSource, /withApiAuthRequired/);
  assert.doesNotMatch(routeSource, /requireFinanceAdmin/);
});
