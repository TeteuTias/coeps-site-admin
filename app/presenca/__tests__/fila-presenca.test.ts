import test from "node:test";
import assert from "node:assert/strict";
import { chaveDe, destinoDoEnvio, efeitoDaResposta, enfileirar, lerFila, limparCodigo, requisicaoDe, tirarDaFila } from "../fila-presenca.ts";

const EV = "6696b5adf287f4a45ed8f000";
const U1 = "6696b5adf287f4a45ed8f001";
const U2 = "6696b5adf287f4a45ed8f002";

test("enfileirar mantém uma entrada por pessoa/atividade/turno e a ação mais nova vence", () => {
  let f = enfileirar([], { tipo: "palestra", eventId: EV, turno: "init", userId: U1, nome: "Ana", quer: "dar", criadoEm: 1 });
  f = enfileirar(f, { tipo: "palestra", eventId: EV, turno: "init", userId: U2, nome: "Bia", quer: "dar", criadoEm: 2 });
  f = enfileirar(f, { tipo: "palestra", eventId: EV, turno: "end", userId: U1, nome: "Ana", quer: "dar", criadoEm: 3 });
  // bipou a Ana de novo na entrada (agora retirando): substitui, não duplica
  f = enfileirar(f, { tipo: "palestra", eventId: EV, turno: "init", userId: U1, nome: "Ana", quer: "retirar", criadoEm: 4 });
  assert.equal(f.length, 3);
  const anaEntrada = f.find((p) => p.chave === chaveDe({ tipo: "palestra", eventId: EV, turno: "init", userId: U1 }));
  assert.equal(anaEntrada?.quer, "retirar");
  assert.equal(tirarDaFila(f, anaEntrada!.chave).length, 2);
});

test("lerFila tolera armazenamento vazio, estragado ou com itens inválidos", () => {
  assert.deepEqual(lerFila(null), []);
  assert.deepEqual(lerFila("{não é json"), []);
  assert.deepEqual(lerFila(JSON.stringify({ a: 1 })), []);
  const bom = enfileirar([], { tipo: "minicurso", eventId: EV, userId: U1, nome: "Ana", quer: "dar", criadoEm: 1 });
  assert.deepEqual(lerFila(JSON.stringify([...bom, { chave: "x" }, null])), bom);
});

test("requisicaoDe usa as mesmas rotas da tela ao vivo", () => {
  const [m] = enfileirar([], { tipo: "minicurso", eventId: EV, userId: U1, nome: "Ana", quer: "dar", criadoEm: 1 });
  assert.deepEqual(requisicaoDe(m), { url: "/api/post/darPresenca", corpo: { eventId: EV, userId: U1 } });
  const [p] = enfileirar([], { tipo: "palestra", eventId: EV, turno: "end", userId: U1, nome: "Ana", quer: "retirar", criadoEm: 1 });
  assert.deepEqual(requisicaoDe(p), { url: "/api/post/retirarPresencaPalestra", corpo: { eventId: EV, userId: U1, listType: "end" } });
});

test("destinoDoEnvio: rede e 5xx ficam na fila, 401 espera nova sessão, 4xx sai com aviso", () => {
  assert.equal(destinoDoEnvio(null), "tentarDepois");
  assert.equal(destinoDoEnvio(200), "entregue");
  assert.equal(destinoDoEnvio(500), "tentarDepois");
  assert.equal(destinoDoEnvio(503), "tentarDepois");
  assert.equal(destinoDoEnvio(429), "tentarDepois");
  assert.equal(destinoDoEnvio(401), "sessao");
  assert.equal(destinoDoEnvio(400), "recusado");
  assert.equal(destinoDoEnvio(404), "recusado");
});

test("limparCodigo aceita só a credencial (24 hexadecimais) e normaliza", () => {
  assert.equal(limparCodigo(` ${U1.toUpperCase()}\n`), U1);
  assert.equal(limparCodigo("https://exemplo.com"), null);
  assert.equal(limparCodigo("123"), null);
});

test("efeitoDaResposta lê matchedCount/modifiedCount", () => {
  assert.equal(efeitoDaResposta({ data: { matchedCount: 1, modifiedCount: 1 } }), "gravou");
  assert.equal(efeitoDaResposta({ data: { matchedCount: 1, modifiedCount: 0 } }), "jaEstava");
  assert.equal(efeitoDaResposta({ data: { matchedCount: 0, modifiedCount: 0 } }), "atividadeInexistente");
});
