import test from "node:test";
import assert from "node:assert/strict";
import { interpretarEscrita, limparCodigo, normalizarBusca } from "../chamada.ts";

test("interpretarEscrita distingue aplicado, já estava, alvo inexistente e dúvida", () => {
  assert.equal(interpretarEscrita({ data: { matchedCount: 1, modifiedCount: 1 } }), "aplicado");
  assert.equal(interpretarEscrita({ data: { matchedCount: 1, modifiedCount: 0 } }), "jaEstava");
  assert.equal(interpretarEscrita({ data: { matchedCount: 0, modifiedCount: 0 } }), "alvoInexistente");
  assert.equal(interpretarEscrita({ data: { acknowledged: true } }), "duvidoso");
  assert.equal(interpretarEscrita({ message: "ok" }), "duvidoso");
  assert.equal(interpretarEscrita(null), "duvidoso");
});

test("limparCodigo só aceita identificador de 24 hexadecimais", () => {
  assert.equal(limparCodigo(" 6696b5adf287f4a45ed8f04f \n"), "6696b5adf287f4a45ed8f04f");
  assert.equal(limparCodigo("https://exemplo.com/x"), null);
  assert.equal(limparCodigo("123"), null);
});

test("normalizarBusca ignora acento e caixa", () => {
  assert.equal(normalizarBusca("  João Álvares "), "joao alvares");
});
