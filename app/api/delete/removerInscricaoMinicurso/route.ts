import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server"
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";
import {
    activityChargeIds,
    AsaasNotConfiguredError,
    AsaasUnavailableError,
    cancelOpenActivityCharges,
} from "@/app/lib/payments/activity-charge-cancellation";


export const DELETE = withApiAuthRequired(async function DELETE(request) {
    const data = await request.json().catch(() => null)
    const eventId = String(data?.eventId ?? "")
    const userId = String(data?.userId ?? "")
    if (!ObjectId.isValid(eventId) || !ObjectId.isValid(userId)) {
        return NextResponse.json({ "message": "Inscrição inválida." }, { status: 400 })
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
        const cobrancas = await cancelOpenActivityCharges({
            chargeIds: activityChargeIds(usuario?.pagamento?.lista_pagamentos, eventId),
            apiUrl: process.env.ASAAS_API_URL,
            apiKey: process.env.ASAAS_API_KEY,
        })

        const minicurso = await db.collection(colecao).findOneAndUpdate(
            { _id: new ObjectId(eventId) },  // Encontra o documento com o _id especificado
            {
                $pull: {
                    participants: userId,
                    attendanceList: userId
                }
            },
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
            pagamentoMantido: cobrancas.some((item) => item.resultado === "paga"),
        })
    } catch (error) {
        console.log(error)
        if (error instanceof AsaasNotConfiguredError) {
            console.error("removerInscricaoMinicurso: ASAAS_API_KEY/ASAAS_API_URL ausentes no Admin")
            return NextResponse.json(
                { "message": "O Admin não está configurado para falar com o Asaas (faltam ASAAS_API_KEY e ASAAS_API_URL). A inscrição NÃO foi retirada. Avise quem cuida da Vercel." },
                { status: 503 }
            )
        }
        if (error instanceof AsaasUnavailableError) {
            return NextResponse.json(
                { "message": "Não foi possível cancelar a cobrança no Asaas. A inscrição NÃO foi retirada. Tente novamente em instantes." },
                { status: 502 }
            )
        }
        return NextResponse.json({ "message": "Ocorreu Algum erro" }, { status: 500 })
    }



})
