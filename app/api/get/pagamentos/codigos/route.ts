import { connectToDatabase } from "@/app/lib/mongodb";
import type { Db, Document } from "mongodb";
import { requireFinanceAdmin } from "@/app/lib/payments/finance-admin";
import {
  buildLedgerBacklogSummary,
  PAYMENT_EFFECTIVE_REFUND_EXPRESSION,
  PAYMENT_FINANCIAL_RISK_EXPRESSION,
  PAYMENT_GROSS_AMOUNT_EXPRESSION,
  PAYMENT_NET_AMOUNT_EXPRESSION,
  PAYMENT_RECOGNIZED_SALE_EXPRESSION,
} from "@/app/lib/payments/admin-payment-read-model";
import {
  getActiveEditionId,
  isPaymentCodeStatus,
  isPaymentCodeType,
  normalizeEditionId,
  PAYMENT_ATTRIBUTIONS_COLLECTION,
  PAYMENT_CODES_COLLECTION,
} from "@/app/lib/payments/payment-code-repository";
import type {
  PaymentCodeDocument,
  PaymentCodeListItem,
  PaymentCodeMetrics,
  PaymentCodeResponsible,
  PaymentCodeStatus,
  PaymentCodeType,
} from "@/app/lib/types/payments/payment-code.t";

export const dynamic = "force-dynamic";

