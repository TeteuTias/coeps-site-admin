import { withApiAuthRequired } from "@/app/lib/auth0";
import { connectToDatabase } from '../../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        const { db } = await connectToDatabase();
        const colecaoAvaliacoes = 'trabalhos_avaliacoes';
        const colecaoTrabalhos = 'trabalhos_blob';
        
        const { userId } = await params;

        if (!userId) {
            return NextResponse.json({ 
                "message": "UserId é obrigatório" 
            }, { status: 400 });
        }

     
        const avaliacoes = await db.collection(colecaoAvaliacoes).find({
            userId: userId
        }).toArray();


        const trabalhos = await db.collection(colecaoTrabalhos).find(
            { userId: userId },
            { projection: { "filename": 1, "_id": 1, "url": 1, userId: 1 } }
        ).toArray();

  
        const trabalhosComAvaliacoes = trabalhos.map(trabalho => {
            const avaliacao = avaliacoes.find(av => av.documentId === trabalho._id.toString());
            return {
                ...trabalho,
                avaliacao: avaliacao || {
                    status: 'pendente',
                    avaliadorComentarios: '',
                    dataAvaliacao: null
                }
            };
        });

        return NextResponse.json({
            "trabalhos": trabalhosComAvaliacoes,
            "totalTrabalhos": trabalhos.length,
            "totalAvaliados": avaliacoes.length
        }, { status: 200 });

    } catch {
        return NextResponse.json({ 
            "error": "internal_server_error",
            "message": "Não foi possível consultar as avaliações."
        }, { status: 500 });
    }
});

