import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { IAcademicWorks } from '@/app/lib/types/academicWorks/academicWorks.t';
import { IUser } from '@/app/lib/types/user/user.t';
import { ObjectId } from 'bson';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, response) {
    try {
        const { db } = await connectToDatabase();
        const colecaoTrabalhos = 'Dados_do_trabalho';
        const colecaoUsuarios = "usuarios"

        // Buscar todos os trabalhos
        const trabalhos: IAcademicWorks[] = await db.collection(colecaoTrabalhos).find(
            {},
        ).toArray();

        const users: IUser = await db.collection(colecaoUsuarios).find(
            {
                _id: { $in: trabalhos.map((trabalho) => { return new ObjectId(trabalho.userId) }) }
            },
        ).toArray();



        return NextResponse.json({
            "data": trabalhos,
            "users": users,
        }, { status: 200 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({ "message": error instanceof Error ? error.message : error }, { status: 500 });
    }
});

