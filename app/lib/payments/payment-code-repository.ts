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

export function parseDiscountQuantity(value: unknown) {
  const quantity = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) return null;
  return quantity;
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
  session?: ClientSession,
) {
  const [catalogCode, attribution] = await Promise.all([
    db.collection(PAYMENT_CODES_COLLECTION).findOne(
      { edicaoId, codigoNormalizado },
      { projection: { _id: 1 }, session },
    ),
    db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).findOne(
      {
        edicaoId,
        $or: [
          { "codigoDesconto.codigoNormalizado": codigoNormalizado },
          { "codigoRastreio.codigoNormalizado": codigoNormalizado },
        ],
      },
      { projection: { _id: 1 }, session },
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
    perfilUtilizador?: "ORGANIZADOR" | "CONGRESSISTA";
    createdBy: string;
  },
  session?: ClientSession,
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const codigo = generatePaymentCode(input.edicaoId, input.tipo);
    const codigoNormalizado = normalizePaymentCode(codigo);
    if (!codigoNormalizado) continue;

    if (await codeExistsInCatalogOrHistory(db, input.edicaoId, codigoNormalizado, session)) {
      continue;
    }

    const now = new Date();
    const document: PaymentCodeDocument = {
      edicaoId: input.edicaoId,
      codigo,
      codigoNormalizado,
      tipo: input.tipo,
      ...(input.tipo === "DESCONTO"
        ? { perfilUtilizador: input.perfilUtilizador ?? "CONGRESSISTA" }
        : {}),
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
        .insertOne(document, { session });
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

function paymentCodeDocument(
  input: {
    edicaoId: string;
    codigo: string;
    tipo: PaymentCodeType;
    percentualDesconto?: number;
    responsavel?: PaymentCodeResponsible;
    perfilUtilizador?: "ORGANIZADOR" | "CONGRESSISTA";
    createdBy: string;
  },
  now = new Date(),
): PaymentCodeDocument {
  const codigoNormalizado = normalizePaymentCode(input.codigo);
  if (!codigoNormalizado) throw new Error("Código gerado inválido.");
  return {
    edicaoId: input.edicaoId,
    codigo: input.codigo,
    codigoNormalizado,
    tipo: input.tipo,
    status: "ATIVO",
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    ...(input.tipo === "DESCONTO"
      ? { perfilUtilizador: input.perfilUtilizador ?? "CONGRESSISTA" }
      : {}),
    ...(input.percentualDesconto !== undefined
      ? { percentualDesconto: input.percentualDesconto }
      : {}),
    ...(input.responsavel ? { responsavel: input.responsavel } : {}),
  };
}

export async function createUniqueDiscountCodeDocuments(
  db: Db,
  input: {
    edicaoId: string;
    quantidade: number;
    percentualDesconto?: number;
    perfilUtilizador: "ORGANIZADOR" | "CONGRESSISTA";
    createdBy: string;
  },
  session: ClientSession,
) {
  const selected = new Map<string, string>();
  for (let round = 0; round < 12 && selected.size < input.quantidade; round += 1) {
    while (selected.size < input.quantidade) {
      const codigo = generatePaymentCode(input.edicaoId, "DESCONTO");
      const normalized = normalizePaymentCode(codigo);
      if (normalized) selected.set(normalized, codigo);
    }

    const candidates = [...selected.keys()];
    const [catalogRows, historyRows] = await Promise.all([
      db.collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION)
        .find(
          { edicaoId: input.edicaoId, codigoNormalizado: { $in: candidates } },
          { projection: { codigoNormalizado: 1 }, session },
        )
        .toArray(),
      db.collection<PaymentAttributionDocument>(PAYMENT_ATTRIBUTIONS_COLLECTION)
        .find(
          {
            edicaoId: input.edicaoId,
            $or: [
              { "codigoDesconto.codigoNormalizado": { $in: candidates } },
              { "codigoRastreio.codigoNormalizado": { $in: candidates } },
            ],
          },
          {
            projection: {
              "codigoDesconto.codigoNormalizado": 1,
              "codigoRastreio.codigoNormalizado": 1,
            },
            session,
          },
        )
        .toArray(),
    ]);

    for (const row of catalogRows) selected.delete(row.codigoNormalizado);
    for (const row of historyRows) {
      if (row.codigoDesconto?.codigoNormalizado) {
        selected.delete(row.codigoDesconto.codigoNormalizado);
      }
      if (row.codigoRastreio?.codigoNormalizado) {
        selected.delete(row.codigoRastreio.codigoNormalizado);
      }
    }
  }

  if (selected.size !== input.quantidade) {
    throw new Error("Não foi possível gerar o lote de códigos únicos.");
  }

  const now = new Date();
  const documents = [...selected.values()].map((codigo) => paymentCodeDocument({
    ...input,
    codigo,
    tipo: "DESCONTO",
  }, now));
  const result = await db
    .collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION)
    .insertMany(documents, { ordered: true, session });

  return documents.map((document, index) => ({
    ...document,
    _id: result.insertedIds[index],
  }));
}

function readableName(value: string) {
  const words = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[A-Za-z0-9]+/g) ?? [];
  return words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join("") || "Rastreio";
}

function readableEdition(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "CIEPS";
}

export function generateReadableTrackingCode(
  responsibleName: string,
  edicaoId: string,
  sequence = 1,
) {
  const edition = readableEdition(edicaoId);
  const suffix = sequence > 1 ? String(sequence) : "";
  const maxNameLength = Math.max(2, 64 - edition.length - suffix.length);
  const name = readableName(responsibleName).slice(0, maxNameLength);
  return `${name}-${edition}${suffix ? `-${suffix}` : ""}`;
}

export async function createReadableTrackingCodeDocument(
  db: Db,
  input: {
    edicaoId: string;
    responsavel: PaymentCodeResponsible;
    createdBy: string;
  },
) {
  for (let sequence = 1; sequence <= 10_000; sequence += 1) {
    const codigo = generateReadableTrackingCode(
      input.responsavel.nome,
      input.edicaoId,
      sequence,
    );
    const codigoNormalizado = normalizePaymentCode(codigo);
    if (!codigoNormalizado) continue;
    if (await codeExistsInCatalogOrHistory(db, input.edicaoId, codigoNormalizado)) continue;

    const document = paymentCodeDocument({
      ...input,
      codigo,
      tipo: "RASTREIO",
    });
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
  throw new Error("Não foi possível gerar um rastreio legível e único.");
}
