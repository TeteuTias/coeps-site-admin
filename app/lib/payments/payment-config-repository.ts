import {
  ObjectId,
  type ClientSession,
  type Db,
  type Document,
  type WithId,
} from "mongodb";
import type {
  ILoteAutomatico,
  IPaymentConfig,
  IParcelamento,
  IPrecosLote,
} from "../types/payments/payment.t.ts";

export const LEGACY_PAYMENT_CONFIG_ID = "66bcfceedc9c7250e85b2ac6";

export type ActivePaymentConfig = WithId<Document> & IPaymentConfig;

export interface AutomaticLotUpdateInput {
  configId: string;
  loteCodigo: number;
  lote: Omit<ILoteAutomatico, "codigo">;
}

export class PaymentConfigError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaymentConfigError";
    this.status = status;
    this.code = code;
  }
}

function normalizeConfiguredEdition(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || undefined;
}

export async function getActivePaymentConfig(
  db: Db,
  session?: ClientSession,
): Promise<ActivePaymentConfig | null> {
  const configuredEdition = normalizeConfiguredEdition(
    process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID,
  );
  const collection = db.collection("ingressos_config");

  if (configuredEdition) {
    const byEdition = await collection.findOne(
      { edicaoId: configuredEdition, ativo: true },
      { session },
    );
    return byEdition as ActivePaymentConfig | null;
  }

  const explicitlyActive = await collection.findOne(
    { ativo: true },
    { sort: { updatedAt: -1, dataInit: -1 }, session },
  );
  if (explicitlyActive) return explicitlyActive as ActivePaymentConfig;

  const legacy = await collection.findOne(
    {
      _id: new ObjectId(LEGACY_PAYMENT_CONFIG_ID),
      $or: [{ ativo: true }, { ativo: { $exists: false } }],
    },
    { session },
  );
  return legacy as ActivePaymentConfig | null;
}

export function serializePaymentConfig(config: ActivePaymentConfig) {
  return { ...config, _id: String(config._id) };
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseInstallments(value: unknown): IParcelamento[] | null {
  if (!Array.isArray(value)) return null;

  const seenCodes = new Set<number>();
  const installments: IParcelamento[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const item = raw as Record<string, unknown>;
    if (
      !isNonNegativeInteger(item.codigo) ||
      seenCodes.has(item.codigo) ||
      !isPositiveInteger(item.totalParcelas) ||
      !isNonNegativeFiniteNumber(item.valorCadaParcela)
    ) {
      return null;
    }
    seenCodes.add(item.codigo);
    installments.push({
      codigo: item.codigo,
      totalParcelas: item.totalParcelas,
      valorCadaParcela: item.valorCadaParcela,
    });
  }
  return installments;
}

function parsePrices(value: unknown): IPrecosLote | null {
  if (typeof value !== "object" || value === null) return null;
  const prices = value as Record<string, unknown>;
  if (
    !isNonNegativeFiniteNumber(prices.valorPix) ||
    !isNonNegativeFiniteNumber(prices.valorBoleto) ||
    !isNonNegativeFiniteNumber(prices.valorDebito) ||
    !isNonNegativeFiniteNumber(prices.valorAVista)
  ) {
    return null;
  }
  const installments = parseInstallments(prices.parcelamentos);
  if (!installments) return null;

  return {
    valorPix: prices.valorPix,
    valorBoleto: prices.valorBoleto,
    valorDebito: prices.valorDebito,
    valorAVista: prices.valorAVista,
    parcelamentos: installments,
  };
}

export function parseAutomaticLotUpdate(
  value: unknown,
): AutomaticLotUpdateInput | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.configId !== "string" ||
    !ObjectId.isValid(body.configId) ||
    !isNonNegativeInteger(body.loteCodigo) ||
    typeof body.lote !== "object" ||
    body.lote === null
  ) {
    return null;
  }

  const rawLot = body.lote as Record<string, unknown>;
  const nome = typeof rawLot.nome === "string" ? rawLot.nome.trim() : "";
  const precos = parsePrices(rawLot.precos);
  if (!nome || !isPositiveInteger(rawLot.limiteVagas) || !precos) return null;

  return {
    configId: body.configId,
    loteCodigo: body.loteCodigo,
    lote: { nome, limiteVagas: rawLot.limiteVagas, precos },
  };
}

