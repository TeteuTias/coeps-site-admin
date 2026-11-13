// Registro de auditoria (aba Logs). Toda ação que muda dado no Admin passa por aqui:
// withApiAuthRequired grava uma linha por pedido POST/PUT/PATCH/DELETE, o proxy grava entrada e saída
// de conta, e as rotas mais sensíveis anexam o "antes/depois" com anotarAuditoria().
// O site do congresso grava na MESMA coleção (inscrições, PIX, webhooks, liberação de vaga).
//
// Os logs só são inseridos. O painel não tem rota que altere ou apague logs.
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";

export const COLECAO_LOGS = "logs_auditoria";

export type Categoria =
    | "inscricao"
    | "pagamento"
    | "minicurso"
    | "palestra"
    | "presenca"
    | "usuario"
    | "financeiro"
    | "trabalhos"
    | "acesso"
    | "logs"
    | "outro";

export type Origem = "admin" | "site" | "webhook" | "sistema";

export interface Ator {
    tipo: "admin" | "congressista" | "asaas" | "sistema";
    id: string | null;
    conta: string | null;
    email: string | null;
    nome: string | null;
}

export interface Alvo {
    usuarioId?: string | null;
    usuarioNome?: string | null;
    minicursoId?: string | null;
    minicursoNome?: string | null;
    cobrancaId?: string | null;
    colecao?: string | null;
    registroId?: string | null;
}

export interface LogAuditoria {
    _id?: ObjectId | string;
    em: Date;
    origem: Origem;
    acao: string;
    categoria: Categoria;
    resumo: string;
    sucesso: boolean;
    status: number | null;
    ator: Ator;
    alvo: Alvo;
    antes?: unknown;
    depois?: unknown;
    detalhes?: unknown;
    requisicao?: {
        metodo: string;
        rota: string;
        ip: string | null;
        userAgent: string | null;
        corpo?: unknown;
        duracaoMs?: number;
    };
}

// Contas do Admin (logins compartilhados): nome legível para a tela.
export const CONTAS_ADMIN: Record<string, string> = {
    "6a8799078ecd649be9bdb061": "Admin",
    "6a87991a310d49dafb8d113b": "Apoio",
    "6a8799158b3fe756dd02f487": "Certificados",
    "6a87990e9d8d0385e0a77083": "Científica",
};

export function nomeDaConta(sub: unknown): string | null {
    if (typeof sub !== "string" || !sub) return null;
    const id = sub.replace(/^auth0\|/, "");
    return CONTAS_ADMIN[id] ?? null;
}

const CHAVE_SENSIVEL = /(cpf|senha|password|passwd|token|secret|segredo|authorization|cookie|card|cartao|cartão|cvv|ccv|creditcard|holder|api[_-]?key|access_token)/i;
const MAX_TEXTO = 2000;
const MAX_ITENS = 200;
const MAX_IDS = 5000;
const MAX_PROFUNDIDADE = 6;

