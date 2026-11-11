import test from "node:test";
import assert from "node:assert/strict";
import {
  activityChargeIds,
  AsaasNotConfiguredError,
  AsaasUnavailableError,
  cancelOpenActivityCharges,
} from "../activity-charge-cancellation.ts";

const apiUrl = "https://sandbox.asaas.com/api/v3/";
const apiKey = "test-key";

function fakeAsaas(responses: Record<string, { status: number; body?: unknown } | "timeout" | undefined>) {
  const calls: string[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    const key = `${init.method} ${url.split("/payments/")[1]}`;
    calls.push(key);
    const response = responses[key];
    if (!response || response === "timeout") throw new Error("timeout");
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status,
    });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

test("ids: só cobranças de atividade deste minicurso, sem repetir", () => {
  const eventId = "6af1d3cf857c1e368ecd01d7";
  const ids = activityChargeIds(
    [
      { id: "pay_1", _type: "activity", _eventID: eventId },
      { id: "pay_1", _type: "activity", _eventID: eventId },
      { id: "pay_2", _type: "activity", _eventID: "outro" },
      { id: "pay_3", _type: "ticket" },
      { _type: "activity", _eventID: eventId },
    ],
    eventId,
  );
  assert.deepEqual(ids, ["pay_1"]);
  assert.deepEqual(activityChargeIds(undefined, eventId), []);
});

test("pendente e vencida são excluídas; paga, estornada e inexistente ficam", async () => {
  const { fetcher, calls } = fakeAsaas({
    "GET pay_pend": { status: 200, body: { status: "PENDING" } },
    "DELETE pay_pend": { status: 200, body: { deleted: true } },
    "GET pay_venc": { status: 200, body: { status: "OVERDUE" } },
    "DELETE pay_venc": { status: 404 },
    "GET pay_paga": { status: 200, body: { status: "RECEIVED" } },
    "GET pay_estornada": { status: 200, body: { status: "REFUNDED" } },
    "GET pay_excluida": { status: 200, body: { status: "PENDING", deleted: true } },
    "GET pay_sumiu": { status: 404 },
  });
  const result = await cancelOpenActivityCharges({
    chargeIds: ["pay_pend", "pay_venc", "pay_paga", "pay_estornada", "pay_excluida", "pay_sumiu"],
    apiUrl,
    apiKey,
    fetcher,
  });
  assert.deepEqual(result.map((item) => item.resultado), [
    "cancelada", "cancelada", "paga", "mantida", "inexistente", "inexistente",
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("DELETE")), ["DELETE pay_pend", "DELETE pay_venc"]);
});

test("Asaas fora do ar ou com erro interrompe, para a inscrição não sair", async () => {
  for (const responses of [
    { "GET pay_1": "timeout" as const },
    { "GET pay_1": { status: 500 } },
    { "GET pay_1": { status: 200, body: { status: "PENDING" } }, "DELETE pay_1": { status: 500 } },
    { "GET pay_1": { status: 200, body: { status: "PENDING" } }, "DELETE pay_1": "timeout" as const },
  ]) {
    const { fetcher } = fakeAsaas(responses);
    await assert.rejects(
      cancelOpenActivityCharges({ chargeIds: ["pay_1"], apiUrl, apiKey, fetcher }),
      AsaasUnavailableError,
    );
  }
});

test("sem cobrança não chama o Asaas; com cobrança e sem chave, recusa", async () => {
  assert.deepEqual(await cancelOpenActivityCharges({ chargeIds: [] }), []);
  await assert.rejects(cancelOpenActivityCharges({ chargeIds: ["pay_1"], apiUrl }), AsaasNotConfiguredError);
});
