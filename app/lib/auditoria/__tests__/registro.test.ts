import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import {
    alvoDoPedido,
    anotarAuditoria,
    classificarRota,
    COLECAO_LOGS,
    gravarLog,
    lerAnotacao,
    lerCorpoParaLog,
    montarLogDePedido,
    nomeDaConta,
    sanitizar,
} from "../registro.ts";
import { lerFiltros, logsParaCsv, montarConsulta } from "../consulta.ts";
import { montarLogin } from "../acesso.ts";

const ADMIN = "auth0|6a8799078ecd649be9bdb061";
const U = "6a00000000000000000000aa";
const M = "6b00000000000000000000bb";

test("sanitizar esconde CPF, senha, token e cartão, mantém o resto", () => {
    const s = sanitizar({ nome: "Ana", cpf: "123", informacoes_usuario: { cpf: "1", senha: "x" }, creditCard: { number: "4111" }, access_token: "t", valor: 10 }) as Record<string, any>;
    assert.equal(s.nome, "Ana");
    assert.equal(s.cpf, "[oculto]");
    assert.equal(s.informacoes_usuario.cpf, "[oculto]");
    assert.equal(s.informacoes_usuario.senha, "[oculto]");
    assert.equal(s.creditCard, "[oculto]");
    assert.equal(s.access_token, "[oculto]");
    assert.equal(s.valor, 10);
});

test("sanitizar guarda listas de ids inteiras (inscritos de atividade apagada)", () => {
    const ids = Array.from({ length: 900 }, (_, i) => String(i));
    assert.equal((sanitizar({ participants: ids }) as any).participants.length, 900);
    const objetos = Array.from({ length: 300 }, (_, i) => ({ i }));
    assert.equal((sanitizar(objetos) as unknown[]).length, 201, "200 objetos + aviso");
    assert.equal(sanitizar(new ObjectId(M)), M);
});

test("rotas viram ações legíveis", () => {
    assert.equal(classificarRota("PUT", "/api/put/minicursos/alterarInformacoes/").acao, "minicurso.editar");
    assert.equal(classificarRota("DELETE", "/api/delete/removerInscricaoMinicurso").acao, "inscricao.remover");
    assert.equal(classificarRota("POST", "/api/post/darPresencaPalestra").acao, "presenca.palestra.dar");
    assert.equal(classificarRota("POST", "/api/post/darPresenca").acao, "presenca.dar");
    assert.equal(classificarRota("POST", "/api/post/desconhecida").acao, "api.post");
});

test("alvo sai do corpo ou da rota", () => {
    assert.deepEqual(alvoDoPedido("/api/delete/removerInscricaoMinicurso", { userId: U, eventId: M }), { usuarioId: U, minicursoId: M });
    assert.deepEqual(alvoDoPedido(`/api/delete/pagamentos/removerInscricao/${U}`, null), { usuarioId: U });
    assert.deepEqual(alvoDoPedido("/api/put/minicursos/alterarInformacoes", { _id: M }), { minicursoId: M });
});

test("log do pedido: quem, o quê, em quem, IP, antes/depois anotado pela rota", () => {
    const request = new Request("https://admin/api/put/minicursos/alterarInformacoes/", { method: "PUT" });
    anotarAuditoria(request, { antes: { name: "A" }, depois: { name: "B" }, alvo: { minicursoNome: "B" } });
    const log = montarLogDePedido({
        metodo: "PUT", rota: "/api/put/minicursos/alterarInformacoes/", corpo: { _id: M, name: "B" }, status: 200,
        usuario: { sub: ADMIN, email: "admin@cieps" }, ip: "200.1.2.3", userAgent: "Safari", inicio: 1000, fim: 1250,
        anotacao: lerAnotacao(request),
    });
    assert.equal(log.acao, "minicurso.editar");
    assert.equal(log.ator.conta, "Admin");
    assert.equal(log.ator.id, "6a8799078ecd649be9bdb061");
    assert.equal(log.alvo.minicursoId, M);
    assert.equal(log.alvo.minicursoNome, "B");
    assert.deepEqual(log.antes, { name: "A" });
    assert.equal(log.requisicao?.ip, "200.1.2.3");
    assert.equal(log.requisicao?.duracaoMs, 250);
    assert.equal(log.sucesso, true);
});

test("pedido que falhou fica marcado", () => {
    const log = montarLogDePedido({ metodo: "DELETE", rota: "/api/delete/removerInscricaoMinicurso", corpo: {}, status: 424, usuario: null, ip: null, userAgent: null, inicio: 0, fim: 0 });
    assert.equal(log.sucesso, false);
    assert.match(log.resumo, /falhou: HTTP 424/);
});

