import { getSession, withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";
import {
    activityChargeIds,
    AsaasNotConfiguredError,
    AsaasUnavailableError,
    cancelOpenActivityCharges,
    noRefundCancellationRecord,
} from "@/app/lib/payments/activity-charge-cancellation";


export const DELETE = withApiAuthRequired(async function DELETE(request) {
    const data = await request.json().catch(() => null)
    const eventId = String(data?.eventId ?? "")
    const userId = String(data?.userId ?? "")
    // semEstorno: o congressista aceitou perder o valor; sai do minicurso sem nenhuma chamada ao Asaas.
    const semEstorno = data?.semEstorno === true
    if (!ObjectId.isValid(eventId) || !ObjectId.isValid(userId)) {
        return NextResponse.json({ "message": "Inscrição inválida." }, { status: 400 })
    }
    let operador = ""
    if (semEstorno) {
        const session = await getSession(request).catch(() => null)
        operador = String(session?.user?.sub ?? "").replace(/^auth0\|/, "")
        if (!operador) {
            return NextResponse.json({ "message": "Sessão expirada. Entre de novo para cancelar." }, { status: 401 })
        }
    }
    const { db } = await connectToDatabase();
    const colecao = 'minicursos'


    try {
        // A cobrança do pacote fica na atividade principal: remover só a etapa deixaria a cobrança aberta.
        const atividade = await db.collection(colecao).findOne(
            { _id: new ObjectId(eventId) },
            { projection: { somenteViaPacote: 1 } }
        )
        if (atividade?.somenteViaPacote) {
            return NextResponse.json(
                { "message": "Esta etapa faz parte de um pacote. Remova a inscrição pela lista da atividade principal (a prática), que tira a pessoa de todas as etapas e cancela a cobrança." },
                { status: 400 }
            )
        }

        // Primeiro a cobrança: se o Asaas falhar, a inscrição continua e o admin tenta de novo.
        const usuario = await db.collection('usuarios').findOne(
            { _id: new ObjectId(userId) },
            { projection: { 'pagamento.lista_pagamentos': 1 } }
        )
        const chargeIds = activityChargeIds(usuario?.pagamento?.lista_pagamentos, eventId)
        const cobrancas = semEstorno ? [] : await cancelOpenActivityCharges({
            chargeIds,
            apiUrl: process.env.ASAAS_API_URL,
            apiKey: process.env.ASAAS_API_KEY,
        })

        const retirar = { participants: userId, attendanceList: userId }
        const minicurso = await db.collection(colecao).findOneAndUpdate(
            // Sem estorno só grava o registro se a pessoa ainda estava inscrita (clique duplo não duplica).
            semEstorno ? { _id: new ObjectId(eventId), participants: userId } : { _id: new ObjectId(eventId) },
            semEstorno
                ? { $pull: retirar, $push: { cancelamentosSemEstorno: noRefundCancellationRecord(userId, chargeIds, operador) } }
                : { $pull: retirar },
            { projection: { incluiAtividades: 1 } }
        );

        // Pacote (ex.: APH Tático): sai também das etapas incluídas, como no site.
        const incluidas = (Array.isArray(minicurso?.incluiAtividades) ? minicurso.incluiAtividades : [])
            .filter((id: unknown) => ObjectId.isValid(String(id)))
            .map((id: unknown) => new ObjectId(String(id)))
        if (incluidas.length > 0) {
            await db.collection(colecao).updateMany(
                { _id: { $in: incluidas } },
                { $pull: { participants: userId } }
            )
        }

        return NextResponse.json({
            data: { matchedCount: minicurso ? 1 : 0 },
            cobrancas,
            semEstorno,
            pagamentoMantido: cobrancas.some((item) => item.resultado === "paga"),
        })
    } catch (error) {
        console.log(error)
        // withApiAuthRequired troca qualquer resposta 5xx por um texto genérico. Estes dois casos precisam
        // chegar à tela com a mensagem certa, então respondem 424 (dependência externa falhou).
        if (error instanceof AsaasNotConfiguredError) {
            console.error("removerInscricaoMinicurso: ASAAS_API_KEY/ASAAS_API_URL ausentes no Admin")
            return NextResponse.json(
                { "message": "O Admin não está configurado para falar com o Asaas (faltam ASAAS_API_KEY e ASAAS_API_URL). A inscrição NÃO foi retirada. Avise quem cuida da Vercel." },
                { status: 424 }
            )
        }
        if (error instanceof AsaasUnavailableError) {
            return NextResponse.json(
                { "message": "Não foi possível cancelar a cobrança no Asaas. A inscrição NÃO foi retirada. Tente novamente em instantes." },
                { status: 424 }
            )
        }
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }



})