function assertUniqueAutomaticLotCodes(lots: unknown[]): void {
  const seenCodes = new Set<number>();
  for (const rawLot of lots) {
    const codigo =
      typeof rawLot === "object" && rawLot !== null
        ? (rawLot as Record<string, unknown>).codigo
        : undefined;
    if (!isNonNegativeInteger(codigo) || seenCodes.has(codigo)) {
      throw new PaymentConfigError(
        409,
        "invalid_existing_lot_codes",
        "A configuração possui códigos de lote inválidos ou duplicados.",
      );
    }
    seenCodes.add(codigo);
  }
}

export async function assertLoadedActiveConfig(
  db: Db,
  configId: string,
  session?: ClientSession,
): Promise<ActivePaymentConfig> {
  if (!ObjectId.isValid(configId)) {
    throw new PaymentConfigError(
      400,
      "invalid_config_id",
      "O identificador da configuração é inválido.",
    );
  }
  const activeConfig = await getActivePaymentConfig(db, session);
  if (!activeConfig) {
    throw new PaymentConfigError(
      404,
      "config_not_found",
      "Nenhuma configuração financeira ativa foi encontrada.",
    );
  }
  if (String(activeConfig._id) !== configId) {
    throw new PaymentConfigError(
      409,
      "stale_payment_config",
      "A configuração ativa mudou. Recarregue a página antes de salvar.",
    );
  }
  return activeConfig;
}

export async function updateAutomaticLot(
  db: Db,
  rawInput: unknown,
  updatedBy: string,
): Promise<ILoteAutomatico> {
  const input = parseAutomaticLotUpdate(rawInput);
  if (!input) {
    throw new PaymentConfigError(
      400,
      "invalid_automatic_lot",
      "Os dados do lote automático são inválidos.",
    );
  }

  const activeConfig = await assertLoadedActiveConfig(db, input.configId);
  if (activeConfig.modo !== "automatico") {
    throw new PaymentConfigError(
      409,
      "automatic_mode_disabled",
      "A configuração carregada não está no modo automático.",
    );
  }

  const lots = activeConfig.configuracaoLotesAutomaticos?.lotes;
  if (!Array.isArray(lots)) {
    throw new PaymentConfigError(
      409,
      "automatic_lots_missing",
      "A configuração automática não possui uma lista válida de lotes.",
    );
  }
  assertUniqueAutomaticLotCodes(lots);

  if (!lots.some((lot) => lot.codigo === input.loteCodigo)) {
    throw new PaymentConfigError(
      404,
      "automatic_lot_not_found",
      "O lote informado não existe na configuração carregada.",
    );
  }

  const updatedAt = new Date();
  const result = await db.collection("ingressos_config").updateOne(
    {
      _id: activeConfig._id,
      modo: "automatico",
      "configuracaoLotesAutomaticos.lotes": {
        $elemMatch: { codigo: input.loteCodigo },
      },
    },
    {
      $set: {
        "configuracaoLotesAutomaticos.lotes.$[lot].nome": input.lote.nome,
        "configuracaoLotesAutomaticos.lotes.$[lot].limiteVagas":
          input.lote.limiteVagas,
        "configuracaoLotesAutomaticos.lotes.$[lot].precos": input.lote.precos,
        updatedAt,
        updatedBy,
      },
    },
    { arrayFilters: [{ "lot.codigo": input.loteCodigo }] },
  );

  if (result.matchedCount !== 1) {
    throw new PaymentConfigError(
      409,
      "automatic_lot_changed",
      "O lote mudou durante a atualização. Recarregue a página.",
    );
  }

  return { codigo: input.loteCodigo, ...input.lote };
}
