import { getSession, withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongodb";
import { isAdminSub } from "@/app/lib/user/userPermissionsServerSide";
import { encontrarPagosSemVaga, type EventoWebhookLido } from "@/app/lib/auditoria/pagos-sem-vaga";

export const dynamic = "force-dynamic";

// Quem pagou minicurso e não está inscrito. Só leitura; ninguém é reinscrito por aqui.
export const GET = withApiAuthRequired(async function GET(request) {
    const session = await getSession(request).catch(() => null);
    if (!isAdminSub(session?.user?.sub)) {
        return NextResponse.json({ error: "forbidden", message: "Somente a conta Admin vê este relatório." }, { status: 403 });
    }
    const { db } = await connectToDatabase();
    const minicursos = await db.collection("minicursos").find({}, {
        projection: {
            name: 1, value: 1, isFree: 1, maxParticipants: 1, participants: 1, attendanceList: 1,
            incluiAtividades: 1, somenteViaPacote: 1, timeline: 1, _nSerie: 1, cancelamentosSemEstorno: 1,
        },
    }).toArray();
    const usuarios = await db.collection("usuarios").find(
        { "pagamento.lista_pagamentos": { $elemMatch: { _type: "activity", status: { $in: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"] } } } },
        { projection: { "informacoes_usuario.nome": 1, "informacoes_usuario.email": 1, "pagamento.lista_pagamentos": 1 } },
    ).toArray();
    const ids: string[] = [];
    for (const u of usuarios) for (const p of (u.pagamento?.lista_pagamentos ?? [])) if (p?._type === "activity" && typeof p.id === "string") ids.push(p.id);
    const eventos = ids.length === 0 ? [] : await db.collection("pagamentos.webhook_eventos_v2").find(
        { paymentId: { $in: ids } },
        { projection: { eventType: 1, paymentId: 1, receivedAt: 1, "payload.payment.paymentDate": 1, "payload.payment.clientPaymentDate": 1, "payload.payment.confirmedDate": 1 } },
    ).toArray();
    const relatorio = encontrarPagosSemVaga({ minicursos, usuarios, eventos: eventos as EventoWebhookLido[] });
    return NextResponse.json(relatorio);
});
