"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ConfirmationModal from "@/app/components/ConfirmationModal";
import {
  ArrowLeft,
  BadgePercent,
  Ban,
  CheckCircle2,
  Clipboard,
  History,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import "./style.css";

type CodeType = "DESCONTO" | "RASTREIO";
type CodeStatus = "ATIVO" | "RESERVADO" | "INATIVO" | "USADO" | "CONSUMIDO";

interface CodeMetrics {
  confirmadas: number;
  pendentes: number;
  estornadas: number;
  canceladasOuExpiradas: number;
  valorConfirmadoCentavos: number;
}

interface CodeItem {
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
}

interface CodesResponse {
  activeEditionId: string | null;
  edicaoId: string | null;
  items: CodeItem[];
  metrics: {
    totalCodigos: number;
    ativos: number;
    descontos: number;
    rastreios: number;
    vendasConfirmadas: number;
    pagamentosPendentes: number;
    vendasEstornadas: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CleanupPreview {
  edicaoId: string;
  activeEditionId: string;
  isActiveEdition: boolean;
  eligible: boolean;
  reason: string | null;
  retentionDays: number;
  cutoffDate: string;
  latestRelevantDate: string | null;
  expectedConfirmation: string;
  counts: {
    codigos: number;
    atribuicoes: number;
    total: number;
  };
}

const EMPTY_METRICS: CodesResponse["metrics"] = {
  totalCodigos: 0,
  ativos: 0,
  descontos: 0,
  rastreios: 0,
  vendasConfirmadas: 0,
  pagamentosPendentes: 0,
  vendasEstornadas: 0,
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    [key: string]: unknown;
  };

  if (!response.ok) {
    throw new Error(payload.message || "Não foi possível concluir a operação.");
  }

  return payload as T;
}

function moneyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function usageCount(item: CodeItem) {
  return (
    item.metrics.confirmadas +
    item.metrics.pendentes +
    item.metrics.estornadas +
    item.metrics.canceladasOuExpiradas
  );
}

export default function PaymentCodesPage() {
  const [items, setItems] = useState<CodeItem[]>([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [activeEditionId, setActiveEditionId] = useState<string | null>(null);
  const [editionInput, setEditionInput] = useState("");
  const [editionId, setEditionId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<CodesResponse["pagination"]>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasLoadedCodes, setHasLoadedCodes] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [codePendingDeletion, setCodePendingDeletion] = useState<CodeItem | null>(null);

  const [discountPercentage, setDiscountPercentage] = useState("10");
  const [trackingName, setTrackingName] = useState("");
  const [trackingEmail, setTrackingEmail] = useState("");

  const [cleanupEdition, setCleanupEdition] = useState("");
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");

  const loadCodes = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (editionId) params.set("edicaoId", editionId);
      if (typeFilter) params.set("tipo", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const data = await requestJson<CodesResponse>(
        `/api/get/pagamentos/codigos?${params.toString()}`,
      );

      setItems(data.items);
      setMetrics(data.metrics);
      setPagination(data.pagination);
      setActiveEditionId(data.activeEditionId);
      setHasLoadedCodes(true);

      if (!editionId && data.edicaoId) {
        setEditionId(data.edicaoId);
        setEditionInput(data.edicaoId);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível carregar os códigos.",
      });
    } finally {
      setLoading(false);
    }
  }, [editionId, page, search, statusFilter, typeFilter]);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  const isActiveEdition = Boolean(
    activeEditionId && editionId && activeEditionId === editionId,
  );

  const metricCards = useMemo(
    () => [
      { label: "Códigos ativos", value: metrics.ativos, icon: Tag },
      { label: "Descontos", value: metrics.descontos, icon: BadgePercent },
      { label: "Rastreios", value: metrics.rastreios, icon: Link2 },
      { label: "Vendas confirmadas", value: metrics.vendasConfirmadas, icon: CheckCircle2 },
    ],
    [metrics],
  );

  function applyEdition(event: FormEvent) {
    event.preventDefault();
    const normalized = editionInput.trim().toUpperCase();
    if (!normalized) return;
    setEditionId(normalized);
    setPage(1);
    setCreatedCode(null);
    setCleanupPreview(null);
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function createDiscount(event: FormEvent) {
    event.preventDefault();
    setMutating(true);
    setMessage(null);
    setCreatedCode(null);

    try {
      const data = await requestJson<{ message: string; code: { codigo: string } }>(
        "/api/post/pagamentos/codigos/desconto/gerar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edicaoId: editionId,
            percentualDesconto: Number(discountPercentage),
          }),
        },
      );
      setCreatedCode(data.code.codigo);
      await loadCodes();
      setMessage({ type: "success", text: data.message });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível gerar o desconto.",
      });
    } finally {
      setMutating(false);
    }
  }

  async function createTracking(event: FormEvent) {
    event.preventDefault();
    setMutating(true);
    setMessage(null);
    setCreatedCode(null);

    try {
      const data = await requestJson<{ message: string; code: { codigo: string } }>(
        "/api/post/pagamentos/codigos/rastreio",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edicaoId: editionId,
            responsavel: {
              nome: trackingName,
              ...(trackingEmail.trim() ? { email: trackingEmail } : {}),
            },
          }),
        },
      );
      setTrackingName("");
      setTrackingEmail("");
      setCreatedCode(data.code.codigo);
      await loadCodes();
      setMessage({ type: "success", text: data.message });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível gerar o rastreio.",
      });
    } finally {
      setMutating(false);
    }
  }

  async function toggleCode(item: CodeItem) {
    if (!item.id) return;
    setMutating(true);
    setMessage(null);

    try {
      const nextStatus = item.status === "ATIVO" ? "INATIVO" : "ATIVO";
      const data = await requestJson<{ message: string }>(
        `/api/put/pagamentos/codigos/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      await loadCodes();
      setMessage({ type: "success", text: data.message });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível alterar o código.",
      });
    } finally {
      setMutating(false);
    }
  }

  async function deleteUnusedCode(item: CodeItem) {
    if (!item.id) return;
    setCodePendingDeletion(null);
    setMutating(true);
    setMessage(null);

    try {
      const data = await requestJson<{ message: string }>(
        `/api/delete/pagamentos/codigos/${item.id}`,
        { method: "DELETE" },
      );
      await loadCodes();
      setMessage({ type: "success", text: data.message });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível excluir o código.",
      });
    } finally {
      setMutating(false);
    }
  }

  async function previewCleanup(event: FormEvent) {
    event.preventDefault();
    setMutating(true);
    setMessage(null);
    setCleanupPreview(null);
    setCleanupConfirmation("");

    try {
      const edition = cleanupEdition.trim().toUpperCase();
      const preview = await requestJson<CleanupPreview>(
        `/api/get/pagamentos/historico/preview?edicaoId=${encodeURIComponent(edition)}`,
      );
      setCleanupPreview(preview);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível gerar a prévia.",
      });
    } finally {
      setMutating(false);
    }
  }

  async function executeCleanup() {
    if (!cleanupPreview?.eligible) return;
    setMutating(true);
    setMessage(null);

    try {
      const data = await requestJson<{
        message: string;
        deleted: { total: number };
      }>(
        `/api/delete/pagamentos/historico/${encodeURIComponent(cleanupPreview.edicaoId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: cleanupConfirmation }),
        },
      );
      setMessage({
        type: "success",
        text: `${data.message} ${data.deleted.total} registros removidos.`,
      });
      setCleanupPreview(null);
      setCleanupConfirmation("");
      if (editionId === cleanupPreview.edicaoId) await loadCodes();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível executar a limpeza.",
      });
    } finally {
      setMutating(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage({ type: "success", text: "Código copiado." });
    } catch {
      setMessage({ type: "error", text: "Não foi possível copiar o código." });
    }
  }

  return (
    <main className="codigos-page">
      <div className="codigos-shell">
        <header className="codigos-hero">
          <div className="codigos-hero-copy">
            <Link href="/financeiro" className="codigos-back-link">
              <ArrowLeft size={18} /> Voltar ao financeiro
            </Link>
            <p className="codigos-eyebrow">CIEPS / Financeiro</p>
            <h1>Códigos de pagamento</h1>
            <p className="codigos-hero-description">
              Gere descontos de uso único, acompanhe rastreios e consulte o andamento das
              vendas vinculadas a cada código.
            </p>
          </div>
          <button
            type="button"
            className="codigos-button codigos-button--secondary"
            onClick={() => void loadCodes()}
            disabled={loading || mutating}
          >
            <RefreshCw size={17} /> Atualizar
          </button>
        </header>

        {message && (
          <div
            className={`codigos-message codigos-message--${message.type}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.text}
          </div>
        )}

        {createdCode && (
          <section className="codigos-created" aria-live="polite">
            <div>
              <strong>Novo código</strong>
              <code>{createdCode}</code>
            </div>
            <button type="button" onClick={() => void copyCode(createdCode)}>
              <Clipboard size={17} /> Copiar
            </button>
          </section>
        )}

        <section className="codigos-toolbar" aria-label="Selecionar edição">
          <form onSubmit={applyEdition} className="codigos-inline-form">
            <label htmlFor="edition">Edição consultada</label>
            <div>
              <input
                id="edition"
                value={editionInput}
                onChange={(event) => setEditionInput(event.target.value)}
                placeholder="COEPS-2026"
                maxLength={64}
              />
              <button className="codigos-button codigos-button--primary" type="submit">
                Consultar
              </button>
            </div>
          </form>
          <div className="codigos-edition-status">
            <span>Edição ativa</span>
            <strong>{activeEditionId ?? "Não configurada"}</strong>
            {editionId && (
              <small className={isActiveEdition ? "is-active" : "is-archive"}>
                {isActiveEdition ? "Edição editável" : "Somente consulta"}
              </small>
            )}
          </div>
        </section>

        {hasLoadedCodes && !activeEditionId && (
          <div className="codigos-warning" role="alert">
            <ShieldAlert size={21} />
            <span>
              Configure <code>PAYMENT_EDITION_ID</code> ou marque um documento de
              <code> ingressos_config</code> com <code>ativo: true</code> e
              <code> edicaoId</code>. Até lá, novos códigos permanecem bloqueados.
            </span>
          </div>
        )}

        <section className="codigos-metrics" aria-label="Resumo dos códigos">
          {metricCards.map(({ label, value, icon: Icon }) => (
            <article key={label}>
              <Icon size={22} />
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>

        <section className="codigos-create-grid">
          <form className="codigos-panel" onSubmit={createDiscount}>
            <div className="codigos-panel-title">
              <BadgePercent size={22} />
              <div>
                <h2>Novo desconto</h2>
                <p>Uso único em todo o congresso. O código é gerado pelo servidor.</p>
              </div>
            </div>
            <label htmlFor="discountPercentage">Percentual de desconto</label>
            <div className="codigos-percentage-input">
              <input
                id="discountPercentage"
                type="number"
                min="1"
                max="99"
                step="1"
                value={discountPercentage}
                onChange={(event) => setDiscountPercentage(event.target.value)}
                required
              />
              <span>%</span>
            </div>
            <button
              className="codigos-button codigos-button--primary"
              type="submit"
              disabled={!isActiveEdition || mutating}
            >
              {mutating ? <Loader2 className="codigos-spin" size={17} /> : <Plus size={17} />}
              Gerar desconto
            </button>
          </form>

          <form className="codigos-panel" onSubmit={createTracking}>
            <div className="codigos-panel-title">
              <UserRound size={22} />
              <div>
                <h2>Novo rastreio</h2>
                <p>Reutilizável e sem alteração no valor da inscrição.</p>
              </div>
            </div>
            <label htmlFor="trackingName">Pessoa responsável</label>
            <input
              id="trackingName"
              value={trackingName}
              onChange={(event) => setTrackingName(event.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
            <label htmlFor="trackingEmail">E-mail (opcional)</label>
            <input
              id="trackingEmail"
              type="email"
              value={trackingEmail}
              onChange={(event) => setTrackingEmail(event.target.value)}
              maxLength={254}
            />
            <button
              className="codigos-button codigos-button--primary"
              type="submit"
              disabled={!isActiveEdition || mutating}
            >
              {mutating ? <Loader2 className="codigos-spin" size={17} /> : <Plus size={17} />}
              Gerar rastreio
            </button>
          </form>
        </section>

        <section className="codigos-panel codigos-list-panel">
          <div className="codigos-list-heading">
            <div>
              <h2>Códigos da edição {editionId || "—"}</h2>
              <p>{pagination.total} resultado(s) para os filtros aplicados.</p>
            </div>
            <form onSubmit={applySearch} className="codigos-search-form">
              <Search size={18} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Código ou responsável"
              />
              <button type="submit">Buscar</button>
            </form>
          </div>

          <div className="codigos-filters">
            <label>
              Tipo
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="DESCONTO">Desconto</option>
                <option value="RASTREIO">Rastreio</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="RESERVADO">Reservado</option>
                <option value="USADO">Usado</option>
                <option value="CONSUMIDO">Consumido/histórico</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="codigos-loading" role="status">
              <Loader2 className="codigos-spin" /> Carregando códigos...
            </div>
          ) : items.length === 0 ? (
            <div className="codigos-empty">
              <Tag size={36} />
              <p>Nenhum código encontrado.</p>
            </div>
          ) : (
            <div className="codigos-table-wrap">
              <table className="codigos-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Configuração</th>
                    <th>Status</th>
                    <th>Confirmadas</th>
                    <th>Pendentes</th>
                    <th>Estornadas</th>
                    <th>Canceladas/expiradas</th>
                    <th>Valor confirmado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const used = usageCount(item) > 0;
                    const canToggle =
                      isActiveEdition &&
                      !item.historico &&
                      item.status !== "RESERVADO" &&
                      (item.tipo === "RASTREIO" || !used) &&
                      Boolean(item.id);
                    const canDelete =
                      isActiveEdition &&
                      !item.historico &&
                      item.status !== "RESERVADO" &&
                      !used &&
                      (item.tipo !== "RASTREIO" || item.status === "INATIVO") &&
                      Boolean(item.id);

                    return (
                      <tr key={`${item.tipo}-${item.codigoNormalizado}`}>
                        <td>
                          <div className="codigos-code-cell">
                            <code>{item.codigo}</code>
                            <button
                              type="button"
                              aria-label={`Copiar ${item.codigo}`}
                              onClick={() => void copyCode(item.codigo)}
                            >
                              <Clipboard size={15} />
                            </button>
                          </div>
                          <small>Criado em {formatDate(item.createdAt)}</small>
                        </td>
                        <td>
                          <strong>{item.tipo === "DESCONTO" ? "Desconto" : "Rastreio"}</strong>
                          <small>
                            {item.tipo === "DESCONTO"
                              ? `${item.percentualDesconto ?? "—"}%`
                              : item.responsavel?.nome ?? "Responsável não informado"}
                          </small>
                          {item.responsavel?.email && <small>{item.responsavel.email}</small>}
                        </td>
                        <td>
                          <span className={`codigos-status codigos-status--${item.status.toLowerCase()}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.metrics.confirmadas}</td>
                        <td>{item.metrics.pendentes}</td>
                        <td>{item.metrics.estornadas}</td>
                        <td>{item.metrics.canceladasOuExpiradas}</td>
                        <td>{moneyFromCents(item.metrics.valorConfirmadoCentavos)}</td>
                        <td>
                          <div className="codigos-actions">
                            <button
                              type="button"
                              aria-label={
                                item.status === "ATIVO"
                                  ? `Desativar código ${item.codigo}`
                                  : `Ativar código ${item.codigo}`
                              }
                              title={
                                canToggle
                                  ? item.status === "ATIVO"
                                    ? "Desativar"
                                    : "Ativar"
                                  : "Somente rastreios ou descontos sem uso da edição ativa podem ser alterados"
                              }
                              disabled={!canToggle || mutating}
                              onClick={() => void toggleCode(item)}
                            >
                              {item.status === "ATIVO" ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                            </button>
                            <button
                              type="button"
                              aria-label={`Excluir código ${item.codigo}`}
                              className="is-danger"
                              title={
                                canDelete
                                  ? "Excluir código não utilizado"
                                  : "Rastreios precisam estar inativos e nenhum código pode ter uso"
                              }
                              disabled={!canDelete || mutating}
                              onClick={() => setCodePendingDeletion(item)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <nav className="codigos-pagination" aria-label="Paginação dos códigos">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </button>
              <span>
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </button>
            </nav>
          )}
        </section>

        <section className="codigos-panel codigos-cleanup-panel">
          <div className="codigos-panel-title">
            <History size={22} />
            <div>
              <h2>Limpeza anual do histórico</h2>
              <p>
                Disponível apenas para edição encerrada, não ativa e sem atividade há mais de
                365 dias. Usuários, pagamentos e comprovantes não são apagados.
              </p>
            </div>
          </div>

          <form onSubmit={previewCleanup} className="codigos-cleanup-form">
            <label htmlFor="cleanupEdition">Edição que será avaliada</label>
            <div>
              <input
                id="cleanupEdition"
                value={cleanupEdition}
                onChange={(event) => setCleanupEdition(event.target.value)}
                placeholder="COEPS-2025"
                required
              />
              <button
                className="codigos-button codigos-button--secondary"
                type="submit"
                disabled={mutating}
              >
                Gerar prévia
              </button>
            </div>
          </form>

          {cleanupPreview && (
            <div className="codigos-cleanup-preview">
              <h3>Prévia de {cleanupPreview.edicaoId}</h3>
              <dl>
                <div>
                  <dt>Códigos</dt>
                  <dd>{cleanupPreview.counts.codigos}</dd>
                </div>
                <div>
                  <dt>Atribuições</dt>
                  <dd>{cleanupPreview.counts.atribuicoes}</dd>
                </div>
                <div>
                  <dt>Registro mais recente</dt>
                  <dd>{formatDate(cleanupPreview.latestRelevantDate)}</dd>
                </div>
              </dl>

              {!cleanupPreview.eligible ? (
                <div className="codigos-warning">
                  <ShieldAlert size={20} /> {cleanupPreview.reason}
                </div>
              ) : (
                <div className="codigos-danger-zone">
                  <p>
                    Para confirmar, digite <code>{cleanupPreview.expectedConfirmation}</code>.
                  </p>
                  <input
                    value={cleanupConfirmation}
                    onChange={(event) => setCleanupConfirmation(event.target.value)}
                    aria-label="Confirmação da limpeza anual"
                  />
                  <button
                    type="button"
                    className="codigos-button codigos-button--danger"
                    disabled={
                      mutating || cleanupConfirmation !== cleanupPreview.expectedConfirmation
                    }
                    onClick={() => void executeCleanup()}
                  >
                    <Trash2 size={17} /> Apagar histórico da edição
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <ConfirmationModal
        isOpen={Boolean(codePendingDeletion)}
        onClose={() => setCodePendingDeletion(null)}
        onConfirm={() => {
          if (codePendingDeletion) void deleteUnusedCode(codePendingDeletion);
        }}
        title="Excluir código não utilizado?"
        confirmText="Excluir código"
      >
        <p className="codigos-confirmation-copy">
          O código <code>{codePendingDeletion?.codigo}</code> será removido permanentemente.
          Essa ação não pode ser desfeita.
        </p>
      </ConfirmationModal>
    </main>
  );
}