interface LedgerSummary {
  _id: {
    tipo: PaymentCodeType;
    codigoNormalizado: string;
  };
  codigo: string;
  codigoId?: unknown;
  percentualDesconto?: number;
  responsavel?: PaymentCodeResponsible;
  confirmadas: number;
  confirmadasBrutas: number;
  pendentes: number;
  estornadas: number;
  canceladasOuExpiradas: number;
  emRevisaoFinanceira: number;
  valorConfirmadoCentavos: number;
  valorBrutoConfirmadoCentavos: number;
  valorEstornadoDoneCentavos: number;
  valorEmRiscoCentavos: number;
  valorLiquidoCentavos: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GeneralFinancialTotals {
  valorBrutoConfirmadoCentavos: number;
  valorEstornadoDoneCentavos: number;
  valorEmRiscoCentavos: number;
  valorLiquidoCentavos: number;
}

interface WebhookWorkerLockDocument extends Document {
  _id: string;
  owner?: string;
  leaseUntil?: Date;
  blockedByFailedEvent?: boolean;
  updatedAt?: Date;
}

const EMPTY_METRICS: PaymentCodeMetrics = {
  confirmadas: 0,
  confirmadasBrutas: 0,
  pendentes: 0,
  estornadas: 0,
  canceladasOuExpiradas: 0,
  emRevisaoFinanceira: 0,
  valorConfirmadoCentavos: 0,
  valorBrutoConfirmadoCentavos: 0,
  valorEstornadoDoneCentavos: 0,
  valorEmRiscoCentavos: 0,
  valorLiquidoCentavos: 0,
};

function parsePositiveInteger(value: string | null, fallback: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function dateToIso(value: unknown) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function summaryMetrics(summary?: LedgerSummary): PaymentCodeMetrics {
  if (!summary) return { ...EMPTY_METRICS };
  return {
    confirmadas: summary.confirmadas,
    confirmadasBrutas: summary.confirmadasBrutas,
    pendentes: summary.pendentes,
    estornadas: summary.estornadas,
    canceladasOuExpiradas: summary.canceladasOuExpiradas,
    emRevisaoFinanceira: summary.emRevisaoFinanceira,
    valorConfirmadoCentavos: summary.valorConfirmadoCentavos,
    valorBrutoConfirmadoCentavos: summary.valorBrutoConfirmadoCentavos,
    valorEstornadoDoneCentavos: summary.valorEstornadoDoneCentavos,
    valorEmRiscoCentavos: summary.valorEmRiscoCentavos,
    valorLiquidoCentavos: summary.valorLiquidoCentavos,
  };
}

function codeKey(tipo: PaymentCodeType, codigoNormalizado: string) {
  return `${tipo}|${codigoNormalizado}`;
}

export async function GET(request: Request) {
  const authorization = await requireFinanceAdmin(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const { db: untypedDb } = await connectToDatabase();
    const db = untypedDb as Db;
    const [backlogRows, workerLock] = await Promise.all([
      db.collection("pagamentos.webhook_eventos_v2").aggregate([
        {
          $match: {
            status: { $in: ["PENDING", "PROCESSING", "FAILED", "REVIEW_REQUIRED"] },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            oldestReceivedAt: { $min: "$receivedAt" },
          },
        },
      ]).toArray(),
      db.collection<WebhookWorkerLockDocument>("pagamentos.webhook_worker_locks").findOne(
        { _id: "asaas-global-fifo" },
        {
          projection: {
            owner: 1,
            leaseUntil: 1,
            blockedByFailedEvent: 1,
            updatedAt: 1,
          },
        },
      ),
    ]);
    const ledger = buildLedgerBacklogSummary(backlogRows, workerLock);
    const url = new URL(request.url);
    const rawEdition = url.searchParams.get("edicaoId");
    const requestedEdition = rawEdition ? normalizeEditionId(rawEdition) : null;

    if (rawEdition && !requestedEdition) {
      return Response.json(
        { error: "invalid_edition", message: "O identificador da edição é inválido." },
        { status: 400 },
      );
    }

    const activeEditionId = await getActiveEditionId(db);
    const edicaoId = requestedEdition ?? activeEditionId;
    if (!edicaoId) {
      return Response.json({
        activeEditionId: null,
        edicaoId: null,
        items: [],
        metrics: {
          totalCodigos: 0,
          ativos: 0,
          descontos: 0,
          rastreios: 0,
          vendasConfirmadas: 0,
          pagamentosPendentes: 0,
          vendasEstornadas: 0,
          revisoesFinanceiras: 0,
          atribuicoesSemSessao: 0,
          sessoesSemAtribuicao: 0,
          vendasBrutas: 0,
          valorBrutoConfirmadoCentavos: 0,
          valorEstornadoDoneCentavos: 0,
          valorEmRiscoCentavos: 0,
          valorLiquidoCentavos: 0,
          webhooksEmRevisao: ledger.counts.reviewRequired,
          webhooksFalhos: ledger.counts.failed,
        },
        ledger,
        pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
      });
    }

    const codes = await db
      .collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION)
      .find(
        { edicaoId },
        {
          projection: {
            codigo: 1,
            codigoNormalizado: 1,
            edicaoId: 1,
            tipo: 1,
            percentualDesconto: 1,
            responsavel: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    const ledgerSummaries = (await db
      .collection(PAYMENT_ATTRIBUTIONS_COLLECTION)
      .aggregate<LedgerSummary>([
        { $match: { edicaoId } },
        {
          $lookup: {
            from: "pagamentos.sessoes",
            localField: "compraId",
            foreignField: "_id",
            as: "linkedSessions",
          },
        },
        { $set: { linkedSessionCount: { $size: "$linkedSessions" } } },
        {
          $project: {
            status: 1,
            valoresCentavos: 1,
            valorSelecionadoCentavos: 1,
            pagamento: 1,
            createdAt: 1,
            updatedAt: 1,
            recognizedSale: PAYMENT_RECOGNIZED_SALE_EXPRESSION,
            requiresFinancialReview: {
              $or: [
                PAYMENT_FINANCIAL_RISK_EXPRESSION,
                { $ne: ["$linkedSessionCount", 1] },
              ],
            },
            grossAmountCentavos: PAYMENT_GROSS_AMOUNT_EXPRESSION,
            refundDoneCentavos: PAYMENT_EFFECTIVE_REFUND_EXPRESSION,
            netAmountCentavos: PAYMENT_NET_AMOUNT_EXPRESSION,
            codigos: {
              $concatArrays: [
                {
                  $cond: [
                    { $eq: [{ $type: "$codigoDesconto" }, "object"] },
                    [
                      {
                        tipo: "DESCONTO",
                        codigo: "$codigoDesconto.codigo",
                        codigoNormalizado: "$codigoDesconto.codigoNormalizado",
                        codigoId: "$codigoDesconto.codigoId",
                        percentualDesconto: "$codigoDesconto.percentualDesconto",
                      },
                    ],
                    [],
                  ],
                },
                {
                  $cond: [
                    { $eq: [{ $type: "$codigoRastreio" }, "object"] },
                    [
                      {
                        tipo: "RASTREIO",
                        codigo: "$codigoRastreio.codigo",
                        codigoNormalizado: "$codigoRastreio.codigoNormalizado",
                        codigoId: "$codigoRastreio.codigoId",
                        responsavel: "$codigoRastreio.responsavel",
                      },
                    ],
                    [],
                  ],
                },
              ],
            },
          },
        },
        { $unwind: "$codigos" },
        {
          $match: {
            "codigos.codigoNormalizado": { $type: "string" },
            "codigos.tipo": { $in: ["DESCONTO", "RASTREIO"] },
          },
        },
        {
          $group: {
            _id: {
              tipo: "$codigos.tipo",
              codigoNormalizado: "$codigos.codigoNormalizado",
            },
            codigo: { $first: "$codigos.codigo" },
            codigoId: { $first: "$codigos.codigoId" },
            percentualDesconto: { $first: "$codigos.percentualDesconto" },
            responsavel: { $first: "$codigos.responsavel" },
            confirmadas: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "CONFIRMADA"] },
                      { $eq: ["$requiresFinancialReview", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            confirmadasBrutas: {
              $sum: { $cond: ["$recognizedSale", 1, 0] },
            },
            pendentes: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["ABERTA", "PAGAMENTO_PENDENTE"]] },
                  1,
                  0,
                ],
              },
            },
            estornadas: {
              $sum: { $cond: [{ $eq: ["$status", "ESTORNADA"] }, 1, 0] },
            },
            canceladasOuExpiradas: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["CANCELADA", "EXPIRADA"]] },
                  1,
                  0,
                ],
              },
            },
            emRevisaoFinanceira: {
              $sum: { $cond: ["$requiresFinancialReview", 1, 0] },
            },
            valorConfirmadoCentavos: {
              $sum: {
                $cond: ["$recognizedSale", "$netAmountCentavos", 0],
              },
            },
            valorBrutoConfirmadoCentavos: {
              $sum: { $cond: ["$recognizedSale", "$grossAmountCentavos", 0] },
            },
            valorEstornadoDoneCentavos: {
              $sum: { $cond: ["$recognizedSale", "$refundDoneCentavos", 0] },
            },
            valorEmRiscoCentavos: {
              $sum: {
                $cond: [
                  {
                    $and: ["$recognizedSale", "$requiresFinancialReview"],
                  },
                  "$netAmountCentavos",
                  0,
                ],
              },
            },
            valorLiquidoCentavos: {
              $sum: { $cond: ["$recognizedSale", "$netAmountCentavos", 0] },
            },
            createdAt: { $min: "$createdAt" },
            updatedAt: { $max: "$updatedAt" },
          },
        },
      ])
      .toArray()) as LedgerSummary[];

    // A compra pode conter desconto e rastreio ao mesmo tempo. As métricas gerais
    // contam compras únicas; as métricas de cada linha continuam contando usos do código.
    const hasAnyCode = {
      $or: [
        { codigoDesconto: { $exists: true } },
        { codigoRastreio: { $exists: true } },
      ],
    };
    const sessionHasAnyCode = {
      $or: [
        { codigoDesconto: { $exists: true } },
        { codigoRastreio: { $exists: true } },
      ],
    };
    const [sessionsForEdition, attributedPurchaseIds] = await Promise.all([
      db.collection("pagamentos.sessoes")
        .find({ edicaoId }, { projection: { _id: 1 } })
        .toArray(),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).distinct("compraId", { edicaoId }),
    ]);
    const sessionIds = sessionsForEdition.map((paymentSession) => paymentSession._id);
    const [
      confirmedPurchases,
      grossPurchases,
      pendingPurchases,
      refundedPurchases,
      financialRiskPurchases,
      attributionsMissingSession,
      attributionsMissingSessionWithoutOtherRisk,
      sessionsMissingAttribution,
      financialTotalsRows,
    ] = await Promise.all([
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).countDocuments({
        edicaoId,
        status: "CONFIRMADA",
        compraId: { $in: sessionIds },
        $expr: { $not: [PAYMENT_FINANCIAL_RISK_EXPRESSION] },
        ...hasAnyCode,
      }),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).countDocuments({
        edicaoId,
        status: { $in: ["CONFIRMADA", "ESTORNADA"] },
        ...hasAnyCode,
      }),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).countDocuments({
        edicaoId,
        status: { $in: ["ABERTA", "PAGAMENTO_PENDENTE"] },
        ...hasAnyCode,
      }),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).countDocuments({
        edicaoId,
        status: "ESTORNADA",
        ...hasAnyCode,
      }),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).countDocuments({
        edicaoId,
        $expr: PAYMENT_FINANCIAL_RISK_EXPRESSION,
        ...hasAnyCode,
      }),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).countDocuments({
        edicaoId,
        compraId: { $nin: sessionIds },
        ...hasAnyCode,
      }),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).countDocuments({
        edicaoId,
        compraId: { $nin: sessionIds },
        $expr: { $not: [PAYMENT_FINANCIAL_RISK_EXPRESSION] },
        ...hasAnyCode,
      }),
      db.collection("pagamentos.sessoes").countDocuments({
        edicaoId,
        _id: { $nin: attributedPurchaseIds },
        ...sessionHasAnyCode,
      }),
      db.collection(PAYMENT_ATTRIBUTIONS_COLLECTION).aggregate<GeneralFinancialTotals>([
        { $match: { edicaoId, ...hasAnyCode } },
        {
          $project: {
            recognizedSale: PAYMENT_RECOGNIZED_SALE_EXPRESSION,
            requiresFinancialReview: {
              $or: [
                PAYMENT_FINANCIAL_RISK_EXPRESSION,
                { $not: [{ $in: ["$compraId", sessionIds] }] },
              ],
            },
            grossAmountCentavos: PAYMENT_GROSS_AMOUNT_EXPRESSION,
            refundDoneCentavos: PAYMENT_EFFECTIVE_REFUND_EXPRESSION,
            netAmountCentavos: PAYMENT_NET_AMOUNT_EXPRESSION,
          },
        },
        {
          $group: {
            _id: null,
            valorBrutoConfirmadoCentavos: {
              $sum: { $cond: ["$recognizedSale", "$grossAmountCentavos", 0] },
            },
            valorEstornadoDoneCentavos: {
              $sum: { $cond: ["$recognizedSale", "$refundDoneCentavos", 0] },
            },
            valorEmRiscoCentavos: {
              $sum: {
                $cond: [
                  { $and: ["$recognizedSale", "$requiresFinancialReview"] },
                  "$netAmountCentavos",
                  0,
                ],
              },
            },
            valorLiquidoCentavos: {
              $sum: { $cond: ["$recognizedSale", "$netAmountCentavos", 0] },
            },
          },
        },
      ]).toArray(),
    ]);
    const financialReviewPurchases =
      financialRiskPurchases +
      attributionsMissingSessionWithoutOtherRisk +
      sessionsMissingAttribution;
    const financialTotals = financialTotalsRows[0] ?? {
      valorBrutoConfirmadoCentavos: 0,
      valorEstornadoDoneCentavos: 0,
      valorEmRiscoCentavos: 0,
      valorLiquidoCentavos: 0,
    };

    const summariesByCode = new Map(
      ledgerSummaries.map((summary) => [
        codeKey(summary._id.tipo, summary._id.codigoNormalizado),
        summary,
      ]),
    );

    const allItems: PaymentCodeListItem[] = codes.map((code) => {
      const summary = summariesByCode.get(codeKey(code.tipo, code.codigoNormalizado));
      summariesByCode.delete(codeKey(code.tipo, code.codigoNormalizado));
      return {
        id: code._id?.toHexString() ?? null,
        edicaoId,
        codigo: code.codigo,
        codigoNormalizado: code.codigoNormalizado,
        tipo: code.tipo,
        percentualDesconto: code.percentualDesconto,
        responsavel: code.responsavel,
        status: code.status,
        historico: false,
        createdAt: dateToIso(code.createdAt),
        updatedAt: dateToIso(code.updatedAt),
        metrics: summaryMetrics(summary),
      };
    });

    for (const summary of summariesByCode.values()) {
      allItems.push({
        id: summary.codigoId ? String(summary.codigoId) : null,
        edicaoId,
        codigo: summary.codigo || summary._id.codigoNormalizado,
        codigoNormalizado: summary._id.codigoNormalizado,
        tipo: summary._id.tipo,
        percentualDesconto: summary.percentualDesconto,
        responsavel: summary.responsavel,
        status: "CONSUMIDO",
        historico: true,
        createdAt: dateToIso(summary.createdAt),
        updatedAt: dateToIso(summary.updatedAt),
        metrics: summaryMetrics(summary),
      });
    }

    allItems.sort((left, right) =>
      (right.updatedAt ?? right.createdAt ?? "").localeCompare(
        left.updatedAt ?? left.createdAt ?? "",
      ),
    );

    const metrics = {
      totalCodigos: allItems.length,
      ativos: allItems.filter((item) => item.status === "ATIVO").length,
      descontos: allItems.filter((item) => item.tipo === "DESCONTO").length,
      rastreios: allItems.filter((item) => item.tipo === "RASTREIO").length,
      vendasConfirmadas: confirmedPurchases,
      vendasBrutas: grossPurchases,
      pagamentosPendentes: pendingPurchases,
      vendasEstornadas: refundedPurchases,
      revisoesFinanceiras: financialReviewPurchases,
      atribuicoesSemSessao: attributionsMissingSession,
      sessoesSemAtribuicao: sessionsMissingAttribution,
      valorBrutoConfirmadoCentavos: financialTotals.valorBrutoConfirmadoCentavos,
      valorEstornadoDoneCentavos: financialTotals.valorEstornadoDoneCentavos,
      valorEmRiscoCentavos: financialTotals.valorEmRiscoCentavos,
      valorLiquidoCentavos: financialTotals.valorLiquidoCentavos,
      webhooksEmRevisao: ledger.counts.reviewRequired,
      webhooksFalhos: ledger.counts.failed,
    };

    const rawType = url.searchParams.get("tipo");
    const rawStatus = url.searchParams.get("status");
    const search = (url.searchParams.get("search") ?? "").trim().toLocaleUpperCase();
    const typeFilter = rawType && isPaymentCodeType(rawType) ? rawType : null;
    const statusFilter: PaymentCodeStatus | "CONSUMIDO" | null =
      rawStatus === "CONSUMIDO"
        ? "CONSUMIDO"
        : rawStatus && isPaymentCodeStatus(rawStatus)
          ? rawStatus
          : null;

    if (rawType && !typeFilter) {
      return Response.json(
        { error: "invalid_type", message: "O tipo de código é inválido." },
        { status: 400 },
      );
    }
    if (rawStatus && !statusFilter) {
      return Response.json(
        { error: "invalid_status", message: "O status do código é inválido." },
        { status: 400 },
      );
    }

    const filteredItems = allItems.filter((item) => {
      if (typeFilter && item.tipo !== typeFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (
        search &&
        !item.codigo.includes(search) &&
        !item.responsavel?.nome.toLocaleUpperCase().includes(search) &&
        !item.responsavel?.email?.toLocaleUpperCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    const page = parsePositiveInteger(url.searchParams.get("page"), 1, 100_000);
    const limit = parsePositiveInteger(url.searchParams.get("limit"), 25, 100);
    const start = (page - 1) * limit;

    return Response.json({
      activeEditionId,
      edicaoId,
      items: filteredItems.slice(start, start + limit),
      metrics,
      ledger,
      pagination: {
        page,
        limit,
        total: filteredItems.length,
        totalPages: Math.ceil(filteredItems.length / limit),
      },
    });
  } catch (error) {
    console.error("Erro ao listar códigos de pagamento:", error);
    return Response.json(
      { error: "internal_server_error", message: "Não foi possível listar os códigos." },
      { status: 500 },
    );
  }
}
