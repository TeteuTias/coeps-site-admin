import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import {
  createUniqueDiscountCodeDocuments,
  generatePaymentCode,
  generateReadableTrackingCode,
  normalizePaymentCode,
  parseDiscountPercentage,
  parseDiscountQuantity,
} from "../payment-code-repository.ts";

test("gera rastreio legível removendo acentos e espaços", () => {
  assert.equal(
    generateReadableTrackingCode("ana lívia", "CIEPS-2026"),
    "AnaLivia-CIEPS2026",
  );
});

test("adiciona sufixo previsível às duplicidades de rastreio", () => {
  assert.equal(
    generateReadableTrackingCode("Ana Lívia", "CIEPS-2026", 2),
    "AnaLivia-CIEPS2026-2",
  );
  assert.equal(
    generateReadableTrackingCode("Ana Lívia", "CIEPS-2026", 3),
    "AnaLivia-CIEPS2026-3",
  );
});

test("trunca rastreio longo sem exceder 64 caracteres normalizados", () => {
  const code = generateReadableTrackingCode("Nome extremamente longo ".repeat(8), "CIEPS-2026", 237);
  const normalized = normalizePaymentCode(code);

  assert.ok(normalized);
  assert.equal(normalized.length, 64);
  assert.match(code, /-CIEPS2026-237$/);
});

test("aceita lotes até 500 e rejeita quantidades inválidas", () => {
  assert.equal(parseDiscountQuantity(1), 1);
  assert.equal(parseDiscountQuantity("158"), 158);
  assert.equal(parseDiscountQuantity(500), 500);
  assert.equal(parseDiscountQuantity(0), null);
  assert.equal(parseDiscountQuantity(501), null);
  assert.equal(parseDiscountQuantity(1.5), null);
});

test("valida percentual e gera 158 descontos aleatórios distintos", () => {
  assert.equal(parseDiscountPercentage(25), 25);
  assert.equal(parseDiscountPercentage(0), null);
  assert.equal(parseDiscountPercentage(100), null);

  const codes = Array.from({ length: 158 }, () => generatePaymentCode("CIEPS-2026", "DESCONTO"));
  assert.equal(new Set(codes.map(normalizePaymentCode)).size, 158);
  assert.ok(codes.every((code) => code.startsWith("D-2026-")));
});

test("regenera colisões antes de inserir o lote em uma única operação", async () => {
  let catalogReads = 0;
  let collidedCode = "";
  let insertCalls = 0;
  let insertedDocuments: Array<{ codigoNormalizado: string }> = [];
  const db = {
    collection(name: string) {
      return {
        find(filter: { codigoNormalizado?: { $in?: string[] } }) {
          return {
            async toArray() {
              if (name !== "pagamentos.codigos") return [];
              catalogReads += 1;
              if (catalogReads !== 1) return [];
              collidedCode = filter.codigoNormalizado?.$in?.[0] ?? "";
              return [{ codigoNormalizado: collidedCode }];
            },
          };
        },
        async insertMany(documents: Array<{ codigoNormalizado: string }>) {
          insertCalls += 1;
          insertedDocuments = documents;
          return {
            insertedIds: Object.fromEntries(
              documents.map((_, index) => [index, new ObjectId()]),
            ),
          };
        },
      };
    },
  };

  const created = await createUniqueDiscountCodeDocuments(
    db as never,
    {
      edicaoId: "CIEPS-2026",
      quantidade: 158,
      percentualDesconto: 10,
      perfilUtilizador: "CONGRESSISTA",
      createdBy: "admin-1",
    },
    {} as never,
  );

  assert.equal(insertCalls, 1);
  assert.equal(created.length, 158);
  assert.equal(new Set(insertedDocuments.map((item) => item.codigoNormalizado)).size, 158);
  assert.ok(!insertedDocuments.some((item) => item.codigoNormalizado === collidedCode));
});

test("propaga falha do insertMany sem tentar inserções parciais", async () => {
  let insertCalls = 0;
  const db = {
    collection(name: string) {
      return {
        find() {
          return { async toArray() { return []; } };
        },
        async insertMany() {
          assert.equal(name, "pagamentos.codigos");
          insertCalls += 1;
          throw new Error("bulk_failed");
        },
      };
    },
  };

  await assert.rejects(
    createUniqueDiscountCodeDocuments(
      db as never,
      {
        edicaoId: "CIEPS-2026",
        quantidade: 10,
        perfilUtilizador: "ORGANIZADOR",
        createdBy: "admin-1",
      },
      {} as never,
    ),
    /bulk_failed/,
  );
  assert.equal(insertCalls, 1);
});
