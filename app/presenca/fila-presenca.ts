// Fila de presenças que não chegaram ao servidor (sem internet, servidor fora ou sem resposta).
// Fica no aparelho (localStorage) e vale para todas as chamadas: reabrir qualquer chamada reenvia o que sobrou.
// Reenviar é seguro: as rotas usam $addToSet/$pull, então repetir o mesmo pedido não duplica nada.

export type TipoAtividade = "minicurso" | "palestra";
export type QuerFila = "dar" | "retirar";

export interface Pendente {
  /** Uma entrada por atividade + turno + pessoa: a ação mais nova substitui a anterior. */
  chave: string;
  tipo: TipoAtividade;
  eventId: string;
  turno?: "init" | "end";
  userId: string;
  nome: string;
  quer: QuerFila;
  /** Momento do bip (ms). */
  criadoEm: number;
}

export const CHAVE_ARMAZENAMENTO = "cieps-admin:presencas-pendentes";

export function chaveDe(p: Pick<Pendente, "tipo" | "eventId" | "turno" | "userId">): string {
  return `${p.tipo}:${p.eventId}:${p.turno ?? "-"}:${p.userId}`;
}

function ehPendente(x: unknown): x is Pendente {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return typeof p.chave === "string" && (p.tipo === "minicurso" || p.tipo === "palestra")
    && typeof p.eventId === "string" && typeof p.userId === "string" && typeof p.nome === "string"
    && (p.quer === "dar" || p.quer === "retirar") && typeof p.criadoEm === "number"
    && (p.turno === undefined || p.turno === "init" || p.turno === "end");
}

/** Lê a fila salva; conteúdo estragado vira fila vazia (nunca derruba a tela). */
export function lerFila(texto: string | null): Pendente[] {
  if (!texto) return [];
  try {
    const v: unknown = JSON.parse(texto);
    return Array.isArray(v) ? v.filter(ehPendente) : [];
  } catch {
    return [];
  }
}

/** Coloca na fila; se já havia algo para a mesma pessoa/atividade/turno, a ação nova substitui. */
export function enfileirar(fila: readonly Pendente[], p: Omit<Pendente, "chave">): Pendente[] {
  const chave = chaveDe(p);
  return [...fila.filter((x) => x.chave !== chave), { ...p, chave }];
}

export function tirarDaFila(fila: readonly Pendente[], chave: string): Pendente[] {
  return fila.filter((x) => x.chave !== chave);
}

/** Rota e corpo de cada pendente (as mesmas rotas que a tela usa ao vivo). */
export function requisicaoDe(p: Pendente): { url: string; corpo: Record<string, string> } {
  if (p.tipo === "minicurso") {
    return { url: p.quer === "dar" ? "/api/post/darPresenca" : "/api/post/retirarPresenca", corpo: { eventId: p.eventId, userId: p.userId } };
  }
  return {
    url: p.quer === "dar" ? "/api/post/darPresencaPalestra" : "/api/post/retirarPresencaPalestra",
    corpo: { eventId: p.eventId, userId: p.userId, listType: p.turno ?? "init" },
  };
}

/**
 * O que fazer com a resposta de um envio. `null` = a requisição nem chegou (rede/tempo esgotado).
 * 5xx, 408 e 429 são passageiros: a presença fica na fila. 401 também fica (a sessão expirou; entrar de novo e reenviar).
 * Outros 4xx são definitivos (credencial ou atividade inválida): sai da fila com aviso.
 */
export type Destino = "entregue" | "tentarDepois" | "sessao" | "recusado";
export function destinoDoEnvio(status: number | null): Destino {
  if (status === null) return "tentarDepois";
  if (status >= 200 && status < 300) return "entregue";
  if (status === 401) return "sessao";
  if (status >= 500 || status === 408 || status === 429) return "tentarDepois";
  return "recusado";
}

/** O QR da credencial é o _id do usuário (24 hexadecimais). Qualquer outro texto é leitura inválida. */
export function limparCodigo(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  return /^[0-9a-f]{24}$/.test(t) ? t : null;
}

/** Lê o `{ data: UpdateResult }` das rotas: atividade inexistente, já estava ou gravou. */
export function efeitoDaResposta(corpo: unknown): "gravou" | "jaEstava" | "atividadeInexistente" {
  const data = typeof corpo === "object" && corpo !== null ? (corpo as { data?: { matchedCount?: unknown; modifiedCount?: unknown } }).data : undefined;
  if (data && data.matchedCount === 0) return "atividadeInexistente";
  if (data && data.modifiedCount === 0) return "jaEstava";
  return "gravou";
}
