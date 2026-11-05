// Regras puras da chamada (sem React): ler o resultado das rotas de presença e validar o código do QR.

/** O que a rota de presença realmente fez, lido do `updateOne` que ela devolve em `{ data }`. */
export type Efeito = "aplicado" | "jaEstava" | "alvoInexistente" | "duvidoso";

/** HTTP 200 não prova nada: `matchedCount` diz se a atividade existe, `modifiedCount` se algo mudou. */
export function interpretarEscrita(corpo: unknown): Efeito {
  const data = typeof corpo === "object" && corpo !== null ? (corpo as { data?: unknown }).data : null;
  if (typeof data !== "object" || data === null) return "duvidoso";
  const { matchedCount, modifiedCount } = data as { matchedCount?: unknown; modifiedCount?: unknown };
  if (typeof matchedCount !== "number" || typeof modifiedCount !== "number") return "duvidoso";
  if (matchedCount === 0) return "alvoInexistente";
  return modifiedCount > 0 ? "aplicado" : "jaEstava";
}

/** A credencial é o identificador do usuário (24 caracteres hexadecimais). */
export function limparCodigo(texto: string): string | null {
  const t = texto.trim();
  return /^[0-9a-f]{24}$/i.test(t) ? t : null;
}

/** Busca sem acento e sem diferença de maiúscula. */
export const normalizarBusca = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
