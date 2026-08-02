import type { ClientSession, Db } from "mongodb";
import {
  getActiveEditionId,
  normalizeEditionId,
  PAYMENT_ATTRIBUTIONS_COLLECTION,
  PAYMENT_CODES_COLLECTION,
} from "@/app/lib/payments/payment-code-repository";

const RETENTION_DAYS = 365;
const RETENTION_MILLISECONDS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function asDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function newestDate(values: unknown[]) {
  const dates = values.map(asDate).filter((value): value is Date => Boolean(value));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export interface EditionCleanupEvaluation {
  edicaoId: string;
  activeEditionId: string;
  isActiveEdition: boolean;
  eligible: boolean;
  reason: string | null;
  retentionDays: number;
  cutoffDate: string;
  latestRelevantDate: string | null;
  expectedConfirmation: string;
  counts: {
    codigos: number;
    atribuicoes: number;
    total: number;
  };
}

export async function evaluateEditionCleanup(
  db: Db,
  editionInput: unknown,
  mongoSession?: ClientSession,
): Promise<EditionCleanupEvaluation | null> {
  const edicaoId = normalizeEditionId(editionInput);
  if (!edicaoId) return null;

  const activeEditionId = await getActiveEditionId(db, mongoSession);
  if (!activeEditionId) {
    throw new Error("ACTIVE_EDITION_NOT_CONFIGURED");
  }

  const [codesCount, attributionsCount, latestCodeRows, latestAttributionRows, config] =
    await Promise.all([
      db
        .collection(PAYMENT_CODES_COLLECTION)
        .countDocuments({ edicaoId }, { session: mongoSession }),
      db
        .collection(PAYMENT_ATTRIBUTIONS_COLLECTION)
        .countDocuments({ edicaoId }, { session: mongoSession }),
      db.collection(PAYMENT_CODES_COLLECTION).aggregate<{ latest: Date }>([
        { $match: { edicaoId } },
        { $project: { latest: { $max: ["$createdAt", "$updatedAt"] } } },
        { $sort: { latest: -1 } },
        { $limit: 1 },
      ], { session: mongoSession }).toArray(),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).aggregate<{ latest: Date }>([
        { $match: { edicaoId } },
        {
          $project: {
            latest: { $max: ["$createdAt", "$confirmedAt", "$updatedAt"] },
          },
        },
        { $sort: { latest: -1 } },
        { $limit: 1 },
      ], { session: mongoSession }).toArray(),
      db.collection("ingressos_config").findOne(
        { edicaoId },
        {
          projection: {
            dataEnd: 1,
            dataFim: 1,
            endDate: 1,
            updatedAt: 1,
          },
          session: mongoSession,
        },
      ),
    ]);

  const latestRelevantDate = newestDate([
    latestCodeRows[0]?.latest,
    latestAttributionRows[0]?.latest,
    config?.dataEnd,
    config?.dataFim,
    config?.endDate,
    config?.updatedAt,
  ]);
  const cutoff = new Date(Date.now() - RETENTION_MILLISECONDS);
  const isActiveEdition = activeEditionId === edicaoId;
  const total = codesCount + attributionsCount;

  let reason: string | null = null;
  if (isActiveEdition) {
    reason = "A edição ativa nunca pode ser apagada.";
  } else if (total === 0) {
    reason = "Não há histórico de códigos para esta edição.";
  } else if (!latestRelevantDate) {
    reason = "Não foi possível comprovar a idade do histórico com segurança.";
  } else if (latestRelevantDate.getTime() >= cutoff.getTime()) {
    reason = "O registro mais recente da edição ainda não completou 365 dias.";
  }

  return {
    edicaoId,
    activeEditionId,
    isActiveEdition,
    eligible: reason === null,
    reason,
    retentionDays: RETENTION_DAYS,
    cutoffDate: cutoff.toISOString(),
    latestRelevantDate: latestRelevantDate?.toISOString() ?? null,
    expectedConfirmation: `APAGAR ${edicaoId}`,
    counts: {
      codigos: codesCount,
      atribuicoes: attributionsCount,
      total,
    },
  };
}
