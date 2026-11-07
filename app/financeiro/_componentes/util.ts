import type { useAvisos } from "@/app/components/Avisos";
import type { ILoteAutomatico, IPaymentConfig } from "@/app/lib/types/payments/payment.t";

export type IParcelamento = IPaymentConfig["parcelamentos"][0];
export type Avisar = ReturnType<typeof useAvisos>["avisar"];
export type TipoPagamento = IPaymentConfig["pagamentosAceitos"][number];

export const TIPOS_PAGAMENTO: TipoPagamento[] = ["PIX", "BOLETO", "CREDIT_CARD", "DEBIT_CARD"];

const ROTULO_TIPO: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
};
export const rotuloTipo = (tipo: string) => ROTULO_TIPO[tipo] ?? tipo;

export function mensagemDe(payload: unknown, padrao: string): string {
  return typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
    ? payload.message
    : padrao;
}

/** Recusado = o servidor respondeu e negou. Sem resposta = a rede falhou: a ação pode ou não ter sido aplicada. */
export type ResultadoEnvio = { tipo: "ok" } | { tipo: "recusado"; mensagem: string } | { tipo: "semResposta" };

export async function enviar(url: string, init: RequestInit, padrao: string): Promise<ResultadoEnvio> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    return { tipo: "semResposta" };
  }
  if (resposta.ok) return { tipo: "ok" };
  return { tipo: "recusado", mensagem: mensagemDe(await resposta.json().catch(() => null), padrao) };
}

export function enviarJson(url: string, metodo: "PUT" | "POST", corpo: unknown, padrao: string) {
  return enviar(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }, padrao);
}

/** Mostra o aviso de falha e devolve true quando houve falha. */
export function relatarFalha(avisar: Avisar, r: ResultadoEnvio, titulo: string): boolean {
  if (r.tipo === "ok") return false;
  if (r.tipo === "semResposta") {
    avisar("erro", "Sem resposta do servidor", "Confira o estado atual antes de repetir: a alteração pode ter sido aplicada.");
  } else {
    avisar("erro", titulo, r.mensagem);
  }
  return true;
}

export const hasValidAutomaticStructure = (lots: unknown): lots is ILoteAutomatico[] => {
  if (!Array.isArray(lots) || lots.length === 0) return false;
  const lotCodes = new Set<number>();

  return lots.every((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return false;
    const lot = candidate as Partial<ILoteAutomatico>;
    const lotCode = lot.codigo;
    const capacity = lot.limiteVagas;
    const prices = lot.precos;
    if (
      typeof lotCode !== "number" || !Number.isInteger(lotCode) || lotCode < 0 || lotCodes.has(lotCode) ||
      typeof lot.nome !== "string" || !lot.nome.trim() ||
      typeof capacity !== "number" || !Number.isInteger(capacity) || capacity <= 0 ||
      typeof prices !== "object" || prices === null ||
      ![prices.valorAVista, prices.valorBoleto, prices.valorDebito, prices.valorPix]
        .every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) ||
      !Array.isArray(prices.parcelamentos)
    ) {
      return false;
    }

    lotCodes.add(lotCode);
    const installmentCodes = new Set<number>();
    return prices.parcelamentos.every((installment) => {
      if (typeof installment !== "object" || installment === null) return false;
      if (
        !Number.isInteger(installment.codigo) || installment.codigo < 0 ||
        installmentCodes.has(installment.codigo) ||
        !Number.isInteger(installment.totalParcelas) || installment.totalParcelas <= 0 ||
        typeof installment.valorCadaParcela !== "number" ||
        !Number.isFinite(installment.valorCadaParcela) || installment.valorCadaParcela < 0
      ) {
        return false;
      }
      installmentCodes.add(installment.codigo);
      return true;
    });
  });
};

/** Corpo do PUT de configuração geral: a edição vai sempre explícita, como a tela já fazia. */
export function corpoGeral(config: IPaymentConfig, mudancas: Partial<{
  nome: string; edicaoId: string; valorAVista: number; valorBoleto: number; valorDebito: number; valorPix: number; valorOrganizador: number;
}> = {}) {
  const v = {
    nome: config.nome,
    edicaoId: config.edicaoId ?? "",
    valorAVista: config.valorAVista,
    valorBoleto: config.valorBoleto,
    valorDebito: config.valorDebito,
    valorPix: config.valorPix,
    valorOrganizador: (config.configuracaoOrganizador?.valorFinalCentavos ?? 0) / 100,
    ...mudancas,
  };
  const { valorOrganizador, ...resto } = v;
  return {
    ...resto,
    _id: config._id,
    ...(valorOrganizador > 0 ? { configuracaoOrganizador: { valorFinalCentavos: Math.round(valorOrganizador * 100) } } : {}),
  };
}
