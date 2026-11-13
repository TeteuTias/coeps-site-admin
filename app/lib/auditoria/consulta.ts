// Filtros da aba Logs → consulta no Mongo. Só leitura.
import type { Filter } from "mongodb";
import type { LogAuditoria } from "./registro.ts";

export const TAMANHO_PAGINA_PADRAO = 50;
export const TAMANHO_PAGINA_MAX = 200;
export const LIMITE_EXPORTACAO = 20000;

export interface FiltrosLogs {
    de: Date | null;
    ate: Date | null;
    categoria: string | null;
    acao: string | null;
    origem: string | null;
    conta: string | null;
    afetado: string | null;
    minicurso: string | null;
    sucesso: boolean | null;
    q: string | null;
    pagina: number;
    tamanho: number;
}

const HEX24 = /^[0-9a-f]{24}$/i;

function escaparRegex(texto: string) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "2026-11-12" → início do dia em Brasília; com fim=true, fim do dia. Aceita também data e hora ISO. */
export function lerData(valor: string | null, fim = false): Date | null {
    if (!valor) return null;
    const v = valor.trim();
    const data = /^\d{4}-\d{2}-\d{2}$/.test(v)
        ? new Date(`${v}T${fim ? "23:59:59.999" : "00:00:00.000"}-03:00`)
        : new Date(v);
    return Number.isFinite(data.getTime()) ? data : null;
}

export function lerFiltros(params: URLSearchParams): FiltrosLogs {
    const texto = (nome: string) => {
        const v = params.get(nome)?.trim();
        return v ? v.slice(0, 200) : null;
    };
    const pagina = Math.max(1, Math.floor(Number(params.get("pagina")) || 1));
    const tamanho = Math.min(TAMANHO_PAGINA_MAX, Math.max(1, Math.floor(Number(params.get("tamanho")) || TAMANHO_PAGINA_PADRAO)));
    const sucesso = params.get("sucesso");
    return {
        de: lerData(params.get("de")),
        ate: lerData(params.get("ate"), true),
        categoria: texto("categoria"),
        acao: texto("acao"),
        origem: texto("origem"),
        conta: texto("conta"),
        afetado: texto("afetado"),
        minicurso: texto("minicurso"),
        sucesso: sucesso === "sim" ? true : sucesso === "nao" ? false : null,
        q: texto("q"),
        pagina,
        tamanho,
    };
}

export function montarConsulta(f: FiltrosLogs): Filter<LogAuditoria> {
    const e: Filter<LogAuditoria>[] = [];
    if (f.de || f.ate) {
        e.push({ em: { ...(f.de ? { $gte: f.de } : {}), ...(f.ate ? { $lte: f.ate } : {}) } });
    }
    if (f.categoria) e.push({ categoria: f.categoria as LogAuditoria["categoria"] });
    if (f.acao) e.push({ acao: f.acao });
    if (f.origem) e.push({ origem: f.origem as LogAuditoria["origem"] });
    if (f.sucesso !== null) e.push({ sucesso: f.sucesso });
    if (f.conta) {
        // id da conta/pessoa que fez, nome da conta (Admin, Apoio…), e-mail ou nome
        const id = f.conta.replace(/^auth0\|/, "");
        const rx = { $regex: escaparRegex(f.conta), $options: "i" };
        e.push({ $or: [{ "ator.id": id }, { "ator.conta": rx }, { "ator.email": rx }, { "ator.nome": rx }] });
    }
    if (f.afetado) {
        const rx = { $regex: escaparRegex(f.afetado), $options: "i" };
        e.push(HEX24.test(f.afetado)
            ? { $or: [{ "alvo.usuarioId": f.afetado.toLowerCase() }, { "ator.id": f.afetado.toLowerCase() }] }
            : { "alvo.usuarioNome": rx });
    }
    if (f.minicurso) {
        e.push(HEX24.test(f.minicurso)
            ? { "alvo.minicursoId": f.minicurso.toLowerCase() }
            : { "alvo.minicursoNome": { $regex: escaparRegex(f.minicurso), $options: "i" } });
    }
    if (f.q) {
        const rx = { $regex: escaparRegex(f.q), $options: "i" };
        e.push({
            $or: [
                { resumo: rx }, { acao: rx }, { "alvo.usuarioNome": rx }, { "alvo.minicursoNome": rx },
                { "alvo.cobrancaId": rx }, { "alvo.usuarioId": rx }, { "ator.email": rx }, { "ator.nome": rx },
                { "requisicao.rota": rx }, { "requisicao.ip": rx },
            ],
        });
    }
    return e.length === 0 ? {} : e.length === 1 ? e[0] : { $and: e };
}

const COLUNAS_CSV: [string, (l: Record<string, any>) => unknown][] = [
    ["data_hora", (l) => (l.em instanceof Date ? l.em : new Date(l.em)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
    ["data_hora_iso", (l) => (l.em instanceof Date ? l.em.toISOString() : l.em)],
    ["origem", (l) => l.origem],
    ["categoria", (l) => l.categoria],
    ["acao", (l) => l.acao],
    ["resumo", (l) => l.resumo],
    ["sucesso", (l) => (l.sucesso ? "sim" : "não")],
    ["status_http", (l) => l.status],
    ["quem_tipo", (l) => l.ator?.tipo],
    ["quem_conta", (l) => l.ator?.conta],
    ["quem_id", (l) => l.ator?.id],
    ["quem_email", (l) => l.ator?.email],
    ["afetado_id", (l) => l.alvo?.usuarioId],
    ["afetado_nome", (l) => l.alvo?.usuarioNome],
    ["atividade_id", (l) => l.alvo?.minicursoId],
    ["atividade_nome", (l) => l.alvo?.minicursoNome],
    ["cobranca", (l) => l.alvo?.cobrancaId],
    ["ip", (l) => l.requisicao?.ip],
    ["navegador", (l) => l.requisicao?.userAgent],
    ["rota", (l) => l.requisicao?.rota],
    ["antes", (l) => (l.antes === undefined ? "" : JSON.stringify(l.antes))],
    ["depois", (l) => (l.depois === undefined ? "" : JSON.stringify(l.depois))],
    ["detalhes", (l) => (l.detalhes === undefined ? "" : JSON.stringify(l.detalhes))],
];

function celula(valor: unknown) {
    let s = valor == null ? "" : String(valor);
    // Excel não executa fórmula vinda do log
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

/** CSV com ; e BOM (abre direto no Excel em português). */
export function logsParaCsv(logs: Record<string, any>[]): string {
    const linhas = [COLUNAS_CSV.map(([nome]) => nome).join(";")];
    for (const log of logs) linhas.push(COLUNAS_CSV.map(([, ler]) => celula(ler(log))).join(";"));
    return "﻿" + linhas.join("\r\n");
}
