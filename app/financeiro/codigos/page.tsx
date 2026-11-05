"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { BadgePercent, Clipboard, Download, HeartPulse, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";
import {
  Aviso, Botao, Cabecalho, Campo, CampoBusca, Escolha, Metrica, Pagina, Secao, Selo,
} from "@/app/components/ui";
import { Atualizando, Estado } from "@/app/components/Estado";
import { Dialogo } from "@/app/components/Dialogo";
import { useAvisos } from "@/app/components/Avisos";
import { formatarCentavos, formatarMoeda, formatarNumero } from "@/app/lib/formatar";
import { buildPaymentCodesCsv } from "@/app/lib/payments/payment-codes-csv";
import { Diagnostico } from "./_componentes/Diagnostico";
import { Manutencao } from "./_componentes/Manutencao";
import { PainelRepasse } from "./_componentes/PainelRepasse";
import { TabelaCodigos } from "./_componentes/TabelaCodigos";
import {
  LIMITE_EXCLUSAO_LOTE,
  SemRespostaError,
  buildCodeListParams,
  canDeleteCode,
  ehAbortError,
  mensagemErro,
  orientacaoParaMotivo,
  requestJson,
  type CodeItem,
  type CodeTab,
  type CodesResponse,
  type CodigoIgnorado,
  type CreatedCodeItem,
} from "./_componentes/tipos";

const TAMANHO_PAGINA = 25;

const ABAS: { id: CodeTab; rotulo: string; icone: typeof BadgePercent }[] = [
  { id: "DESCONTO", rotulo: "Descontos", icone: BadgePercent },
  { id: "RASTREIO", rotulo: "Rastreios", icone: UserRound },
  { id: "SAUDE", rotulo: "Profissionais da saúde", icone: HeartPulse },
];

interface Filtros { page: number; editionId: string; activeTab: CodeTab; statusFilter: string; search: string }
// A seleção e a lista valem para o conjunto de filtros sem a página; trocar de contexto descarta os dois.
const contextoDe = (f: Filtros) => [f.activeTab, f.editionId, f.statusFilter, f.search].join("|");

interface Lista { contexto: string; items: CodeItem[]; pagination: CodesResponse["pagination"] }
interface Resumo {
  edicaoId: string;
  activeEditionId: string | null;
  organizerPriceCents: number | null;
  metrics: CodesResponse["metrics"];
  ledger: CodesResponse["ledger"];
}
interface ResultadoExclusao { excluidos: number; ignorados: CodigoIgnorado[] }

