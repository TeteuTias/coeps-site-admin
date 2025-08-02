import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import { connectToDatabase } from '@/app/lib/mongodb';


//
//
export async function PUT(req: NextRequest) {
    // 1. Validar o método da requisição (opcional, mas boa prática)
    if (req.method !== 'PUT') {
        return Response.json({ error: 'Método não permitido' }, { status: 405 });
    }

    try {
        // 2. Extrair os dados do corpo da requisição
        const body = await req.json();
        const { nome, valorAVista, _id, valorBoleto, valorDebito, valorPix } = body;
        // 3. Autenticar e validar os dados recebidos

        if (!ObjectId.isValid(_id)) {
            return Response.json({ error: '_id não válido.' }, { status: 400 });
        }

        if (!nome || typeof nome !== 'string' || nome.trim() === '') {
            return Response.json({ error: 'O nome do lote é obrigatório e deve ser um texto válido.' }, { status: 400 });
        }

        if (valorAVista === undefined || typeof valorAVista !== 'number' || valorAVista < 0) {
            return Response.json({ error: 'O valor à vista é obrigatório e deve ser um número positivo.' }, { status: 400 });
        }

        if (valorBoleto === undefined || typeof valorBoleto !== 'number' || valorBoleto < 0) {
            return Response.json({ error: 'O valor `BOLETO` é obrigatório e deve ser um número positivo.' }, { status: 400 });
        }

        if (valorDebito === undefined || typeof valorDebito !== 'number' || valorDebito < 0) {
            return Response.json({ error: 'O valor `Débito` é obrigatório e deve ser um número positivo.' }, { status: 400 });
        }

        if (valorPix === undefined || typeof valorPix !== 'number' || valorPix < 0) {
            return Response.json({ error: 'O valor `PIX` é obrigatório e deve ser um número positivo.' }, { status: 400 });
        }


        // 4. Colocando no banco de dados
        const { db } = await connectToDatabase();
        const colecao = "ingressos_config"
        const result = await db.collection(colecao).updateOne(
            { _id: new ObjectId(_id) }, {
            $set: {
                nome: nome,
                valorAVista: valorAVista,
            },
        }
        )

        // 7. Verifica se o documento foi encontrado e modificado
        if (result.matchedCount === 0) {
            // Se matchedCount é 0, significa que nenhum documento com o _id fornecido foi encontrado.
            return NextResponse.json({ error: `Documento de configuração com ID ${_id} não encontrado.` }, { status: 404 });
        }

        if (result.modifiedCount === 0 && result.matchedCount === 1) {
            // Se modifiedCount é 0 mas o documento foi encontrado, os dados enviados são os mesmos já existentes no banco.
            // Isso pode ser tratado como sucesso.
            return NextResponse.json({ message: 'Nenhuma alteração necessária, os dados já estavam atualizados.', data: { nome, valorAVista } }, { status: 200 });
        }

        // 6. Retornar uma resposta de sucesso se a validação passar
        return Response.json(
            {
                message: 'Dados recebidos e validados com sucesso!',
                data: {
                    nome,
                    valorAVista,
                    _id
                },
            },
            { status: 200 }
        );

    } catch (error) {
        // Captura erros de parsing do JSON ou outros erros inesperados
        return Response.json({ error: error instanceof Error ? error.message : "Ocorreu algum erro. Recarregue a página e tente novamente." }, { status: 400 });
    }
}