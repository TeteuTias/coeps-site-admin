import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '@/app/lib/mongodb';
import {
    ADMIN_USER_SUMMARY_PROJECTION,
    filterAdminUsers,
    normalizeAdminUserList,
} from '@/app/lib/users/admin-user-contract';
import {
    CONGRESSISTAS_PAGE_SIZE,
    buildCongressistasMongoFilter,
    parseCongressistasBuscaParams,
} from '@/app/lib/users/congressistas-busca';
import { NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { loadAdminRemoteParticipationMap } from '@/app/lib/users/admin-remote-work-server';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request) {
    const parsed = parseCongressistasBuscaParams(new URL(request.url).searchParams)
    if (!parsed.ok) {
        return NextResponse.json({ error: "invalid_query", message: parsed.message }, { status: 400 })
    }
    const params = parsed.value

    try {
        const { db: untypedDb } = await connectToDatabase();
        const db = untypedDb as Db

        const found = await db.collection('usuarios').find(
            buildCongressistasMongoFilter(params),
            { projection: ADMIN_USER_SUMMARY_PROJECTION },
        ).toArray()

        const participationByUser = await loadAdminRemoteParticipationMap(db, found)
        const users = normalizeAdminUserList(found.map(user => ({
            ...user,
            participacao: participationByUser.get(String(user._id)),
        })))
        if (!users) {
            return NextResponse.json(
                { error: "invalid_user_data", message: "Os dados de usuários estão em formato inválido." },
                { status: 500 },
            )
        }

        const filtered = filterAdminUsers(users, {
            selectedParticipationMode: params.mode,
            startDate: params.startDate,
            endDate: params.endDate,
        }).sort((a, b) => (a.informacoes_usuario.nome ?? "").localeCompare(b.informacoes_usuario.nome ?? "", "pt-BR"))

        const total = filtered.length
        const totalPages = Math.max(1, Math.ceil(total / CONGRESSISTAS_PAGE_SIZE))
        const page = Math.min(params.page, totalPages)
        const data = filtered.slice((page - 1) * CONGRESSISTAS_PAGE_SIZE, page * CONGRESSISTAS_PAGE_SIZE)

        return NextResponse.json({ data, total, page, pageSize: CONGRESSISTAS_PAGE_SIZE, totalPages }, { status: 200 })
    } catch (error) {
        return NextResponse.json({ "message": error instanceof Error ? error.message : "Ocorreu algum erro desconhecido. Recarregue e tente novamente." }, { status: 500 })
    }
})
