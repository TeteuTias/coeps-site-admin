// Ao tirar alguém de um minicurso pago, a cobrança em aberto no Asaas precisa sair junto:
// senão a pessoa ainda pode pagar e o webhook do site a reinscreve.
// A limpeza no banco (lista_pagamentos e etapas do pacote) fica com o webhook PAYMENT_DELETED do site.

export type ActivityChargeResult = "cancelada" | "paga" | "inexistente" | "mantida";

export interface ActivityChargeOutcome {
  id: string;
  resultado: ActivityChargeResult;
  status?: string;
}

export class AsaasUnavailableError extends Error {}
/** Faltam ASAAS_API_KEY/ASAAS_API_URL no Admin: tentar de novo não resolve. */
export class AsaasNotConfiguredError extends AsaasUnavailableError {}

const OPEN_STATUSES = new Set(["PENDING", "OVERDUE"]);
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

interface StoredPayment {
  id?: unknown;
  _type?: unknown;
  _eventID?: unknown;
}

/** Ids das cobranças de atividade do usuário para este minicurso. */
export function activityChargeIds(payments: unknown, eventId: string): string[] {
  if (!Array.isArray(payments)) return [];
  const ids = (payments as StoredPayment[])
    .filter((payment) => payment?._type === "activity" && String(payment._eventID) === eventId)
    .map((payment) => (typeof payment.id === "string" ? payment.id : ""))
    .filter(Boolean);
  return [...new Set(ids)];
}

function asaasHeaders(apiKey: string): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    access_token: apiKey,
    "User-Agent": "COEPS-Admin (Node.js)",
  };
}

/**
 * Cancela no Asaas as cobranças ainda em aberto. Paga não é tocada (sem estorno automático).
 * Qualquer resposta inconclusiva do Asaas lança AsaasUnavailableError, para a inscrição não sair
 * enquanto a cobrança continuar aberta. Repetir é seguro: cobrança já excluída conta como inexistente.
 */
export async function cancelOpenActivityCharges(options: {
  chargeIds: string[];
  apiUrl?: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}): Promise<ActivityChargeOutcome[]> {
  const { chargeIds, apiUrl, apiKey, fetcher = fetch } = options;
  if (chargeIds.length === 0) return [];
  if (!apiUrl || !apiKey) throw new AsaasNotConfiguredError("Asaas não configurado no Admin.");

  const outcomes: ActivityChargeOutcome[] = [];
  for (const id of chargeIds) {
    const url = `${apiUrl.replace(/\/+$/, "")}/payments/${encodeURIComponent(id)}`;
    const call = async (method: "GET" | "DELETE") => {
      try {
        return await fetcher(url, {
          method,
          headers: asaasHeaders(apiKey),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new AsaasUnavailableError(`Asaas não respondeu (${method} ${id}).`);
      }
    };

    const lookup = await call("GET");
    if (lookup.status === 404) {
      outcomes.push({ id, resultado: "inexistente" });
      continue;
    }
    if (!lookup.ok) throw new AsaasUnavailableError(`Consulta da cobrança ${id} falhou (${lookup.status}).`);
    const payment = (await lookup.json().catch(() => null)) as { status?: string; deleted?: boolean } | null;
    const status = String(payment?.status || "");
    if (!payment) throw new AsaasUnavailableError(`Consulta da cobrança ${id} veio vazia.`);

    if (payment.deleted) {
      outcomes.push({ id, resultado: "inexistente", status });
    } else if (PAID_STATUSES.has(status)) {
      outcomes.push({ id, resultado: "paga", status });
    } else if (OPEN_STATUSES.has(status)) {
      const removal = await call("DELETE");
      if (!removal.ok && removal.status !== 404) {
        throw new AsaasUnavailableError(`Exclusão da cobrança ${id} falhou (${removal.status}).`);
      }
      outcomes.push({ id, resultado: "cancelada", status });
    } else {
      // Estornada, em estorno, chargeback etc.: não é cobrança em aberto e não cabe ao Admin mexer.
      outcomes.push({ id, resultado: "mantida", status });
    }
  }
  return outcomes;
}