test("corpo é lido de uma cópia: a rota ainda consegue ler o original", async () => {
    const request = new Request("https://admin/x", { method: "POST", body: JSON.stringify({ a: 1 }), headers: { "content-type": "application/json" } });
    assert.deepEqual(await lerCorpoParaLog(request), { a: 1 });
    assert.deepEqual(await request.json(), { a: 1 });
});

test("gravarLog insere (nunca atualiza) e nunca lança", async () => {
    const inseridos: unknown[] = [];
    const db = {
        collection: (nome: string) => ({
            createIndex: async () => "ok",
            findOne: async () => (nome === "usuarios" ? { informacoes_usuario: { nome: "Ana" } } : { name: "Sutura" }),
            insertOne: async (doc: unknown) => { assert.equal(nome, COLECAO_LOGS); inseridos.push(doc); return {}; },
        }),
    } as any;
    const ok = await gravarLog(db, montarLogDePedido({ metodo: "POST", rota: "/api/post/darPresenca", corpo: { userId: U, eventId: M, cpf: "9" }, status: 200, usuario: { sub: ADMIN }, ip: null, userAgent: null, inicio: 0, fim: 0 }));
    assert.equal(ok, true);
    const doc = inseridos[0] as any;
    assert.equal(doc.alvo.usuarioNome, "Ana");
    assert.equal(doc.alvo.minicursoNome, "Sutura");
    assert.equal(doc.requisicao.corpo.cpf, "[oculto]");

    const quebrado = { collection: () => ({ createIndex: async () => "ok", findOne: async () => null, insertOne: async () => { throw new Error("fora"); } }) } as any;
    assert.equal(await gravarLog(quebrado, montarLogDePedido({ metodo: "POST", rota: "/x", corpo: null, status: 200, usuario: null, ip: null, userAgent: null, inicio: 0, fim: 0 })), false);
});

test("nome da conta", () => {
    assert.equal(nomeDaConta("auth0|6a87991a310d49dafb8d113b"), "Apoio");
    assert.equal(nomeDaConta("auth0|outro"), null);
});

test("entrada na conta: uma linha por sessão (id fixo)", () => {
    const headers = new Headers({ "x-forwarded-for": "177.1.1.1, 10.0.0.1", "user-agent": "Chrome" });
    const log = montarLogin({ user: { sub: ADMIN }, internal: { sid: "abc", createdAt: 1_700_000_000 } }, "GET", "/", headers);
    assert.equal(log?._id, "login:abc");
    assert.equal(log?.acao, "acesso.login");
    assert.equal(log?.requisicao?.ip, "177.1.1.1");
    assert.equal(log?.em.toISOString(), new Date(1_700_000_000_000).toISOString());
    assert.equal(montarLogin({ user: { sub: ADMIN } }, "GET", "/", headers), null, "sem sid não grava");
});

test("filtros da tela viram consulta", () => {
    const f = lerFiltros(new URLSearchParams({ de: "2026-11-10", ate: "2026-11-12", categoria: "inscricao", conta: "Apoio", afetado: U, minicurso: M, q: "pay_(1)", sucesso: "nao", pagina: "3", tamanho: "999" }));
    assert.equal(f.de?.toISOString(), "2026-11-10T03:00:00.000Z");
    assert.equal(f.ate?.toISOString(), "2026-11-13T02:59:59.999Z");
    assert.equal(f.pagina, 3);
    assert.equal(f.tamanho, 200);
    const c = montarConsulta(f) as any;
    const json = JSON.stringify(c);
    assert.ok(json.includes('"categoria":"inscricao"'));
    assert.ok(json.includes(`"alvo.minicursoId":"${M}"`));
    assert.ok(json.includes(`"alvo.usuarioId":"${U}"`));
    assert.ok(json.includes("pay_\\\\(1\\\\)"), "busca escapa caracteres de regex");
    assert.ok(json.includes('"sucesso":false'));
    assert.deepEqual(montarConsulta(lerFiltros(new URLSearchParams())), {});
});

test("CSV: ; com BOM, aspas escapadas e sem fórmula do Excel", () => {
    const csv = logsParaCsv([{ em: new Date("2026-11-12T15:00:00Z"), acao: "x", resumo: '=HYPERLINK("a")', sucesso: true, ator: { conta: "Admin" }, alvo: {}, requisicao: { ip: "1.1.1.1" } }]);
    assert.ok(csv.startsWith("﻿data_hora;"));
    assert.ok(csv.includes(`"'=HYPERLINK(""a"")"`));
    assert.ok(csv.includes('"12/11/2026, 12:00:00"'));
});
