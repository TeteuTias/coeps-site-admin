import test from "node:test";
import assert from "node:assert/strict";
import {
  INDISPONIVEL,
  formatarCentavos,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
} from "../formatar.ts";

const semNbsp = (s: string) => s.replace(/ /g, " ");

test("zero é dado, ausência é 'Indisponível'", () => {
  assert.equal(semNbsp(formatarMoeda(0)), "R$ 0,00");
  assert.equal(formatarMoeda(null), INDISPONIVEL);
  assert.equal(formatarMoeda(undefined), INDISPONIVEL);
  assert.equal(formatarMoeda(Number.NaN), INDISPONIVEL);
  assert.equal(formatarNumero(0), "0");
  assert.equal(formatarNumero(undefined), INDISPONIVEL);
});

test("centavos viram reais sem erro de arredondamento", () => {
  assert.equal(semNbsp(formatarCentavos(12345)), "R$ 123,45");
  assert.equal(semNbsp(formatarCentavos(1)), "R$ 0,01");
  assert.equal(formatarCentavos(null), INDISPONIVEL);
});

test("percentual vem da razão, com vírgula", () => {
  assert.equal(formatarPercentual(0.78), "78%");
  assert.equal(formatarPercentual(0.4125, 1), "41,3%");
  assert.equal(formatarPercentual(0), "0%");
  assert.equal(formatarPercentual(null), INDISPONIVEL);
});

test("datas usam o horário de Brasília, não o do computador", () => {
  // 01h UTC do dia 5 ainda é 22h do dia 4 em Brasília
  assert.equal(formatarDataHora("2026-11-05T01:00:00Z"), "04/11/2026 22:00");
  assert.equal(formatarData("2026-11-05T01:00:00Z"), "04/11/2026");
  assert.equal(formatarDataHora("2026-11-04T10:00:00-03:00"), "04/11/2026 10:00");
});

test("data ausente ou inválida cai no texto de vazio", () => {
  assert.equal(formatarDataHora(null), "Data não informada");
  assert.equal(formatarDataHora("não é data"), "Data não informada");
  assert.equal(formatarData(undefined, "—"), "—");
});
