import type { Db } from "mongodb";
import type {
  IAutomaticLotOccupancy,
  ILoteAutomatico,
} from "../types/payments/payment.t.ts";
import {
  PaymentConfigError,
  type ActivePaymentConfig,
} from "./payment-config-repository.ts";

export interface AutomaticLotOccupancyCounts {
  confirmadasLegadas: number;
  confirmadasModernas: number;
  reservasAtivas: number;
}

type LotCapacity = Pick<ILoteAutomatico, "codigo" | "limiteVagas">;

function normalizeEditionId(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || undefined;
}

function paymentConfigEditionId(config: ActivePaymentConfig) {
  return (
    normalizeEditionId(config.edicaoId) ??
    normalizeEditionId(
      process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID,
    ) ??
    String(config._id)
  );
}

function assertValidLots(lots: unknown): asserts lots is ILoteAutomatico[] {
  if (!Array.isArray(lots) || lots.length === 0) {
    throw new PaymentConfigError(
      409,
      "automatic_lots_missing",
      "A configuração automática não possui lotes válidos.",
    );
  }

  const codes = new Set<number>();
  for (const lot of lots) {
    if (
      typeof lot !== "object" ||
      lot === null ||
      !Number.isInteger((lot as ILoteAutomatico).codigo) ||
      (lot as ILoteAutomatico).codigo < 0 ||
      codes.has((lot as ILoteAutomatico).codigo) ||
      !Number.isInteger((lot as ILoteAutomatico).limiteVagas) ||
      (lot as ILoteAutomatico).limiteVagas <= 0
    ) {
      throw new PaymentConfigError(
        409,
        "invalid_automatic_lots",
        "A configuração automática possui códigos ou limites de lote inválidos.",
      );
    }
    codes.add((lot as ILoteAutomatico).codigo);
  }
}

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function buildAutomaticLotOccupancy(
  configId: string,
  edicaoId: string,
  lots: LotCapacity[],
  rawCounts: AutomaticLotOccupancyCounts,
  calculatedAt = new Date(),
): IAutomaticLotOccupancy {
  const confirmadasLegadas = safeCount(rawCounts.confirmadasLegadas);
  const confirmadasModernas = safeCount(rawCounts.confirmadasModernas);
  const reservasAtivas = safeCount(rawCounts.reservasAtivas);
  const confirmadasTotal = confirmadasLegadas + confirmadasModernas;
  const ocupadasEfetivas = confirmadasTotal + reservasAtivas;
  const capacidadeTotal = lots.reduce((total, lot) => total + lot.limiteVagas, 0);

  let capacidadeAnterior = 0;
  const ocupacaoPorLote = lots.map((lot) => {
    const ocupadasNoLote = Math.min(
      lot.limiteVagas,
      Math.max(0, ocupadasEfetivas - capacidadeAnterior),
    );
    capacidadeAnterior += lot.limiteVagas;

    return {
      codigo: lot.codigo,
      limiteVagas: lot.limiteVagas,
      ocupadasEfetivas: ocupadasNoLote,
      restantes: lot.limiteVagas - ocupadasNoLote,
    };
  });

  return {
    configId,
    edicaoId,
    calculadoEm: calculatedAt.toISOString(),
    confirmadas: {
      legadas: confirmadasLegadas,
      modernas: confirmadasModernas,
      total: confirmadasTotal,
    },
    reservasAtivas,
    ocupadasEfetivas,
    capacidadeTotal,
    excedente: Math.max(0, ocupadasEfetivas - capacidadeTotal),
    lotes: ocupacaoPorLote,
  };
}

export async function getAutomaticLotOccupancy(
  db: Db,
  config: ActivePaymentConfig,
  now = new Date(),
) {
  if (config.modo !== "automatico") {
    throw new PaymentConfigError(
      409,
      "automatic_mode_disabled",
      "A configuração carregada não está no modo automático.",
    );
  }

  const lots = config.configuracaoLotesAutomaticos?.lotes;
  assertValidLots(lots);
  const edicaoId = paymentConfigEditionId(config);

  const [confirmadasLegadas, confirmadasModernas, reservasAtivas] =
    await Promise.all([
      db.collection("usuarios").countDocuments({
        "pagamento.situacao": 1,
        "pagamento.edicaoId": edicaoId,
        "pagamento.compraId": { $exists: false },
        "pagamento.tipo_pagamento": { $not: /^organizador$/i },
      }),
      db.collection("pagamentos.atribuicoes").countDocuments({
        edicaoId,
        status: "CONFIRMADA",
      }),
      db.collection("pagamentos.sessoes").countDocuments({
        type: "ticket",
        edicaoId,
        $or: [
          { status: "OPEN", expiresAt: { $gt: now } },
          {
            status: {
              $in: [
                "CREATING_PAYMENT",
                "PAYMENT_PENDING",
                "PAYMENT_REVIEW_REQUIRED",
              ],
            },
          },
        ],
      }),
    ]);

  return buildAutomaticLotOccupancy(
    String(config._id),
    edicaoId,
    lots,
    { confirmadasLegadas, confirmadasModernas, reservasAtivas },
    now,
  );
}
