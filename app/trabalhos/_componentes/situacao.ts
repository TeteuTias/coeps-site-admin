import type { TomSelo } from "@/app/components/ui";

// Identificador estável da situação (usado em filtro, URL e estilo); `api` é o texto que o backend grava.
export type SituacaoId = "em-avaliacao" | "ajustes" | "aceito" | "recusado" | "sem-situacao";

export const SITUACOES: Record<SituacaoId, { rotulo: string; plural: string; tom: TomSelo; api: string | null }> = {
  "em-avaliacao": { rotulo: "Em avaliação", plural: "Em avaliação", tom: "info", api: "Em Avaliação" },
  ajustes: { rotulo: "Necessita de alteração", plural: "Necessitam de alteração", tom: "alerta", api: "Necessita de Alteração" },
  aceito: { rotulo: "Aceito", plural: "Aceitos", tom: "ok", api: "Aceito" },
  recusado: { rotulo: "Recusado", plural: "Recusados", tom: "erro", api: "Recusado" },
  "sem-situacao": { rotulo: "Situação não informada", plural: "Sem situação", tom: "neutro", api: null },
};

/** Situações que o avaliador pode escolher. */
export const ORDEM_AVALIACAO = ["em-avaliacao", "ajustes", "aceito", "recusado"] as const;

export function situacaoDe(status: unknown): SituacaoId {
  const achada = ORDEM_AVALIACAO.find((id) => SITUACOES[id].api === status);
  return achada ?? "sem-situacao";
}