/** Cópia segura para gravar: tira CPF, senhas, tokens e cartão; corta textos e listas grandes. */
export function sanitizar(valor: unknown, profundidade = 0): unknown {
    if (valor == null) return valor;
    if (valor instanceof Date) return valor;
    if (valor instanceof ObjectId) return valor.toString();
    if (typeof valor === "string") return valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO)}… (+${valor.length - MAX_TEXTO})` : valor;
    if (typeof valor !== "object") return valor;
    if (profundidade >= MAX_PROFUNDIDADE) return "[…]";
    if (Array.isArray(valor)) {
        // Lista de ids (ex.: inscritos de uma atividade apagada) entra inteira: é o que permite reconstruir.
        const limite = valor.every((v) => v == null || typeof v !== "object" || v instanceof ObjectId) ? MAX_IDS : MAX_ITENS;
        const itens = valor.slice(0, limite).map((v) => sanitizar(v, profundidade + 1));
        if (valor.length > limite) itens.push(`… (+${valor.length - limite} itens)`);
        return itens;
    }
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
        // _bsontype etc. de tipos do Mongo
        if (chave.startsWith("$")) continue;
        saida[chave] = CHAVE_SENSIVEL.test(chave) ? "[oculto]" : sanitizar(v, profundidade + 1);
    }
    return saida;
}

export function ipDaRequisicao(headers: Headers): string | null {
    const encaminhado = headers.get("x-forwarded-for");
    if (encaminhado) return encaminhado.split(",")[0].trim() || null;
    return headers.get("x-real-ip") || null;
}

interface Classificacao {
    acao: string;
    categoria: Categoria;
    resumo: string;
}

// Rotas do Admin → ação legível. A primeira que casar vale.
const ROTAS: { padrao: RegExp; metodo?: string; acao: string; categoria: Categoria; resumo: string }[] = [
    { padrao: /^\/api\/put\/minicursos\/alterarInformacoes/, acao: "minicurso.editar", categoria: "minicurso", resumo: "Editou as informações da atividade" },
    { padrao: /^\/api\/post\/criarNovoMinicurso/, acao: "minicurso.criar", categoria: "minicurso", resumo: "Criou uma atividade" },
    { padrao: /^\/api\/delete\/minicurso/, acao: "minicurso.apagar", categoria: "minicurso", resumo: "Apagou uma atividade" },
    { padrao: /^\/api\/delete\/removerInscricaoMinicurso/, acao: "inscricao.remover", categoria: "inscricao", resumo: "Removeu a inscrição de um congressista do minicurso" },
    { padrao: /^\/api\/post\/darPresencaPalestra/, acao: "presenca.palestra.dar", categoria: "presenca", resumo: "Deu presença na palestra" },
    { padrao: /^\/api\/post\/retirarPresencaPalestra/, acao: "presenca.palestra.retirar", categoria: "presenca", resumo: "Retirou a presença da palestra" },
    { padrao: /^\/api\/post\/darPresenca/, acao: "presenca.dar", categoria: "presenca", resumo: "Deu presença no minicurso (também inscreve)" },
    { padrao: /^\/api\/post\/retirarPresenca/, acao: "presenca.retirar", categoria: "presenca", resumo: "Retirou a presença do minicurso" },
    { padrao: /^\/api\/put\/usuario\/atualizarUsuario/, acao: "usuario.editar", categoria: "usuario", resumo: "Editou os dados do congressista" },
    { padrao: /^\/api\/put\/usuarios\/[^/]+\/participacao-remota/, acao: "usuario.participacao_remota", categoria: "usuario", resumo: "Alterou a participação remota do congressista" },
    { padrao: /^\/api\/delete\/pagamentos\/removerInscricao/, acao: "pagamento.remover_inscricao", categoria: "pagamento", resumo: "Removeu a inscrição (pagamento) do congressista" },
    { padrao: /^\/api\/delete\/pagamentos\/historico/, acao: "financeiro.apagar_historico", categoria: "financeiro", resumo: "Apagou histórico de pagamento" },
    { padrao: /^\/api\/delete\/pagamentos\/codigos/, acao: "financeiro.codigo.apagar", categoria: "financeiro", resumo: "Apagou código de pagamento" },
    { padrao: /^\/api\/put\/pagamentos\/codigos/, acao: "financeiro.codigo.editar", categoria: "financeiro", resumo: "Editou código de pagamento" },
    { padrao: /^\/api\/post\/pagamentos\/codigos/, acao: "financeiro.codigo.gerar", categoria: "financeiro", resumo: "Gerou códigos de pagamento" },
    { padrao: /^\/api\/post\/pagamentos\/loteAutomatico/, acao: "financeiro.lote.criar", categoria: "financeiro", resumo: "Criou lote automático" },
    { padrao: /^\/api\/post\/pagamentos\/profissionaisSaude/, acao: "financeiro.suspensao", categoria: "financeiro", resumo: "Alterou suspensão de profissional da saúde" },
    { padrao: /^\/api\/put\/pagamentos\//, acao: "financeiro.configuracao", categoria: "financeiro", resumo: "Alterou configuração de pagamento" },
    { padrao: /^\/api\/post\/(avaliar-trabalho|trabalhos|upload-trabalho)/, acao: "trabalhos.alterar", categoria: "trabalhos", resumo: "Alterou trabalho científico" },
];

export function classificarRota(metodo: string, rota: string): Classificacao {
    for (const r of ROTAS) {
        if (r.padrao.test(rota) && (!r.metodo || r.metodo === metodo)) {
            const extra = r.acao === "trabalhos.alterar" ? `.${rota.split("/").slice(3).join(".")}` : "";
            return { acao: r.acao + extra, categoria: r.categoria, resumo: r.resumo };
        }
    }
    return { acao: `api.${metodo.toLowerCase()}`, categoria: "outro", resumo: `${metodo} ${rota}` };
}

const HEX24 = /^[0-9a-f]{24}$/i;

/** Ids de pessoa e atividade no corpo ou na rota. */
export function alvoDoPedido(rota: string, corpo: unknown): Alvo {
    const c = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : {};
    const texto = (v: unknown) => (typeof v === "string" && HEX24.test(v.trim()) ? v.trim().toLowerCase() : null);
    const alvo: Alvo = {};
    const usuario = texto(c.userId) ?? texto(c.usuarioId) ?? (rota.match(/\/(?:usuario|usuarios|removerInscricao)\/([0-9a-f]{24})/i)?.[1] ?? null);
    if (usuario) alvo.usuarioId = usuario.toLowerCase();
    const atividade = texto(c.eventId) ?? (/minicurso/i.test(rota) ? texto(c._id) : null);
    if (atividade) alvo.minicursoId = atividade;
    return alvo;
}

// ---- anotação de antes/depois feita pela rota, lida pelo wrapper ----
export interface Anotacao {
    acao?: string;
    categoria?: Categoria;
    resumo?: string;
    alvo?: Alvo;
    antes?: unknown;
    depois?: unknown;
    detalhes?: unknown;
}
const anotacoes = new WeakMap<Request, Anotacao>();

export function anotarAuditoria(request: Request, anotacao: Anotacao) {
    const atual = anotacoes.get(request) ?? {};
    anotacoes.set(request, { ...atual, ...anotacao, alvo: { ...(atual.alvo ?? {}), ...(anotacao.alvo ?? {}) } });
}

export function lerAnotacao(request: Request): Anotacao | undefined {
    return anotacoes.get(request);
}

// ---- gravação ----
let indicesCriados = false;

async function garantirIndices(db: Db) {
    if (indicesCriados) return;
    indicesCriados = true;
    try {
        const c = db.collection(COLECAO_LOGS);
        await Promise.all([
            c.createIndex({ em: -1 }, { name: "em" }),
            c.createIndex({ acao: 1, em: -1 }, { name: "acao_em" }),
            c.createIndex({ categoria: 1, em: -1 }, { name: "categoria_em" }),
            c.createIndex({ "ator.id": 1, em: -1 }, { name: "ator_em" }),
            c.createIndex({ "alvo.usuarioId": 1, em: -1 }, { name: "alvo_usuario_em" }),
            c.createIndex({ "alvo.minicursoId": 1, em: -1 }, { name: "alvo_minicurso_em" }),
        ]);
    } catch (error) {
        indicesCriados = false;
        console.error("auditoria: falha ao criar índices", error);
    }
}

/** Nomes da pessoa e da atividade no momento da ação (o log continua legível se apagarem o registro). */
export async function completarNomes(db: Db, alvo: Alvo): Promise<Alvo> {
    const saida = { ...alvo };
    try {
        const [usuario, minicurso] = await Promise.all([
            saida.usuarioId && !saida.usuarioNome && HEX24.test(saida.usuarioId)
                ? db.collection("usuarios").findOne({ _id: new ObjectId(saida.usuarioId) }, { projection: { "informacoes_usuario.nome": 1 } })
                : null,
            saida.minicursoId && !saida.minicursoNome && HEX24.test(saida.minicursoId)
                ? db.collection("minicursos").findOne({ _id: new ObjectId(saida.minicursoId) }, { projection: { name: 1 } })
                : null,
        ]);
        if (usuario?.informacoes_usuario?.nome) saida.usuarioNome = String(usuario.informacoes_usuario.nome);
        if (minicurso?.name) saida.minicursoNome = String(minicurso.name);
    } catch {
        // nome é só conveniência
    }
    return saida;
}

/**
 * Insere o log. Nunca lança: falha de log não pode desfazer a ação do usuário,
 * mas fica no console da Vercel com o conteúdo, para não perder o rastro.
 */
export async function gravarLog(db: Db, log: LogAuditoria): Promise<boolean> {
    try {
        void garantirIndices(db);
        const alvo = await completarNomes(db, log.alvo ?? {});
        const documento = { ...log, alvo, antes: sanitizar(log.antes), depois: sanitizar(log.depois), detalhes: sanitizar(log.detalhes) };
        if (documento.requisicao) documento.requisicao = { ...documento.requisicao, corpo: sanitizar(documento.requisicao.corpo) };
        for (const chave of ["antes", "depois", "detalhes"] as const) if (documento[chave] === undefined) delete documento[chave];
        await db.collection(COLECAO_LOGS).insertOne(documento as never);
        return true;
    } catch (error) {
        console.error("auditoria: log NÃO gravado", JSON.stringify({ acao: log.acao, em: log.em, ator: log.ator?.id, alvo: log.alvo }), error);
        return false;
    }
}

export function atorAdmin(user: { sub?: unknown; email?: unknown; name?: unknown } | null | undefined): Ator {
    const sub = typeof user?.sub === "string" ? user.sub : "";
    return {
        tipo: "admin",
        id: sub ? sub.replace(/^auth0\|/, "") : null,
        conta: nomeDaConta(sub),
        email: typeof user?.email === "string" ? user.email : null,
        nome: typeof user?.name === "string" ? user.name : null,
    };
}

/** Linha de log de um pedido de API do Admin (montagem pura, testável). */
export function montarLogDePedido(input: {
    metodo: string;
    rota: string;
    corpo: unknown;
    status: number | null;
    usuario: { sub?: unknown; email?: unknown; name?: unknown } | null | undefined;
    ip: string | null;
    userAgent: string | null;
    inicio: number;
    fim: number;
    anotacao?: Anotacao;
    erro?: string;
}): LogAuditoria {
    const base = classificarRota(input.metodo, input.rota);
    const a = input.anotacao ?? {};
    const sucesso = input.status != null && input.status < 400 && !input.erro;
    return {
        em: new Date(input.inicio),
        origem: "admin",
        acao: a.acao ?? base.acao,
        categoria: a.categoria ?? base.categoria,
        resumo: (a.resumo ?? base.resumo) + (sucesso ? "" : ` (falhou${input.status ? `: HTTP ${input.status}` : ""})`),
        sucesso,
        status: input.status,
        ator: atorAdmin(input.usuario),
        alvo: { ...alvoDoPedido(input.rota, input.corpo), ...(a.alvo ?? {}) },
        antes: a.antes,
        depois: a.depois,
        detalhes: input.erro ? { ...(a.detalhes as object ?? {}), erro: input.erro } : a.detalhes,
        requisicao: {
            metodo: input.metodo,
            rota: input.rota,
            ip: input.ip,
            userAgent: input.userAgent,
            corpo: input.corpo,
            duracaoMs: Math.max(0, input.fim - input.inicio),
        },
    };
}

export const METODOS_AUDITADOS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Lê o corpo de uma cópia do pedido, sem consumir o original. */
export async function lerCorpoParaLog(request: Request): Promise<unknown> {
    try {
        const tipo = request.headers.get("content-type") ?? "";
        if (/multipart\/form-data/i.test(tipo)) return "[arquivo/formulário]";
        const texto = await request.clone().text();
        if (!texto) return null;
        try { return JSON.parse(texto); } catch { return texto.slice(0, MAX_TEXTO); }
    } catch {
        return null;
    }
}
