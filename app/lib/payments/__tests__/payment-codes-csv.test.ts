import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentCodesCsv } from "../payment-codes-csv.ts";

test("gera CSV com BOM, ponto e vírgula e fim de linha compatíveis com Excel", () => {
  const csv = buildPaymentCodesCsv([
    {
      codigo: 'D-2026-AB"CD',
      tipo: "DESCONTO",
      perfilUtilizador: "ORGANIZADOR",
      edicaoId: "CIEPS-2026",
    },
  ]);

  assert.ok(csv.startsWith('\uFEFF"Código";"Tipo";"Perfil";"Desconto (%)";"Edição"\r\n'));
  assert.ok(csv.includes('"D-2026-AB""CD";"DESCONTO";"ORGANIZADOR";"";"CIEPS-2026"'));
});
