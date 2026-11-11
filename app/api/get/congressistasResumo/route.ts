import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '@/app/lib/mongodb';
import {
    ADMIN_USER_SUMMARY_PROJECTION,
    normalizeAdminUserList,
} from '@/app/lib/users/admin-user-contract';
import { NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { loadAdminRemoteParticipationMap } from '@/app/lib/users/admin-remote-work-server';

export const dynamic = 'force-dynamic'

// Mesmos critérios das estatísticas da aba Congressistas, sem devolver a lista de usuários.
export const GET = withApiAuthRequired(async function GET() {
    try {
        const { db: untypedDb } = await connectToDatabase();
        const db = untypedDb as Db

        const response = await db.collection('usuarios').find(
            {},
            { projection: ADMIN_USER_SUMMARY_PROJECTION },
        ).toArray()

        const participationByUser = await loadAdminRemoteParticipationMap(db, response)
        const users = normalizeAdminUserList(response.map(user => ({
            ...user,
            participacao: participationByUser.get(String(user._id)),
        })))
        if (!users) {
            return NextResponse.json(
                { error: "invalid_user_data", message: "Os dados de usuários estão em formato inválido." },
                { status: 500 },
            )
        }

        const paymentTypes = Array.from(new Set(
            users
                .map(user => user.pagamento.tipo_pagamento)
                .filter((type): type is string => Boolean(type)),
        ))

        return NextResponse.json({
            total: users.length,
            inscritos: users.filter(user => user.pagamento.situacao === 1).length,
            naoInscritos: users.filter(user => user.pagamento.situacao === 0).length,
            pagamentoAberto: users.filter(user => user.pagamento.situacao === 2).length,
            participantesRemotos: users.filter(user => ["REMOTE", "BOTH"].includes(user.participacao.mode)).length,
            paymentTypes,
        }, { status: 200 })
    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu algum erro desconhecido. Recarregue e tente novamente." }, { status: 500 })
    }
})
