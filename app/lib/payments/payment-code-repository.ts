import { randomInt } from "crypto";
import type { ClientSession, Db, Filter, ObjectId } from "mongodb";
import {
  PAYMENT_CODE_STATUSES,
  PAYMENT_CODE_TYPES,
  type PaymentAttributionDocument,
  type PaymentCodeDocument,
  type PaymentCodeResponsible,
  type PaymentCodeStatus,
  type PaymentCodeType,
} from "../types/payments/payment-code.t.ts";
import { getActivePaymentConfig } from "./payment-config-repository.ts";

export const PAYMENT_CODES_COLLECTION = "pagamentos.codigos";
export const PAYMENT_ATTRIBUTIONS_COLLECTION = "pagamentos.atribuicoes";
export const PAYMENT_AUDIT_COLLECTION = "pagamentos.auditoria";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeEditionId(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.normalize("NFKC").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(normalized)) return null;

  return normalized;
}

export function normalizePaymentCode(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!/^[A-Z0-9]{4,64}$/.test(normalized)) return null;
  return normalized;
}

export function isPaymentCodeType(value: unknown): value is PaymentCodeType {
  return PAYMENT_CODE_TYPES.includes(value as PaymentCodeType);
}

export function isPaymentCodeStatus(value: unknown): value is PaymentCodeStatus {
  return PAYMENT_CODE_STATUSES.includes(value as PaymentCodeStatus);
}

export function parseDiscountPercentage(value: unknown) {
  const percentage = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(percentage) || percentage < 1 || percentage > 99) {
    return null;
  }

  if (!Number.isInteger(percentage)) return null;
  return percentage;
}

export function parseResponsible(value: unknown): PaymentCodeResponsible | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  const nome = typeof candidate.nome === "string" ? candidate.nome.trim() : "";
  const email =
    typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : "";

  if (nome.length < 2 || nome.length > 120) return null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return null;
  }

  return email ? { nome, email } : { nome };
}

export async function getActiveEditionId(db: Db, session?: ClientSession) {
  const config = await getActivePaymentConfig(db, session);
  return normalizeEditionId(config?.edicaoId);
}

export function buildAttributionFilter(
  code: Pick<
    PaymentCodeDocument,
    "_id" | "edicaoId" | "codigoNormalizado" | "tipo"
  >,
): Filter<PaymentAttributionDocument> {
  const snapshotField =
    code.tipo === "DESCONTO" ? "codigoDesconto" : "codigoRastreio";
  const identifiers: Array<ObjectId | string> = [];

  if (code._id) {
    identifiers.push(code._id, code._id.toHexString());
  }

  const alternatives: Record<string, unknown>[] = [
    { [`${snapshotField}.codigoNormalizado`]: code.codigoNormalizado },
  ];

  if (identifiers.length > 0) {
    alternatives.unshift({ [`${snapshotField}.codigoId`]: { $in: identifiers } });
  }

  return {
    edicaoId: code.edicaoId,
    $or: alternatives,
  } as Filter<PaymentAttributionDocument>;
}

function editionPrefix(edicaoId: string) {
  const compact = edicaoId.replace(/[^A-Z0-9]/g, "");
  return compact.slice(-4) || "COEP";
}

function randomCodePart(length = 10) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return value;
}

export function generatePaymentCode(edicaoId: string, tipo: PaymentCodeType) {
  const typePrefix = tipo === "DESCONTO" ? "D" : "R";
  return `${typePrefix}-${editionPrefix(edicaoId)}-${randomCodePart()}`;
}

export async function codeExistsInCatalogOrHistory(
  db: Db,
  edicaoId: string,
  codigoNormalizado: string,
) {
  const [catalogCode, attribution] = await Promise.all([
    db.collection(PAYMENT_CODES_COLLECTION).findOne(
      { edicaoId, codigoNormalizado },
      { projection: { _id: 1 } },
    ),
    db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).findOne(
      {
        edicaoId,
        $or: [
          { "codigoDesconto.codigoNormalizado": codigoNormalizado },
          { "codigoRastreio.codigoNormalizado": codigoNormalizado },
        ],
      },
      { projection: { _id: 1 } },
    ),
  ]);

  return Boolean(catalogCode || attribution);
}

export async function createUniqueCodeDocument(
  db: Db,
  input: {
    edicaoId: string;
    tipo: PaymentCodeType;
    percentualDesconto?: number;
    responsavel?: PaymentCodeResponsible;
    createdBy: string;
  },
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const codigo = generatePaymentCode(input.edicaoId, input.tipo);
    const codigoNormalizado = normalizePaymentCode(codigo);
    if (!codigoNormalizado) continue;

    if (await codeExistsInCatalogOrHistory(db, input.edicaoId, codigoNormalizado)) {
      continue;
    }

    const now = new Date();
    const document: PaymentCodeDocument = {
      edicaoId: input.edicaoId,
      codigo,
      codigoNormalizado,
      tipo: input.tipo,
      status: "ATIVO",
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      ...(input.percentualDesconto !== undefined
        ? { percentualDesconto: input.percentualDesconto }
        : {}),
      ...(input.responsavel ? { responsavel: input.responsavel } : {}),
    };

    try {
      const result = await db
        .collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION)
        .insertOne(document);
      return { ...document, _id: result.insertedId };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Não foi possível gerar um código único.");
}
