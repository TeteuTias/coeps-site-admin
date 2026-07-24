import { withApiAuthRequired } from "@/app/lib/auth0";
import { NextResponse } from "next/server";
import { ObjectId } from 'mongodb';
import { connectToDatabase } from "@/app/lib/mongodb";

// A função não precisa mais do segundo parâmetro 'context', pois a rota não é mais dinâmica.
export const PUT = withApiAuthRequired(async function PUT(request) {
    try {
        const { db } = await connectToDatabase();
        const colecao = 'usuarios';

        // 1. Extrair todos os dados do corpo da requisição
        const data = await request.json();
        const { userId, ...fieldsToUpdate } = data; // Separa o userId do resto dos campos

        // 2. Validar o userId recebido no corpo da requisição
        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json({ message: "O campo 'userId' é obrigatório no corpo da requisição e deve ser válido." }, { status: 400 });
        }

        // Se nenhum outro campo além do userId foi enviado
        if (Object.keys(fieldsToUpdate).length === 0) {
            return NextResponse.json({ message: "Nenhum dado enviado para atualização." }, { status: 400 });
        }

        // 3. Montar dinamicamente o objeto de atualização
        const updateFields: { [key: string]: any } = {};

        // A lógica aqui permanece a mesma, mas usa o objeto 'fieldsToUpdate'
        if (fieldsToUpdate.nome !== undefined) updateFields['informacoes_usuario.nome'] = fieldsToUpdate.nome;
        if (fieldsToUpdate.email !== undefined) updateFields['informacoes_usuario.email'] = fieldsToUpdate.email;
        if (fieldsToUpdate.numero_telefone !== undefined) updateFields['informacoes_usuario.numero_telefone'] = fieldsToUpdate.numero_telefone;
        if (fieldsToUpdate.situacao !== undefined) updateFields['pagamento.situacao'] = Number(fieldsToUpdate.situacao);
        if (fieldsToUpdate.situacao_animacao !== undefined) updateFields['pagamento.situacao_animacao'] = fieldsToUpdate.situacao_animacao;
        if (fieldsToUpdate.tipo_pagamento !== undefined) updateFields['pagamento.tipo_pagamento'] = fieldsToUpdate.tipo_pagamento;
        if (fieldsToUpdate.isPos_registration !== undefined) updateFields['isPos_registration'] = fieldsToUpdate.isPos_registration;
        if (fieldsToUpdate.id_api !== undefined) updateFields['id_api'] = fieldsToUpdate.id_api;

        if (Object.keys(updateFields).length === 0) {
            return NextResponse.json({ message: "Os dados enviados não correspondem a campos editáveis." }, { status: 400 });
        }

        // 4. Atualizar o documento no banco de dados usando o userId do corpo
        const result = await db.collection(colecao).updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ message: "Usuário não encontrado." }, { status: 404 });
        }

        return NextResponse.json({ message: "Usuário atualizado com sucesso." }, { status: 200 });

    } catch (error) {
        console.error("Falha ao atualizar usuário na API:", error);
        return NextResponse.json({ message: "Ocorreu um erro no servidor." }, { status: 500 });
    }
});