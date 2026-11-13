import { getSession, withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongodb";
import { isAdminSub } from "@/app/lib/user/userPermissionsServerSide";
import { atorAdmin, COLECAO_LOGS, gravarLog, ipDaRequisicao, CONTAS_ADMIN } from "@/app/lib/auditoria/registro";
import { LIMITE_EXPORTACAO, lerFiltros, logsParaCsv, montarConsulta } from "@/app/lib/auditoria/consulta";

export const dynamic = "force-dynamic";

// Aba Logs: só leitura. Não existe rota para editar ou apagar logs.
export const GET = withApiAuthRequired(async function GET(request) {
    const session = await getSession(request).catch(() => null);
    if (!isAdminSub(session?.user?.sub)) {
        return NextResponse.json({ error: "forbidden", message: "Somente a conta Admin vê os logs." }, { status: 403 });
    }
    const url = new URL(request.url);
    const { db } = await connectToDatabase();
    const colecao = db.collection(COLECAO_LOGS);

    if (url.searchParams.get("opcoes") === "1") {
        const [acoes, minicursos] = await Promise.all([
            colecao.distinct("acao"),
            db.collection("minicursos").find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray(),
        ]);
        return NextResponse.json({
            acoes: (acoes as string[]).filter(Boolean).sort(),
            contas: Object.entries(CONTAS_ADMIN).map(([id, nome]) => ({ id, nome })),
            minicursos: minicursos.map((m: { _id: unknown; name?: unknown }) => ({ id: String(m._id), nome: String(m.name ?? "") })),
        });
    }

    const filtros = lerFiltros(url.searchParams);
    const consulta = montarConsulta(filtros);
    const ordem = { em: -1 as const, _id: -1 as const };

    if (url.searchParams.get("formato") === "csv") {
        const logs = await colecao.find(consulta).sort(ordem).limit(LIMITE_EXPORTACAO).toArray();
        // Exportar também fica registrado (quem levou o quê).
        await gravarLog(db, {
            em: new Date(),
            origem: "admin",
            acao: "logs.exportar",
            categoria: "logs",
            resumo: `Exportou ${logs.length} linha(s) de log`,
            sucesso: true,
            status: 200,
            ator: atorAdmin(session?.user),
            alvo: {},
            detalhes: { filtros: Object.fromEntries(url.searchParams) },
            requisicao: { metodo: "GET", rota: url.pathname, ip: ipDaRequisicao(request.headers), userAgent: request.headers.get("user-agent") },
        });
        const nome = `logs-cieps-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
        // Resposta em JSON (o wrapper só aceita JSON): a tela monta o arquivo.
        return NextResponse.json({ arquivo: nome, csv: logsParaCsv(logs), linhas: logs.length, limitado: logs.length >= LIMITE_EXPORTACAO });
    }

    const [total, logs] = await Promise.all([
        colecao.countDocuments(consulta),
        colecao.find(consulta).sort(ordem).skip((filtros.pagina - 1) * filtros.tamanho).limit(filtros.tamanho).toArray(),
    ]);
    return NextResponse.json({
        data: logs.map((l: { _id: unknown }) => ({ ...l, _id: String(l._id) })),
        total,
        pagina: filtros.pagina,
        tamanho: filtros.tamanho,
        totalPaginas: Math.max(1, Math.ceil(total / filtros.tamanho)),
    });
});