export default function PaymentCodesPage() {
  const { avisar, confirmar } = useAvisos();

  const [activeTab, setActiveTab] = useState<CodeTab>("DESCONTO");
  const [editionInput, setEditionInput] = useState("");
  const [editionId, setEditionId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [lista, setLista] = useState<Lista | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [acaoAtiva, setAcaoAtiva] = useState<string | null>(null);
  const [ocupadoPainel, setOcupadoPainel] = useState(false);
  const ocupado = acaoAtiva !== null || ocupadoPainel;

  const [createdCodes, setCreatedCodes] = useState<CreatedCodeItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [progressoSelecao, setProgressoSelecao] = useState<string | null>(null);
  const [resultadoExclusao, setResultadoExclusao] = useState<ResultadoExclusao | null>(null);
  const [verIgnorados, setVerIgnorados] = useState(false);

  const [discountPercentage, setDiscountPercentage] = useState("10");
  const [discountQuantity, setDiscountQuantity] = useState("1");
  const [healthLimit, setHealthLimit] = useState("100");
  const [discountProfile, setDiscountProfile] = useState<"ORGANIZADOR" | "CONGRESSISTA">("CONGRESSISTA");
  const [trackingName, setTrackingName] = useState("");
  const [trackingEmail, setTrackingEmail] = useState("");

  // Filtros atuais para as funções assíncronas: um recarregamento disparado por uma ação antiga nunca usa filtros velhos.
  const filtrosRef = useRef<Filtros>({ page, editionId, activeTab, statusFilter, search });
  const pedidoRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const carregadaRef = useRef("");
  const varreduraRef = useRef<AbortController | null>(null);
  const elegiveisRef = useRef<{ contexto: string; ids: string[] } | null>(null);

  const loadCodes = useCallback(async (): Promise<boolean> => {
    const f = filtrosRef.current;
    const pedido = ++pedidoRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCarregando(true);
    setErroLista(null);
    try {
      const params = buildCodeListParams({ ...f, limit: TAMANHO_PAGINA });
      const data = await requestJson<CodesResponse>(`/api/get/pagamentos/codigos?${params.toString()}`, { signal: controller.signal });
      if (pedido !== pedidoRef.current) return false; // chegou depois de um filtro mais novo: descarta
      const edicao = f.editionId || data.edicaoId || "";
      const efetivos = { ...f, editionId: edicao };
      carregadaRef.current = JSON.stringify(efetivos);
      setLista({ contexto: contextoDe(efetivos), items: data.items, pagination: data.pagination });
      setResumo({ edicaoId: edicao, activeEditionId: data.activeEditionId, organizerPriceCents: data.organizerPriceCents, metrics: data.metrics, ledger: data.ledger });
      if (!f.editionId && data.edicaoId) {
        filtrosRef.current = efetivos;
        setEditionId(data.edicaoId);
        setEditionInput(data.edicaoId);
      }
      return true;
    } catch (error) {
      if (ehAbortError(error) || pedido !== pedidoRef.current) return false;
      setErroLista(mensagemErro(error, "Não foi possível carregar os códigos."));
      return false;
    } finally {
      if (pedido === pedidoRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    filtrosRef.current = { page, editionId, activeTab, statusFilter, search };
  }, [page, editionId, activeTab, statusFilter, search]);

  const chaveCarga = JSON.stringify({ page, editionId, activeTab, statusFilter, search });
  useEffect(() => {
    if (carregadaRef.current === chaveCarga) return; // a primeira resposta já trouxe a edição padrão: não pede de novo
    void loadCodes();
  }, [chaveCarga, loadCodes]);

  const contexto = contextoDe({ page, editionId, activeTab, statusFilter, search });
  useEffect(() => {
    setSelectedIds([]);
    setResultadoExclusao(null);
    elegiveisRef.current = null;
    varreduraRef.current?.abort();
  }, [contexto]);

  useEffect(() => () => { abortRef.current?.abort(); varreduraRef.current?.abort(); }, []);

  const isActiveEdition = Boolean(resumo?.activeEditionId && editionId && resumo.activeEditionId === editionId);
  const listaVisivel = lista && lista.contexto === contexto ? lista : null;
  const abaAtual = ABAS.find((a) => a.id === activeTab) ?? ABAS[0];
  const metrics = resumo?.metrics ?? null;
  const contagemAba = (n: number | undefined) => (n === undefined ? "" : formatarNumero(n));

  /** Roda uma operação com o botão em "carregando" e a lista na tela; erro e falta de resposta viram aviso com orientação. */
  async function executar<T>(chave: string, titulo: string, fn: () => Promise<T>): Promise<T | undefined> {
    setAcaoAtiva(chave);
    elegiveisRef.current = null;
    try {
      return await fn();
    } catch (error) {
      avisar("erro", titulo, mensagemErro(error, "Tente de novo."));
      if (error instanceof SemRespostaError) void loadCodes();
      return undefined;
    } finally {
      setAcaoAtiva(null);
    }
  }

  function trocarAba(id: CodeTab) {
    setActiveTab(id);
    setPage(1);
  }

  function aoTeclarAba(event: KeyboardEvent) {
    const atual = ABAS.findIndex((a) => a.id === activeTab);
    const proximo =
      event.key === "ArrowRight" ? (atual + 1) % ABAS.length
      : event.key === "ArrowLeft" ? (atual - 1 + ABAS.length) % ABAS.length
      : event.key === "Home" ? 0
      : event.key === "End" ? ABAS.length - 1
      : -1;
    if (proximo < 0) return;
    event.preventDefault();
    trocarAba(ABAS[proximo].id);
    document.getElementById(`aba-${ABAS[proximo].id}`)?.focus();
  }

  function applyEdition(event: FormEvent) {
    event.preventDefault();
    const normalized = editionInput.trim().toUpperCase();
    if (!normalized) return;
    setEditionId(normalized);
    setPage(1);
    setCreatedCodes([]);
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function limparFiltros() {
    setSearch("");
    setSearchInput("");
    setStatusFilter("");
    setPage(1);
  }

  async function atualizar() {
    elegiveisRef.current = null;
    await loadCodes();
  }

  async function gerar(chave: string, titulo: string, url: string, corpo: unknown, aoConcluir?: () => void) {
    setCreatedCodes([]);
    const dados = await executar(chave, titulo, async () => {
      const data = await requestJson<{ message: string; codes?: CreatedCodeItem[]; code?: CreatedCodeItem }>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      setCreatedCodes(data.codes ?? (data.code ? [data.code] : []));
      aoConcluir?.();
      await loadCodes();
      return data;
    });
    if (dados) avisar("ok", dados.message);
  }

  function createDiscount(event: FormEvent) {
    event.preventDefault();
    void gerar("gerar", "Não foi possível gerar o desconto", "/api/post/pagamentos/codigos/desconto/gerar", {
      edicaoId: editionId,
      quantidade: Number(discountQuantity),
      perfilUtilizador: discountProfile,
      ...(discountProfile === "CONGRESSISTA" ? { percentualDesconto: Number(discountPercentage) } : {}),
    });
  }

  function createHealthCodes(event: FormEvent) {
    event.preventDefault();
    void gerar("gerar", "Não foi possível gerar o código", "/api/post/pagamentos/codigos/desconto/gerar", {
      edicaoId: editionId,
      quantidade: 1,
      limiteUsos: Number(healthLimit),
      perfilUtilizador: "PROFISSIONAL_SAUDE",
    });
  }

  function createTracking(event: FormEvent) {
    event.preventDefault();
    void gerar(
      "gerar",
      "Não foi possível gerar o rastreio",
      "/api/post/pagamentos/codigos/rastreio",
      { edicaoId: editionId, responsavel: { nome: trackingName, ...(trackingEmail.trim() ? { email: trackingEmail } : {}) } },
      () => { setTrackingName(""); setTrackingEmail(""); },
    );
  }

  async function saveHealthLimit(item: CodeItem, limite: number): Promise<boolean> {
    if (!item.id) return false;
    const dados = await executar(`limite:${item.id}`, "Não foi possível alterar o limite", async () => {
      const data = await requestJson<{ message: string }>(`/api/put/pagamentos/codigos/${item.id}/limite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limiteUsos: limite }),
      });
      await loadCodes();
      return data;
    });
    if (dados) avisar("ok", dados.message);
    return Boolean(dados);
  }

  async function toggleCode(item: CodeItem) {
    if (!item.id) return;
    const dados = await executar(`alternar:${item.id}`, "Não foi possível alterar o código", async () => {
      const data = await requestJson<{ message: string }>(`/api/put/pagamentos/codigos/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: item.status === "ATIVO" ? "INATIVO" : "ATIVO" }),
      });
      await loadCodes();
      return data;
    });
    if (dados) avisar("ok", dados.message);
  }

  async function deleteUnusedCode(item: CodeItem) {
    if (!item.id) return;
    const confirmou = await confirmar({
      titulo: `Excluir o código ${item.codigo}?`,
      descricao: "O código será removido para sempre. Não dá para desfazer.",
      perigo: true,
      rotuloConfirmar: "Excluir código",
    });
    if (!confirmou) return;
    const dados = await executar(`excluir:${item.id}`, "Não foi possível excluir o código", async () => {
      const data = await requestJson<{ message: string }>(`/api/delete/pagamentos/codigos/${item.id}`, { method: "DELETE" });
      setSelectedIds((ids) => ids.filter((id) => id !== item.id));
      await loadCodes();
      return data;
    });
    if (dados) avisar("ok", dados.message);
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  }

  function togglePageSelection(pageIds: string[]) {
    setSelectedIds((ids) =>
      pageIds.every((id) => ids.includes(id)) ? ids.filter((id) => !pageIds.includes(id)) : [...new Set([...ids, ...pageIds])],
    );
  }

  function aplicarSelecao(ids: string[]) {
    setSelectedIds(ids);
    if (ids.length === 0) avisar("alerta", "Nada para selecionar", "Nenhum código deste filtro pode ser excluído agora.");
    else if (ids.length > LIMITE_EXCLUSAO_LOTE) avisar("alerta", `${formatarNumero(ids.length)} códigos selecionados`, `A exclusão aceita até ${LIMITE_EXCLUSAO_LOTE} por vez. Use "Selecionar só os primeiros ${LIMITE_EXCLUSAO_LOTE}" ou exclua em etapas.`);
  }

  /** Seleciona os códigos excluíveis do filtro atual em todas as páginas; reaproveita a busca enquanto nada mudou. */
  async function selectAllDeletable() {
    const f = filtrosRef.current;
    const alvo = contextoDe(f);
    if (elegiveisRef.current?.contexto === alvo) {
      aplicarSelecao(elegiveisRef.current.ids);
      return;
    }
    varreduraRef.current?.abort();
    const controller = new AbortController();
    varreduraRef.current = controller;
    setAcaoAtiva("selecionar");
    try {
      const ids: string[] = [];
      for (let atual = 1, total = 1; atual <= total; atual += 1) {
        setProgressoSelecao(`Procurando códigos excluíveis: página ${atual} de ${total}…`);
        const params = buildCodeListParams({ ...f, page: atual, limit: 100 });
        const data = await requestJson<CodesResponse>(`/api/get/pagamentos/codigos?${params.toString()}`, { signal: controller.signal });
        total = data.pagination.totalPages;
        const ativa = Boolean(data.activeEditionId && f.editionId && data.activeEditionId === f.editionId);
        for (const item of data.items) if (canDeleteCode(item, ativa) && item.id) ids.push(item.id);
      }
      if (controller.signal.aborted) return;
      elegiveisRef.current = { contexto: alvo, ids };
      aplicarSelecao(ids);
    } catch (error) {
      if (ehAbortError(error)) return;
      avisar("erro", "Não foi possível selecionar os códigos", mensagemErro(error, "Tente de novo."));
    } finally {
      setProgressoSelecao(null);
      setAcaoAtiva(null);
    }
  }

  async function deleteSelectedCodes() {
    const ids = [...selectedIds];
    if (ids.length === 0 || ids.length > LIMITE_EXCLUSAO_LOTE) return;
    const confirmou = await confirmar({
      titulo: `Excluir ${formatarNumero(ids.length)} código(s)?`,
      descricao: (
        <div className="grid gap-2">
          <p>Você selecionou <strong className="num">{formatarNumero(ids.length)}</strong> código(s). A exclusão aceita no máximo <strong className="num">{LIMITE_EXCLUSAO_LOTE}</strong> por vez.</p>
          <p>Eles serão removidos para sempre. Códigos com compra vinculada, reservados ou rastreios ainda ativos são ignorados e listados no resultado.</p>
        </div>
      ),
      perigo: true,
      digitar: `EXCLUIR ${ids.length}`,
      rotuloConfirmar: `Excluir ${formatarNumero(ids.length)}`,
    });
    if (!confirmou) return;

    const dados = await executar("excluir-lote", "Não foi possível excluir os códigos", async () => {
      const data = await requestJson<{ message: string; excluidos: number; ignorados: CodigoIgnorado[] }>("/api/delete/pagamentos/codigos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setSelectedIds(data.ignorados.map((item) => item.id).filter(Boolean));
      setResultadoExclusao({ excluidos: data.excluidos, ignorados: data.ignorados });
      await loadCodes();
      return data;
    });
    if (dados) avisar(dados.ignorados.length ? "alerta" : "ok", dados.message);
  }

  async function copiar(texto: string, ok: string) {
    try {
      await navigator.clipboard.writeText(texto);
      avisar("ok", ok);
    } catch {
      avisar("erro", "Não foi possível copiar", "O navegador não permitiu. Selecione o texto e copie à mão.");
    }
  }

  function downloadCreatedCodesCsv() {
    const csv = buildPaymentCodesCsv(createdCodes);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `codigos-${editionId || "cieps"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const ignorados = resultadoExclusao?.ignorados ?? [];
  const textoIgnorados = ignorados.map((i) => `${i.codigo ?? "(vários códigos)"} — ${i.motivo} ${orientacaoParaMotivo(i.motivo)}`).join("\n");
  const excedeLimite = selectedIds.length > LIMITE_EXCLUSAO_LOTE;
  const semEdicaoAtiva = Boolean(resumo && !resumo.activeEditionId);
  const bloqueioForm = !isActiveEdition || ocupado;
  const rotuloLista = `${abaAtual.rotulo} da edição ${editionId || "consultada"}`;

  return (
    <Pagina largura="ampla">
      <Cabecalho
        etiqueta="CIEPS · Financeiro"
        titulo="Códigos de pagamento"
        sub="Gere descontos de uso único, acompanhe rastreios e consulte as vendas ligadas a cada código."
        voltar={{ href: "/financeiro", rotulo: "Voltar ao financeiro" }}
        acoes={
          <>
            <Selo tom="info">Edição ativa: {resumo ? (resumo.activeEditionId ?? "não configurada") : "carregando"}</Selo>
            <Botao estilo="contorno" carregando={carregando && Boolean(listaVisivel)} disabled={carregando} onClick={() => void atualizar()}>
              <RefreshCw className="size-4" aria-hidden="true" />Atualizar
            </Botao>
          </>
        }
      />

      <Secao titulo="Edição consultada" descricao="Escolha qual edição você quer ver. Só a edição ativa aceita alterações.">
        <form onSubmit={applyEdition} className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Código da edição" value={editionInput} onChange={(e) => setEditionInput(e.target.value)} placeholder="COEPS-2026" maxLength={64} className="w-full sm:w-72" />
          <Botao type="submit" estilo="contorno" disabled={!editionInput.trim()}>Consultar</Botao>
          {editionId && <Selo tom={isActiveEdition ? "ok" : "info"}>{isActiveEdition ? "Edição ativa: pode alterar" : "Somente consulta"}</Selo>}
        </form>
        {resumo && !isActiveEdition && resumo.activeEditionId && (
          <Aviso tom="info" titulo="Você está vendo uma edição que não é a ativa">
            Gerar, ativar, desativar e excluir códigos só funciona na edição ativa ({resumo.activeEditionId}).
          </Aviso>
        )}
        {semEdicaoAtiva && (
          <Aviso tom="alerta" titulo="Nenhuma edição ativa configurada">
            <p>Enquanto não houver edição ativa, novos códigos ficam bloqueados.</p>
            <details className="mt-1">
              <summary className="cursor-pointer font-medium">Detalhe técnico para quem configura</summary>
              <p className="mt-1">Configure <code>PAYMENT_EDITION_ID</code> ou marque um documento de <code>ingressos_config</code> com <code>ativo: true</code> e <code>edicaoId</code>.</p>
            </details>
          </Aviso>
        )}
      </Secao>

      {createdCodes.length > 0 && (
        <Secao
          titulo={createdCodes.length === 1 ? "Novo código" : "Novo lote de códigos"}
          descricao={`${formatarNumero(createdCodes.length)} código(s) pronto(s) para distribuir. Copie ou baixe agora: esta lista some ao gerar outro código ou sair da página.`}
          acoes={
            <>
              <Botao estilo="contorno" onClick={() => void copiar(createdCodes.map((i) => i.codigo).join("\n"), `${createdCodes.length} código(s) copiado(s)`)}><Clipboard className="size-4" aria-hidden="true" />Copiar todos</Botao>
              <Botao estilo="contorno" onClick={downloadCreatedCodesCsv}><Download className="size-4" aria-hidden="true" />Baixar CSV</Botao>
            </>
          }
        >
          <div role="region" aria-label="Códigos recém-gerados" tabIndex={0} className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
            {createdCodes.map((item) => <code key={item.codigoNormalizado} className="num select-all rounded-lg bg-recuo px-2.5 py-1.5 text-sm">{item.codigo}</code>)}
          </div>
        </Secao>
      )}

      <Secao titulo={`Resumo da edição ${resumo?.edicaoId || editionId || ""}`.trim()} descricao="Vale para a edição inteira, não só para a aba aberta.">
        {!resumo && !carregando && <Aviso tom="erro" titulo="Os números não foram carregados">Os indicadores aparecem como indisponíveis até a lista carregar.</Aviso>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica rotulo="Códigos ativos" valor={metrics ? formatarNumero(metrics.ativos) : null} />
          <Metrica rotulo="Vendas com código" valor={metrics ? formatarNumero(metrics.vendasBrutas) : null} detalhe="Brutas, antes de estornos" />
          <Metrica rotulo="Vendas confirmadas" valor={metrics ? formatarNumero(metrics.vendasConfirmadas) : null} detalhe="Sem risco financeiro" />
          <Metrica rotulo="Compras para revisar" valor={metrics ? formatarNumero(metrics.revisoesFinanceiras) : null} detalhe="Em revisão financeira" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica rotulo="Valor bruto confirmado" valor={metrics ? formatarCentavos(metrics.valorBrutoConfirmadoCentavos) : null} />
          <Metrica rotulo="Estornos concluídos" valor={metrics ? formatarCentavos(metrics.valorEstornadoDoneCentavos) : null} />
          <Metrica rotulo="Valor em risco" valor={metrics ? formatarCentavos(metrics.valorEmRiscoCentavos) : null} />
          <Metrica rotulo="Valor líquido" valor={metrics ? formatarCentavos(metrics.valorLiquidoCentavos) : null} detalhe="Depois dos estornos concluídos" />
        </div>
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2.5 font-medium">Conferências de consistência</summary>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metrica rotulo="Atribuições sem sessão" valor={metrics ? formatarNumero(metrics.atribuicoesSemSessao) : null} />
            <Metrica rotulo="Sessões sem atribuição" valor={metrics ? formatarNumero(metrics.sessoesSemAtribuicao) : null} />
          </div>
        </details>
      </Secao>

      <div className="grid gap-4">
        <div role="tablist" aria-label="Tipo de código" onKeyDown={aoTeclarAba} className="flex flex-wrap gap-2">
          {ABAS.map(({ id, rotulo, icone: Icone }) => {
            const ativa = id === activeTab;
            const n = contagemAba(id === "DESCONTO" ? metrics?.descontos : id === "RASTREIO" ? metrics?.rastreios : metrics?.profissionaisSaude);
            return (
              <button
                key={id}
                id={`aba-${id}`}
                type="button"
                role="tab"
                aria-selected={ativa}
                aria-controls="painel-codigos"
                tabIndex={ativa ? 0 : -1}
                onClick={() => trocarAba(id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${ativa ? "border-tinta bg-tinta text-white" : "border-linha bg-cartao text-tinta hover:border-tinta/40"}`}
              >
                <Icone className="size-4" aria-hidden="true" />{rotulo}{n && <span className="num text-xs opacity-80">{n}</span>}
              </button>
            );
          })}
        </div>

        <div id="painel-codigos" role="tabpanel" aria-labelledby={`aba-${activeTab}`} className="grid gap-4">
          {activeTab === "SAUDE" && (
            <>
              <PainelRepasse
                editionId={editionId}
                activeEditionId={resumo?.activeEditionId ?? null}
                isActiveEdition={isActiveEdition}
                bloqueado={acaoAtiva !== null}
                aoOcupar={setOcupadoPainel}
                aoMudar={atualizar}
              />
              <Secao titulo="Gerar código de profissionais da saúde" descricao="Um único código com vários usos, para a prefeitura divulgar. Inscrição gratuita, sem pagamento no Asaas e sem ocupar vagas dos lotes.">
                <form onSubmit={createHealthCodes} className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo rotulo="Limite de usos" type="number" min={1} max={5000} step={1} value={healthLimit} onChange={(e) => setHealthLimit(e.target.value)} required ajuda="De 1 a 5.000 usos." />
                    <div className="rounded-xl bg-recuo/60 px-4 py-3 text-sm">
                      <p className="text-xs text-sutil">Valor da inscrição</p>
                      <p className="num font-semibold">{formatarMoeda(0)} (gratuita)</p>
                      <p className="text-xs text-sutil">Quem usa o código é marcado como profissional da saúde no cadastro.</p>
                    </div>
                  </div>
                  <div><Botao type="submit" carregando={acaoAtiva === "gerar"} disabled={bloqueioForm}><Plus className="size-4" aria-hidden="true" />Gerar código com {healthLimit || "N"} usos</Botao></div>
                </form>
              </Secao>
            </>
          )}

          {activeTab === "DESCONTO" && (
            <Secao titulo="Gerar descontos" descricao="Cada código é individual, aleatório e de uso único.">
              <form onSubmit={createDiscount} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Escolha rotulo="Perfil do participante" value={discountProfile} onChange={(e) => setDiscountProfile(e.target.value as "ORGANIZADOR" | "CONGRESSISTA")}>
                    <option value="CONGRESSISTA">Congressista</option>
                    <option value="ORGANIZADOR">Organizador</option>
                  </Escolha>
                  <Campo rotulo="Quantidade" type="number" min={1} max={500} step={1} value={discountQuantity} onChange={(e) => setDiscountQuantity(e.target.value)} required ajuda="De 1 a 500 por vez." />
                  {discountProfile === "CONGRESSISTA" ? (
                    <Campo rotulo="Percentual de desconto (%)" type="number" min={1} max={99} step={1} value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} required ajuda="De 1% a 99%." />
                  ) : (
                    <div className="rounded-xl bg-recuo/60 px-4 py-3 text-sm">
                      <p className="text-xs text-sutil">Preço fixo de organizador</p>
                      <p className="num font-semibold">{resumo?.organizerPriceCents ? formatarCentavos(resumo.organizerPriceCents) : "Não configurado"}</p>
                      <p className="text-xs text-sutil">Não ocupa vagas dos lotes.</p>
                    </div>
                  )}
                </div>
                {discountProfile === "ORGANIZADOR" && !resumo?.organizerPriceCents && isActiveEdition && (
                  <Aviso tom="alerta" titulo="Preço de organizador não configurado">Configure o preço na página do financeiro antes de gerar códigos de organizador.</Aviso>
                )}
                <div>
                  <Botao type="submit" carregando={acaoAtiva === "gerar"} disabled={bloqueioForm || (discountProfile === "ORGANIZADOR" && !resumo?.organizerPriceCents)}>
                    <Plus className="size-4" aria-hidden="true" />Gerar {Number(discountQuantity) > 1 ? `${discountQuantity} descontos` : "desconto"}
                  </Botao>
                </div>
              </form>
            </Secao>
          )}

          {activeTab === "RASTREIO" && (
            <Secao titulo="Novo rastreio" descricao="Reutilizável, legível e sem alteração no preço ou no perfil.">
              <form onSubmit={createTracking} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo rotulo="Pessoa responsável" value={trackingName} onChange={(e) => setTrackingName(e.target.value)} minLength={2} maxLength={120} placeholder="Ana Lívia" required />
                  <Campo rotulo="E-mail (opcional)" type="email" value={trackingEmail} onChange={(e) => setTrackingEmail(e.target.value)} maxLength={254} />
                  <div className="rounded-xl bg-recuo/60 px-4 py-3 text-sm">
                    <p className="text-xs text-sutil">Formato gerado</p>
                    <code className="num font-semibold">AnaLivia-CIEPS2026</code>
                  </div>
                </div>
                <div><Botao type="submit" carregando={acaoAtiva === "gerar"} disabled={bloqueioForm}><Plus className="size-4" aria-hidden="true" />Gerar rastreio</Botao></div>
              </form>
            </Secao>
          )}

          <Secao
            titulo={rotuloLista}
            descricao={listaVisivel ? `${formatarNumero(listaVisivel.pagination.total)} resultado(s) para os filtros aplicados.` : undefined}
          >
            <div className="flex flex-wrap items-end gap-3">
              <form onSubmit={applySearch} className="flex min-w-0 flex-1 basis-72 gap-2" role="search">
                <CampoBusca
                  rotulo="Buscar código"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={activeTab === "RASTREIO" ? "Código, nome ou e-mail" : "Buscar código"}
                  className="min-w-0 flex-1"
                />
                <Botao type="submit" estilo="contorno">Buscar</Botao>
              </form>
              <Escolha rotulo="Estado" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full sm:w-56">
                <option value="">Todos</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="RESERVADO">Reservado</option>
                <option value="USADO">Usado ou esgotado</option>
                <option value="CONSUMIDO">Histórico (consumido)</option>
              </Escolha>
            </div>

            {activeTab === "SAUDE" && <p className="text-xs text-sutil">Inativo = suspenso pelo repasse ou desativado à mão: a lista ainda não separa os dois. Esgotado = todos os usos do limite foram feitos.</p>}

            {!listaVisivel ? (
              carregando ? <Estado tipo="carregando" titulo="Carregando códigos…" linhas={3} />
              : <Estado tipo="erro" titulo="Não foi possível carregar os códigos" texto={erroLista ?? undefined} aoTentar={() => void loadCodes()} />
            ) : (
              <>
                {erroLista && (
                  <Aviso tom="erro" titulo="Não foi possível atualizar a lista">
                    <p>{erroLista} A lista abaixo é a última que carregou e pode estar desatualizada.</p>
                    <Botao className="mt-2" estilo="contorno" carregando={carregando} onClick={() => void loadCodes()}>Tentar de novo</Botao>
                  </Aviso>
                )}
                <Atualizando ativo={carregando} />

                {listaVisivel.items.length === 0 ? (
                  search || statusFilter ? (
                    <Estado tipo="semResultado" acao={<Botao estilo="contorno" onClick={limparFiltros}>Limpar busca e filtros</Botao>} />
                  ) : (
                    <Estado tipo="vazio" titulo="Nenhum código nesta aba ainda" texto={isActiveEdition ? "Use o formulário acima para gerar o primeiro." : "Esta edição não tem códigos desta aba."} />
                  )
                ) : (
                  <>
                    {isActiveEdition && (
                      <div className="grid gap-3 rounded-2xl bg-recuo/60 p-4">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <p role="status" aria-live="polite" className="text-sm">
                            <strong className={`num ${excedeLimite ? "text-alerta" : ""}`}>{formatarNumero(selectedIds.length)}</strong> selecionado(s) · a exclusão aceita até <strong className="num">{LIMITE_EXCLUSAO_LOTE}</strong> por vez
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Botao estilo="contorno" carregando={acaoAtiva === "selecionar"} disabled={ocupado && acaoAtiva !== "selecionar"} onClick={() => void selectAllDeletable()}>Selecionar todos os excluíveis</Botao>
                            <Botao estilo="contorno" disabled={ocupado || selectedIds.length === 0} onClick={() => setSelectedIds([])}>Limpar seleção</Botao>
                            <Botao
                              estilo="perigo"
                              carregando={acaoAtiva === "excluir-lote"}
                              disabled={(ocupado && acaoAtiva !== "excluir-lote") || selectedIds.length === 0 || excedeLimite}
                              aria-describedby={excedeLimite ? "aviso-limite-lote" : undefined}
                              onClick={() => void deleteSelectedCodes()}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />Excluir selecionados
                            </Botao>
                          </div>
                        </div>
                        {progressoSelecao && <p role="status" aria-live="polite" className="text-sm text-sutil">{progressoSelecao}</p>}
                        {excedeLimite && (
                          <div id="aviso-limite-lote">
                            <Aviso tom="alerta" titulo={`Mais de ${LIMITE_EXCLUSAO_LOTE} códigos selecionados`}>
                              <p>O servidor recusaria o lote inteiro. A exclusão está desabilitada até a seleção ter no máximo {LIMITE_EXCLUSAO_LOTE}.</p>
                              <Botao className="mt-2" estilo="contorno" disabled={ocupado} onClick={() => setSelectedIds((ids) => ids.slice(0, LIMITE_EXCLUSAO_LOTE))}>
                                Selecionar só os primeiros {LIMITE_EXCLUSAO_LOTE}
                              </Botao>
                            </Aviso>
                          </div>
                        )}
                      </div>
                    )}

                    {resultadoExclusao && (
                      <Aviso tom={ignorados.length ? "alerta" : "ok"} titulo={`${formatarNumero(resultadoExclusao.excluidos)} código(s) excluído(s)${ignorados.length ? `; ${formatarNumero(ignorados.length)} não puderam ser excluídos` : ""}`}>
                        {ignorados.length > 0 && (
                          <>
                            <p>
                              {selectedIds.length > 0 ? `${formatarNumero(selectedIds.length)} código(s) continuam selecionados porque a exclusão foi recusada para eles. ` : ""}
                              Veja o motivo de cada um antes de tentar de novo.
                            </p>
                            <Botao className="mt-2" estilo="contorno" onClick={() => setVerIgnorados(true)}>Ver todos os ignorados ({formatarNumero(ignorados.length)})</Botao>
                          </>
                        )}
                      </Aviso>
                    )}

                    <TabelaCodigos
                      key={`${listaVisivel.contexto}|${listaVisivel.pagination.page}`}
                      itens={listaVisivel.items}
                      aba={activeTab}
                      edicaoAtiva={isActiveEdition}
                      organizerPriceCents={resumo?.organizerPriceCents ?? null}
                      selecionados={selectedIds}
                      ocupado={ocupado}
                      acaoAtiva={acaoAtiva}
                      aoAlternarSelecao={toggleSelected}
                      aoAlternarPagina={togglePageSelection}
                      aoAlternarStatus={(item) => void toggleCode(item)}
                      aoExcluir={(item) => void deleteUnusedCode(item)}
                      aoSalvarLimite={saveHealthLimit}
                    />

                    {listaVisivel.pagination.totalPages > 1 && (
                      <nav aria-label="Paginação dos códigos" className="flex flex-wrap items-center justify-between gap-3">
                        <Botao estilo="contorno" disabled={page <= 1 || carregando} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Botao>
                        <span className="num text-sm text-sutil" aria-current="page">Página {listaVisivel.pagination.page} de {listaVisivel.pagination.totalPages}</span>
                        <Botao estilo="contorno" disabled={page >= listaVisivel.pagination.totalPages || carregando} onClick={() => setPage((p) => p + 1)}>Próxima</Botao>
                      </nav>
                    )}
                  </>
                )}
              </>
            )}
          </Secao>
        </div>
      </div>

      <Diagnostico ledger={resumo?.ledger ?? null} />
      <Manutencao
        bloqueado={acaoAtiva !== null}
        aoOcupar={setOcupadoPainel}
        aoApagar={async (edicao) => { if (editionId === edicao) await atualizar(); }}
      />

      <Dialogo
        aberto={verIgnorados}
        titulo={`Códigos que não foram excluídos (${formatarNumero(ignorados.length)})`}
        descricao="Cada código mostra o motivo da recusa e o que fazer."
        rotuloConfirmar="Copiar lista"
        rotuloCancelar="Fechar"
        onConfirmar={() => void copiar(textoIgnorados, "Lista copiada")}
        onCancelar={() => setVerIgnorados(false)}
      >
        <ul className="grid max-h-[50vh] gap-2 overflow-y-auto text-sm">
          {ignorados.map((item, i) => (
            <li key={`${item.id}-${i}`} className="rounded-xl bg-recuo/60 px-3 py-2">
              <p className="num font-semibold">{item.codigo ?? "Vários códigos"}</p>
              <p>{item.motivo}</p>
              <p className="text-sutil">O que fazer: {orientacaoParaMotivo(item.motivo)}</p>
            </li>
          ))}
        </ul>
      </Dialogo>
    </Pagina>
  );
}
