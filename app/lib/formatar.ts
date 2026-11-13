// Formatos únicos para dinheiro, número e data em todas as telas.
// Regra: valor ausente vira "Indisponível", nunca zero. R$ 0,00 é um dado; "Indisponível" é a falta dele.

export const INDISPONIVEL = "Indisponível";
const FUSO = "America/Sao_Paulo";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR");
const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

const ehNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Valor em reais. */
export function formatarMoeda(reais: number | null | undefined): string {
  return ehNumero(reais) ? moeda.format(reais) : INDISPONIVEL;
}

/** Valor em centavos (como o financeiro grava as parcelas). */
export function formatarCentavos(centavos: number | null | undefined): string {
  return ehNumero(centavos) ? moeda.format(centavos / 100) : INDISPONIVEL;
}

export function formatarNumero(n: number | null | undefined): string {
  return ehNumero(n) ? numero.format(n) : INDISPONIVEL;
}

/** Recebe a razão (0,78 → "78%"). */
export function formatarPercentual(razao: number | null | undefined, casas = 0): string {
  return ehNumero(razao) ? `${(razao * 100).toFixed(casas).replace(".", ",")}%` : INDISPONIVEL;
}

function paraData(valor: unknown): Date | null {
  if (!(typeof valor === "string" || typeof valor === "number" || valor instanceof Date)) return null;
  const d = new Date(valor);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "04/11/2026 10:00" no horário de Brasília, onde quer que o navegador esteja. */
export function formatarDataHora(valor: unknown, vazio = "Data não informada"): string {
  const d = paraData(valor);
  return d ? dataHora.format(d).replace(",", "") : vazio;
}

export function formatarData(valor: unknown, vazio = "Data não informada"): string {
  const d = paraData(valor);
  return d ? dataCurta.format(d) : vazio;
}

export function formatarHora(valor: unknown, vazio = "—"): string {
  const d = paraData(valor);
  return d ? hora.format(d) : vazio;
}
