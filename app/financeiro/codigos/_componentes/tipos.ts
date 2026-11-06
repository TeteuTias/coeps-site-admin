import type { AdminPaymentLedgerBacklog } from "@/app/lib/types/payments/payment-admin.t";

export type CodeType = "DESCONTO" | "RASTREIO";
// A aba "SAUDE" lista os códigos de perfil PROFISSIONAL_SAUDE (tipo DESCONTO).
export type CodeTab = CodeType | "SAUDE";
export type CodeStatus = "ATIVO" | "RESERVADO" | "INATIVO" | "USADO" | "CONSUMIDO";

export interface CodeMetrics {
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
}

export interface CodeItem {
  id: string | null;
  edicaoId: string;
  codigo: string;
  codigoNormalizado: string;
  tipo: CodeType;
  percentualDesconto?: number;
  responsavel?: { nome: string; email?: string };
  status: CodeStatus;
  historico: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  metrics: CodeMetrics;
  perfilUtilizador?: "ORGANIZADOR" | "CONGRESSISTA" | "PROFISSIONAL_SAUDE";
  limiteUsos?: number;
  usosRealizados?: number;
}

export type CreatedCodeItem = Pick<
  CodeItem,
  "id" | "edicaoId" | "codigo" | "codigoNormalizado" | "tipo" | "percentualDesconto" | "perfilUtilizador" | "status" | "createdAt"
>;

export interface CodesResponse {
  activeEditionId: string | null;
  edicaoId: string | null;
  organizerPriceCents: number | null;
  items: CodeItem[];
  metrics: {
    totalCodigos: number;
    ativos: number;
    descontos: number;
    profissionaisSaude: number;
    rastreios: number;
    vendasConfirmadas: number;
    vendasBrutas: number;
    pagamentosPendentes: number;
    vendasEstornadas: number;
    revisoesFinanceiras: number;
    atribuicoesSemSessao: number;
    sessoesSemAtribuicao: number;
    webhooksEmRevisao: number;
    webhooksFalhos: number;
    valorBrutoConfirmadoCentavos: number;
    valorEstornadoDoneCentavos: number;
    valorEmRiscoCentavos: number;
    valorLiquidoCentavos: number;
  };
  ledger: AdminPaymentLedgerBacklog;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CleanupPreview {
  edicaoId: string;
  activeEditionId: string;
  isActiveEdition: boolean;
  eligible: boolean;
  reason: string | null;
  retentionDays: number;
  cutoffDate: string;
  latestRelevantDate: string | null;
  expectedConfirmation: string;
  counts: { codigos: number; atribuicoes: number; total: number };
}

export interface CodigoIgnorado { id: string; codigo?: string; motivo: string }

/** A API recusa o lote inteiro acima disto (MAX_BULK_CODE_DELETION). */
export const LIMITE_EXCLUSAO_LOTE = 500;
export const LIMITE_USOS_MAX = 5000;

/** Erro de rede (sem resposta) separado de recusa do servidor, para orientar "confira antes de repetir". */
export class SemRespostaError extends Error {}

/** 403: a conta não é administradora financeira. Tentar de novo não resolve, então a tela explica em vez de oferecer nova tentativa. */
export class SemPermissaoError extends Error {}
export const ehSemPermissao = (error: unknown) => error instanceof SemPermissaoError;

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new SemRespostaError("Sem resposta do servidor. Confira a conexão e veja se a operação foi aplicada antes de repetir.");
  }
  const payload = (await response.json().catch(() => ({}))) as { message?: string; [key: string]: unknown };
  if (response.status === 403) throw new SemPermissaoError(payload.message || "Sua conta não tem permissão para esta área.");
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload as T;
}

export const ehAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
export const mensagemErro = (error: unknown, padrao: string) => (error instanceof Error && error.message ? error.message : padrao);

export function usageCount(item: CodeItem) {
  return item.metrics.confirmadasBrutas + item.metrics.pendentes + item.metrics.canceladasOuExpiradas;
}

// Espelha as regras do servidor; o servidor revalida e devolve o motivo de cada código ignorado.
export function canDeleteCode(item: CodeItem, isActiveEdition: boolean) {
  return (
    isActiveEdition &&
    !item.historico &&
    item.status !== "RESERVADO" &&
    usageCount(item) === 0 &&
    (item.tipo !== "RASTREIO" || item.status === "INATIVO") &&
    Boolean(item.id)
  );
}

