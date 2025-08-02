// src/app/api/put/pagamentos/configuracaoParcelamentos/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import { connectToDatabase } from '@/app/lib/mongodb';
import { IPaymentConfig } from '@/app/lib/types/payments/payment.t';
// --- Helper Types e Funções de Validação ---

// Tipo para um único item de parcelamento, para clareza
type ParcelamentoItem = IPaymentConfig["parcelamentos"]


/**
 * Valida se o array de parcelamentos recebido do cliente é seguro para ser salvo no banco.
 * @param parcelamentos - O array a ser validado.
 * @returns {boolean} - True se for válido, false caso contrário.
 */



// --- Rota Principal ---
export async function PUT(req: NextRequest) {
    try {
        const allPaymentTypes: IPaymentConfig["pagamentosAceitos"] = ["PIX", "BOLETO", "CREDIT_CARD", "DEBIT_CARD"]

        // 1. CONECTAR AO BANCO DE DADOS
        const { db } = await connectToDatabase();



        // 2. EXTRAIR DADOS DO CORPO DA REQUISIÇÃO
        const body = await req.json();
        const { _id, parcelamentos } = body;

        // 4. PREPARAR E EXECUTAR A OPERAÇÃO NO BANCO
        const colecao = 'ingressos_config'; // O nome da sua coleção


        // O operador `$set` substitui o valor de um campo pelo valor especificado.
        // Aqui, ele vai substituir todo o array 'parcelamentos' pelo novo array enviado pelo frontend.
        // Isso lida com adições, exclusões e modificações de uma só vez.
        const dadosParaAtualizar = {
            $set: {
                pagamentosAceitos: parcelamentos,
            },
        };

        const result = await db.collection(colecao).updateOne(
            {
                _id: new ObjectId(_id)
            },
            dadosParaAtualizar
        );
        // 5. ANALISAR O RESULTADO E ENVIAR A RESPOSTA
        if (result.matchedCount === 0) {
            return NextResponse.json({ error: `Documento de configuração com ID ${_id} não encontrado.` }, { status: 404 });
        }

        return NextResponse.json(
            {
                message: 'Formas de parcelamento atualizadas com sucesso!',
                data: { parcelamentos }, // Retorna os dados atualizados para confirmação
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("Erro na API de atualização de parcelamentos:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno do servidor ao tentar atualizar os dados.' }, { status: 500 });
    }
}