// src/app/api/put/pagamentos/configuracaoParcelamentos/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'bson';
import { connectToDatabase } from '@/app/lib/mongodb';
import { IPaymentConfig } from '@/app/lib/types/payments/payment.t';
import { withApiAuthRequired } from "@/app/lib/auth0";
// --- Helper Types e Funções de Validação ---

// Tipo para um único item de parcelamento, para clareza
type ParcelamentoItem = IPaymentConfig["parcelamentos"]


/**
 * Valida se o array de parcelamentos recebido do cliente é seguro para ser salvo no banco.
 * @param parcelamentos - O array a ser validado.
 * @returns {boolean} - True se for válido, false caso contrário.
 */
function isValidParcelamentosArray(parcelamentos: any): parcelamentos is ParcelamentoItem[] {
    // 1. Verifica se é de fato um array
    if (!Array.isArray(parcelamentos)) {
        return false;
    }

    // 2. Usa .every() para verificar se CADA item no array passa na validação
    return parcelamentos.every(item => {
        // Verifica se o item é um objeto e não nulo
        if (typeof item !== 'object' || item === null) return false;

        // Verifica a presença e o tipo de cada campo obrigatório
        const hasCodigo = typeof item.codigo === 'number';
        const hasValor = typeof item.valorCadaParcela === 'number' && item.valorCadaParcela >= 0;
        const hasTotalParcelas = typeof item.totalParcelas === 'number' && item.totalParcelas > 0; // Parcelas devem ser um número positivo

        return hasCodigo && hasValor && hasTotalParcelas;
    });
}


// --- Rota Principal ---

export const PUT = withApiAuthRequired(async function PUT(req: Request) {
    try {
        // 1. CONECTAR AO BANCO DE DADOS
        const { db } = await connectToDatabase();

        // 2. EXTRAIR DADOS DO CORPO DA REQUISIÇÃO
        const body = await req.json();
        const { _id, parcelamentos } = body;

        // 3. VALIDAR OS DADOS RECEBIDOS
        // Valida a presença e o formato do _id
        if (!_id || typeof _id !== 'string') {
            return NextResponse.json({ error: 'O _id do documento de configuração é obrigatório.' }, { status: 400 });
        }

        // Valida a estrutura e o conteúdo do array de parcelamentos usando a função helper
        if (!isValidParcelamentosArray(parcelamentos)) {
            return NextResponse.json({ error: 'O formato dos dados de parcelamento é inválido. Verifique os campos e tipos.' }, { status: 400 });
        }

        // 4. PREPARAR E EXECUTAR A OPERAÇÃO NO BANCO
        const colecao = 'ingressos_config'; // O nome da sua coleção


        // O operador `$set` substitui o valor de um campo pelo valor especificado.
        // Aqui, ele vai substituir todo o array 'parcelamentos' pelo novo array enviado pelo frontend.
        // Isso lida com adições, exclusões e modificações de uma só vez.
        const dadosParaAtualizar = {
            $set: {
                parcelamentos: parcelamentos,
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

    } catch {
        return NextResponse.json(
            { error: "internal_server_error", message: "Não foi possível atualizar os parcelamentos." },
            { status: 500 }
        );
    }
})
