import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';
import { getSession } from '@auth0/nextjs-auth0';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, response) {
    try {
        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'Dados_do_trabalho';

        // Buscar todos os trabalhos
        const trabalhos = await db.collection(colecaoTrabalhos).find(
            {},
        ).toArray();

        return NextResponse.json({
            "data": trabalhos,
        }, { status: 200 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({ "message": error instanceof Error ? error.message : error }, { status: 500 });
    }
});

