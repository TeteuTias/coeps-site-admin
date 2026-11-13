// Entrada, saída e acesso negado no Admin (chamado pelo proxy).
// A entrada é gravada uma vez por sessão do Auth0 (sid): o primeiro pedido autenticado daquela sessão
// grava "acesso.login" com IP e navegador. Repetir não duplica (upsert por _id = login:<sid>).
import type { Db } from "mongodb";
import { atorAdmin, COLECAO_LOGS, type LogAuditoria } from "./registro.ts";

type Sessao = { user?: { sub?: unknown; email?: unknown; name?: unknown }; internal?: { sid?: unknown; createdAt?: unknown } } | null | undefined;

const jaGravados = new Set<string>();

function requisicao(metodo: string, rota: string, headers: Headers) {
    const encaminhado = headers.get("x-forwarded-for");
    return {
        metodo,
        rota,
        ip: encaminhado ? encaminhado.split(",")[0].trim() : headers.get("x-real-ip"),
        userAgent: headers.get("user-agent"),
    };
}

export function montarLogin(sessao: Sessao, metodo: string, rota: string, headers: Headers, agora = new Date()): (LogAuditoria & { _id: string }) | null {
    const sid = typeof sessao?.internal?.sid === "string" ? sessao.internal.sid : null;
    if (!sid || !sessao?.user?.sub) return null;
    const criada = typeof sessao.internal?.createdAt === "number" ? new Date(sessao.internal.createdAt * 1000) : agora;
    const ator = atorAdmin(sessao.user);
    return {
        _id: `login:${sid}`,
        em: Number.isFinite(criada.getTime()) ? criada : agora,
        origem: "admin",
        acao: "acesso.login",
        categoria: "acesso",
        resumo: `Entrou no Admin${ator.conta ? ` (conta ${ator.conta})` : ""}`,
        sucesso: true,
        status: null,
        ator,
        alvo: {},
        requisicao: requisicao(metodo, rota, headers),
    };
}

export async function registrarLogin(db: Db, sessao: Sessao, metodo: string, rota: string, headers: Headers) {
    const log = montarLogin(sessao, metodo, rota, headers);
    if (!log || jaGravados.has(log._id)) return;
    try {
        await db.collection(COLECAO_LOGS).updateOne({ _id: log._id as never }, { $setOnInsert: log }, { upsert: true });
        jaGravados.add(log._id);
        if (jaGravados.size > 5000) jaGravados.clear();
    } catch (error) {
        console.error("auditoria: login não gravado", log._id, error);
    }
}

export async function registrarEvento(db: Db, sessao: Sessao, dados: { acao: string; resumo: string; sucesso: boolean; status?: number | null; metodo: string; rota: string; headers: Headers }) {
    try {
        await db.collection(COLECAO_LOGS).insertOne({
            em: new Date(),
            origem: "admin",
            acao: dados.acao,
            categoria: "acesso",
            resumo: dados.resumo,
            sucesso: dados.sucesso,
            status: dados.status ?? null,
            ator: atorAdmin(sessao?.user),
            alvo: {},
            requisicao: requisicao(dados.metodo, dados.rota, dados.headers),
        } satisfies LogAuditoria);
    } catch (error) {
        console.error("auditoria: evento de acesso não gravado", dados.acao, error);
    }
}