export function canToggleCode(item: CodeItem, isActiveEdition: boolean) {
  return (
    isActiveEdition &&
    !item.historico &&
    item.status !== "RESERVADO" &&
    (item.tipo === "RASTREIO" || usageCount(item) === 0) &&
    Boolean(item.id)
  );
}

export function buildCodeListParams(filters: {
  page: number;
  limit: number;
  editionId: string;
  activeTab: CodeTab;
  statusFilter: string;
  search: string;
}) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  if (filters.editionId) params.set("edicaoId", filters.editionId);
  params.set("tipo", filters.activeTab === "RASTREIO" ? "RASTREIO" : "DESCONTO");
  if (filters.activeTab === "SAUDE") params.set("perfil", "PROFISSIONAL_SAUDE");
  if (filters.statusFilter) params.set("status", filters.statusFilter);
  if (filters.search) params.set("search", filters.search);
  return params;
}

export function formatAge(seconds: number | null) {
  if (seconds === null) return "Nenhum evento esperando";
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86400)} d`;
}

/** Código de saúde com todos os usos feitos: pode estar ATIVO (após reativar) ou USADO. */
export function estaEsgotado(item: CodeItem) {
  return item.limiteUsos !== undefined && (item.usosRealizados ?? 0) >= item.limiteUsos;
}

export type SeloEstado = { tom: "ok" | "alerta" | "erro" | "info" | "neutro" | "escuro"; texto: string; dica?: string };

/** Estados visíveis em texto: ativo, esgotado, inativo/suspenso, reservado, usado, histórico. */
export function selosDoCodigo(item: CodeItem): SeloEstado[] {
  const saude = item.perfilUtilizador === "PROFISSIONAL_SAUDE";
  const esgotado = estaEsgotado(item);
  switch (item.status) {
    case "ATIVO":
      return esgotado
        ? [{ tom: "alerta", texto: "Esgotado", dica: "Ativo, mas sem usos restantes: ninguém mais consegue usar." }]
        : [{ tom: "ok", texto: "Ativo" }];
    case "USADO":
      return [saude || esgotado ? { tom: "info", texto: "Esgotado", dica: "Todos os usos do limite foram feitos." } : { tom: "info", texto: "Usado", dica: "O código de uso único já foi usado." }];
    case "INATIVO":
      return [
        { tom: "erro", texto: saude ? "Suspenso ou desativado" : "Desativado", dica: saude ? "Bloqueado pela suspensão do repasse ou desativado à mão. A lista ainda não distingue os dois." : undefined },
        ...(esgotado ? [{ tom: "alerta", texto: "Esgotado" } as SeloEstado] : []),
      ];
    case "RESERVADO":
      return [{ tom: "alerta", texto: "Reservado", dica: "Há uma compra em andamento usando este código." }];
    default:
      return [{ tom: "neutro", texto: "Histórico", dica: "Código que já saiu do catálogo, só com vendas registradas." }];
  }
}

export function descreverBeneficio(item: CodeItem, organizerPriceText: string) {
  if (item.tipo === "RASTREIO") return { titulo: item.responsavel?.nome ?? "Responsável não informado", sub: item.responsavel?.email ?? "Sem e-mail" };
  if (item.perfilUtilizador === "ORGANIZADOR") return { titulo: "Organizador", sub: organizerPriceText };
  if (item.perfilUtilizador === "PROFISSIONAL_SAUDE") return { titulo: "Profissional da saúde", sub: "Inscrição gratuita" };
  return { titulo: `${item.percentualDesconto ?? "—"}% de desconto`, sub: "Congressista" };
}

/** "O que fazer" para cada motivo que a API devolve ao ignorar um código na exclusão em lote. */
export function orientacaoParaMotivo(motivo: string) {
  if (motivo.includes("não encontrado")) return "Já foi excluído ou não existe. Atualize a lista.";
  if (motivo.includes("outra edição")) return "Só códigos da edição ativa podem ser excluídos.";
  if (motivo.includes("reservado")) return "Espere a compra em andamento terminar e tente de novo.";
  if (motivo.includes("Desative o rastreio")) return "Desative o rastreio e exclua de novo.";
  if (motivo.includes("vinculado a uma compra")) return "Não pode ser excluído. Se não quiser que seja usado, desative-o.";
  if (motivo.includes("mudaram de estado")) return "Atualize a lista, confira o estado e tente de novo.";
  return "Atualize a lista e confira o código antes de tentar de novo.";
}
