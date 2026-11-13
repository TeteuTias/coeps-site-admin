// Relatório: quem pagou um minicurso e não está mais inscrito nele. SOMENTE LEITURA.
//
// Uso (na pasta do Admin, com as variáveis do banco):
//   MONGODB_URI=... MONGODB_DB=... node --experimental-strip-types scripts/auditoria/pagos-sem-vaga.ts [pasta-de-saida]
// Opcional, para conferir cada cobrança no Asaas (só GET, nada é alterado):
//   ASAAS_API_URL=https://api.asaas.com/v3 ASAAS_API_KEY=...
//
// Grava <pasta>/pagos-sem-vaga.json e .csv (com nome e e-mail, sem CPF) e imprime um resumo
// com o e-mail mascarado. Nenhuma escrita no Mongo nem no Asaas.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MongoClient, ReadPreference } from "mongodb";
import { encontrarPagosSemVaga, mascararEmail, type EventoWebhookLido, type LinhaPagoSemVaga } from "../../app/lib/auditoria/pagos-sem-vaga.ts";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
    console.error("Defina MONGODB_URI e MONGODB_DB.");
    process.exit(1);
}
const saida = resolve(process.argv[2] || "relatorio-pagos-sem-vaga");

const client = new MongoClient(uri, { readPreference: ReadPreference.SECONDARY_PREFERRED, maxPoolSize: 2 });
await client.connect();
try {
    const db = client.db(dbName);
    const minicursos = await db.collection("minicursos").find({}, {
        projection: {
            name: 1, value: 1, isFree: 1, maxParticipants: 1, participants: 1, attendanceList: 1,
            incluiAtividades: 1, somenteViaPacote: 1, timeline: 1, _nSerie: 1, cancelamentosSemEstorno: 1,
        },
    }).toArray();
    const usuarios = await db.collection("usuarios").find(
        { "pagamento.lista_pagamentos": { $elemMatch: { _type: "activity" } } },
        { projection: { "informacoes_usuario.nome": 1, "informacoes_usuario.email": 1, "pagamento.lista_pagamentos": 1 } },
    ).toArray();
    const ids = new Set<string>();
    for (const u of usuarios) for (const p of (u.pagamento?.lista_pagamentos ?? [])) if (p?._type === "activity" && p.id) ids.add(String(p.id));
    const eventos = ids.size === 0 ? [] : await db.collection("pagamentos.webhook_eventos_v2").find(
        { paymentId: { $in: [...ids] } },
        { projection: { eventType: 1, paymentId: 1, receivedAt: 1, "payload.payment": 1 } },
    ).toArray();

    const relatorio = encontrarPagosSemVaga({ minicursos, usuarios, eventos: eventos as EventoWebhookLido[] });

    // Conferência no Asaas (opcional, só GET).
    const apiUrl = process.env.ASAAS_API_URL?.replace(/\/+$/, "");
    const apiKey = process.env.ASAAS_API_KEY;
    const asaas: Record<string, string> = {};
    if (apiUrl && apiKey) {
        for (const linha of relatorio.linhas) {
            try {
                const r = await fetch(`${apiUrl}/payments/${encodeURIComponent(linha.cobrancaId)}`, {
                    headers: { access_token: apiKey, "User-Agent": "cieps-admin-auditoria" },
                    signal: AbortSignal.timeout(8000),
                });
                const j = r.ok ? await r.json() as Record<string, unknown> : null;
                asaas[linha.cobrancaId] = j ? `${j.deleted ? "DELETED" : j.status}${j.paymentDate ? ` em ${j.paymentDate}` : ""}` : `HTTP ${r.status}`;
            } catch (e) {
                asaas[linha.cobrancaId] = `erro: ${e instanceof Error ? e.message : e}`;
            }
            await new Promise((ok) => setTimeout(ok, 250)); // respeita o limite do Asaas
        }
    }

    mkdirSync(saida, { recursive: true });
    writeFileSync(join(saida, "pagos-sem-vaga.json"), JSON.stringify({ ...relatorio, asaas }, null, 2));
    const colunas: (keyof LinhaPagoSemVaga)[] = ["nome", "email", "minicurso", "etapaFaltando", "valor", "pagoEm", "causa", "sumiuEm", "detalheCausa", "vagasLivres", "minicursoJaComecou", "cobrancaId", "statusGravado", "usuarioId", "minicursoId"];
    const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    writeFileSync(join(saida, "pagos-sem-vaga.csv"), "﻿" + [
        [...colunas, "asaas"].join(";"),
        ...relatorio.linhas.map((l) => [...colunas.map((c) => csv(l[c])), csv(asaas[l.cobrancaId])].join(";")),
    ].join("\n"));

    const br = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "?";
    console.log(`\nMinicursos pagos (inscritos/vagas, presenças, última edição pelo _nSerie, pagos sem vaga):`);
    for (const m of relatorio.minicursos) {
        console.log(`- ${m.minicurso}: ${m.inscritos}/${m.vagas ?? "?"}, presenças ${m.presencas}, editado ${br(m.nSerieCriadoEm)}, pagas ${m.cobrancasPagas}, SEM VAGA ${m.pagosSemVaga}`);
    }
    console.log(`\n${relatorio.linhas.length} pessoa(s) pagaram e não estão inscritas:`);
    for (const l of relatorio.linhas) {
        console.log(`- ${l.nome} (${mascararEmail(l.email)}) | ${l.minicurso}${l.etapaFaltando ? ` [etapa: ${l.etapaFaltando}]` : ""} | R$ ${l.valor ?? "?"} | pago ${br(l.pagoEm)} | ${l.causa} ${br(l.sumiuEm)} | vagas livres ${l.vagasLivres ?? "?"}${asaas[l.cobrancaId] ? ` | Asaas ${asaas[l.cobrancaId]}` : ""}`);
    }
    console.log(`\nArquivos: ${saida}`);
} finally {
    await client.close();
}
