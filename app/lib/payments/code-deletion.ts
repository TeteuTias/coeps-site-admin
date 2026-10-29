import { ObjectId, type Db } from "mongodb";
import {
  buildAttributionFilter,
  PAYMENT_ATTRIBUTIONS_COLLECTION,
  PAYMENT_CODES_COLLECTION,
} from "./payment-code-repository.ts";
import type {
  PaymentAttributionDocument,
  PaymentCodeDocument,
} from "../types/payments/payment-code.t.ts";

export const MAX_BULK_CODE_DELETION = 500;
const USAGE_CHECK_BATCH = 20;

export interface SkippedCode {
  id: string;
  codigo?: string;
  motivo: string;
}

export interface BulkCodeDeletionResult {
  excluidos: number;
  ignorados: SkippedCode[];
}

/** Ids únicos e válidos; null se a lista for inválida ou maior que o limite. */
export function parseCodeIds(value: unknown): ObjectId[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const unique = [...new Set(value.map(String))];
  if (unique.length > MAX_BULK_CODE_DELETION || !unique.every((id) => ObjectId.isValid(id))) {
    return null;
  }
  return unique.map((id) => new ObjectId(id));
}

/**
 * Mesmas regras da exclusão individual: só edição ativa, nunca reservado, rastreio precisa estar
 * inativo e nenhum código com compra vinculada. O que não pode sair é devolvido com o motivo.
 */
export async function deleteUnusedCodes(
  db: Db,
  ids: ObjectId[],
  activeEditionId: string,
): Promise<BulkCodeDeletionResult> {
  const codes = await db
    .collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION)
    .find({ _id: { $in: ids } })
    .toArray();
  const found = new Set(codes.map((code) => String(code._id)));
  const ignorados: SkippedCode[] = ids
    .filter((id) => !found.has(String(id)))
    .map((id) => ({ id: String(id), motivo: "Código não encontrado." }));

  const candidates: PaymentCodeDocument[] = [];
  for (const code of codes) {
    const skip = (motivo: string) =>
      ignorados.push({ id: String(code._id), codigo: code.codigo, motivo });
    if (code.edicaoId !== activeEditionId) skip("Código de outra edição.");
    else if (code.status === "RESERVADO") skip("Código reservado por uma compra em andamento.");
    else if (code.tipo === "RASTREIO" && code.status !== "INATIVO") skip("Desative o rastreio antes de excluí-lo.");
    else candidates.push(code);
  }

  const eligible: ObjectId[] = [];
  for (let start = 0; start < candidates.length; start += USAGE_CHECK_BATCH) {
    const batch = candidates.slice(start, start + USAGE_CHECK_BATCH);
    const usage = await Promise.all(
      batch.map((code) =>
        db
          .collection<PaymentAttributionDocument>(PAYMENT_ATTRIBUTIONS_COLLECTION)
          .countDocuments(buildAttributionFilter(code), { limit: 1 }),
      ),
    );
    batch.forEach((code, index) => {
      if (usage[index] > 0) {
        ignorados.push({
          id: String(code._id),
          codigo: code.codigo,
          motivo: "Código vinculado a uma compra.",
        });
      } else {
        eligible.push(code._id as ObjectId);
      }
    });
  }

  if (eligible.length === 0) return { excluidos: 0, ignorados };

  const result = await db.collection(PAYMENT_CODES_COLLECTION).deleteMany({
    _id: { $in: eligible },
    status: { $ne: "RESERVADO" },
  });
  if (result.deletedCount < eligible.length) {
    ignorados.push({
      id: "",
      motivo: `${eligible.length - result.deletedCount} código(s) mudaram de estado durante a exclusão.`,
    });
  }
  return { excluidos: result.deletedCount, ignorados };
}
