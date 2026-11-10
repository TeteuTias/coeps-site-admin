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

/** `abreEm`: string = travar até o horário; null = destravar; ausente = não alterar. */
export type AutomaticLotFields = Omit<ILoteAutomatico, "codigo" | "abreEm"> & {
  abreEm?: string | null;
};

export interface AutomaticLotUpdateInput {
  configId: string;
  loteCodigo: number;
  lote: AutomaticLotFields;
}

export interface AutomaticLotCreateInput {
  configId: string;
  lote: AutomaticLotFields;
}

/** Só os campos de `ingressos_config` que a criação de lote toca. */
interface AutomaticLotsDocument {
  modo?: string;
  configuracaoLotesAutomaticos?: { lotes: ILoteAutomatico[] };
  updatedAt?: Date;
  updatedBy?: string;
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

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const DATE_TIME_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Horário de abertura do lote. `null`/"" = sem trava; `undefined` = inválido.
 * "YYYY-MM-DDTHH:mm" (campo datetime-local) é lido como horário de Brasília.
 */
export function parseLotOpeningTime(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  // shortcut: Brasília fixo em -03:00 (sem horário de verão desde 2019), mesma regra do site em paymentBoundaryTimestamp.
  const normalized = LOCAL_DATE_TIME.test(value)
    ? `${value.length === 16 ? `${value}:00` : value}-03:00`
    : DATE_TIME_WITH_ZONE.test(value) ? value : null;
  const timestamp = normalized ? Date.parse(normalized) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function parseLotFields(value: unknown): AutomaticLotFields | null {
  if (typeof value !== "object" || value === null) return null;
  const rawLot = value as Record<string, unknown>;
  const nome = typeof rawLot.nome === "string" ? rawLot.nome.trim() : "";
  const precos = parsePrices(rawLot.precos);
  if (!nome || !isPositiveInteger(rawLot.limiteVagas) || !precos) return null;

  const lote: AutomaticLotFields = { nome, limiteVagas: rawLot.limiteVagas, precos };
  if ("abreEm" in rawLot) {
    const abreEm = parseLotOpeningTime(rawLot.abreEm);
    if (abreEm === undefined) return null;
    lote.abreEm = abreEm;
  }
  return lote;
}

export function parseAutomaticLotUpdate(
  value: unknown,
): AutomaticLotUpdateInput | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.configId !== "string" ||
    !ObjectId.isValid(body.configId) ||
    !isNonNegativeInteger(body.loteCodigo)
  ) {
    return null;
  }

  const lote = parseLotFields(body.lote);
  return lote
    ? { configId: body.configId, loteCodigo: body.loteCodigo, lote }
    : null;
}

export function parseAutomaticLotCreate(
  value: unknown,
): AutomaticLotCreateInput | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.configId !== "string" || !ObjectId.isValid(body.configId)) {
    return null;
  }

  const lote = parseLotFields(body.lote);
  return lote ? { configId: body.configId, lote } : null;
}

/** Devolve o lote salvo; `abreEm` só aparece quando há trava. */
function storedLot(codigo: number, fields: AutomaticLotFields): ILoteAutomatico {
  const { abreEm, ...rest } = fields;
  return { codigo, ...rest, ...(abreEm ? { abreEm } : {}) };
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

async function loadAutomaticLots(db: Db, configId: string) {
  const activeConfig = await assertLoadedActiveConfig(db, configId);
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
  return { activeConfig, lots };
}

function invalidAutomaticLotError() {
  return new PaymentConfigError(
    400,
    "invalid_automatic_lot",
    "Os dados do lote automático são inválidos.",
  );
}

export async function updateAutomaticLot(
  db: Db,
  rawInput: unknown,
  updatedBy: string,
): Promise<ILoteAutomatico> {
  const input = parseAutomaticLotUpdate(rawInput);
  if (!input) throw invalidAutomaticLotError();

  const { activeConfig, lots } = await loadAutomaticLots(db, input.configId);
  if (!lots.some((lot) => lot.codigo === input.loteCodigo)) {
    throw new PaymentConfigError(
      404,
      "automatic_lot_not_found",
      "O lote informado não existe na configuração carregada.",
    );
  }

  const updatedAt = new Date();
  const opensAtPath = "configuracaoLotesAutomaticos.lotes.$[lot].abreEm";
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
        ...(input.lote.abreEm ? { [opensAtPath]: input.lote.abreEm } : {}),
        updatedAt,
        updatedBy,
      },
      // `abreEm: null` destrava o lote; ausente mantém o que já estava salvo.
      ...(input.lote.abreEm === null ? { $unset: { [opensAtPath]: "" } } : {}),
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

  return storedLot(input.loteCodigo, input.lote);
}

export async function createAutomaticLot(
  db: Db,
  rawInput: unknown,
  updatedBy: string,
): Promise<ILoteAutomatico> {
  const input = parseAutomaticLotCreate(rawInput);
  if (!input) throw invalidAutomaticLotError();

  const { activeConfig, lots } = await loadAutomaticLots(db, input.configId);
  const codigo = lots.reduce((maximum, lot) => Math.max(maximum, lot.codigo), -1) + 1;
  const lote = storedLot(codigo, input.lote);

  // O filtro por código impede que duas criações simultâneas gerem o mesmo código.
  const result = await db.collection<AutomaticLotsDocument>("ingressos_config").updateOne(
    {
      _id: activeConfig._id,
      modo: "automatico",
      "configuracaoLotesAutomaticos.lotes.codigo": { $ne: codigo },
    },
    {
      $push: { "configuracaoLotesAutomaticos.lotes": lote },
      $set: { updatedAt: new Date(), updatedBy },
    },
  );

  if (result.matchedCount !== 1) {
    throw new PaymentConfigError(
      409,
      "automatic_lot_changed",
      "Os lotes mudaram durante a criação. Recarregue a página.",
    );
  }

  return lote;
}
