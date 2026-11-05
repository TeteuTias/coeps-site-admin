import type { SituacaoId } from "./situacao";

// Rascunho do parecer e das notas de cada trabalho. Vive na página (não no cartão) e é espelhado na sessão
// do navegador: filtrar, buscar ou atualizar a lista não apaga o que o avaliador digitou.
export interface Rascunho {
  parecer?: string;
  situacao?: SituacaoId;
  fichas?: Record<string, { nota?: string; justificativa?: string }>;
}
export type Rascunhos = Record<string, Rascunho>;

const CHAVE = "cieps:trabalhos:rascunhos";

export const textoDe = (html?: string) => (html ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

export function lerRascunhos(): Rascunhos {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function gravarRascunhos(r: Rascunhos) {
  try {
    if (Object.keys(r).length) sessionStorage.setItem(CHAVE, JSON.stringify(r));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // armazenamento bloqueado: o rascunho continua só em memória
  }
}
