import type { SituacaoId } from "./situacao";

// Rascunho do parecer e das notas de cada trabalho. Vive na página (não no cartão) e é espelhado na sessão
// do navegador: filtrar, buscar ou atualizar a lista não apaga o que o avaliador digitou.
export interface Rascunho {
  parecer?: string;
  situacao?: SituacaoId;
  fichas?: Record<string, { nota?: string; justificativa?: string }>;
}
export type Rascunhos = Record<string, Rascunho>;

// A chave leva o dono: outra conta que entre na mesma aba não vê (nem envia) o rascunho de quem saiu.
const chave = (dono: string) => `cieps:trabalhos:rascunhos:${dono}`;

export const textoDe = (html?: string) => (html ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

export function lerRascunhos(dono: string): Rascunhos {
  try {
    const v = JSON.parse(sessionStorage.getItem(chave(dono)) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function gravarRascunhos(dono: string, r: Rascunhos) {
  try {
    if (Object.keys(r).length) sessionStorage.setItem(chave(dono), JSON.stringify(r));
    else sessionStorage.removeItem(chave(dono));
  } catch {
    // armazenamento bloqueado: o rascunho continua só em memória
  }
}
