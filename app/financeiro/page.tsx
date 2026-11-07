"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RefreshCw, Tag } from "lucide-react"
import { BotaoLink, Botao, Cabecalho, Metrica, Pagina, Secao, Aviso } from "@/app/components/ui"
import { Abas, idAba, idPainel } from "@/app/components/Abas"
import { Estado } from "@/app/components/Estado"
import { formatarNumero } from "@/app/lib/formatar"
import type { IAutomaticLotOccupancy, IPaymentConfig } from "@/app/lib/types/payments/payment.t"
import { parseAdminPaymentConfigHttpResponse } from "@/app/lib/payments/payment-config-contract"
import { type AdminUserSummary, parseAdminUserListHttpResponse } from "@/app/lib/users/admin-user-contract"
import { VisaoGeral } from "./_componentes/VisaoGeral"
import { Inscritos } from "./_componentes/Inscritos"
import { LotesAutomaticos } from "./_componentes/LotesAutomaticos"
import { PrecoOrganizador, TiposAceitos } from "./_componentes/AjustesGerais"
import { CamposLegados, ParcelamentosLegados } from "./_componentes/ConfigLegada"
import { Manutencao } from "./_componentes/Manutencao"
import { mensagemDe } from "./_componentes/util"

const ABAS = [
  { id: "visao-geral", rotulo: "Visão geral" },
  { id: "inscritos", rotulo: "Inscritos" },
  { id: "configuracao", rotulo: "Configuração" },
  { id: "manutencao", rotulo: "Manutenção", perigo: true },
]

export default function Page() {
  // useSearchParams pede Suspense: a aba ativa mora na URL (?aba=) para voltar e recarregar sem perder o lugar
  return (
    <Suspense fallback={<Pagina><Estado tipo="carregando" titulo="Carregando financeiro…" linhas={4} /></Pagina>}>
      <Financeiro />
    </Suspense>
  )
}

function Financeiro() {
  const router = useRouter()
  const parametros = useSearchParams()
  const pedida = parametros.get("aba")
  const aba = ABAS.some((a) => a.id === pedida) ? (pedida as string) : "visao-geral"
  const trocarAba = (id: string) => router.replace(id === "visao-geral" ? "/financeiro" : `/financeiro?aba=${id}`, { scroll: false })

  const [config, setConfig] = useState<IPaymentConfig | null>(null)
  const [configCarregando, setConfigCarregando] = useState(true)
  const [configErro, setConfigErro] = useState<string | null>(null)
  // null = nunca lida com sucesso: a tela mostra "Indisponível", nunca zero.
  const [inscritos, setInscritos] = useState<AdminUserSummary[] | null>(null)
  const [inscritosCarregando, setInscritosCarregando] = useState(false)
  const [inscritosErro, setInscritosErro] = useState<string | null>(null)
  const [ocupacao, setOcupacao] = useState<IAutomaticLotOccupancy | null>(null)
  const [ocupacaoCarregando, setOcupacaoCarregando] = useState(false)
  const [ocupacaoErro, setOcupacaoErro] = useState<string | null>(null)
  // 403: a conta não é administradora financeira. Tentar de novo não resolve, então a tela explica em vez de oferecer nova tentativa.
  const [ocupacaoSemPermissao, setOcupacaoSemPermissao] = useState(false)

  const carregarOcupacao = useCallback(async (configId: string) => {
    setOcupacaoCarregando(true)
    setOcupacaoErro(null)
    setOcupacaoSemPermissao(false)
    try {
      const response = await fetch(`/api/get/pagamentos/ocupacaoLotes?configId=${encodeURIComponent(configId)}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as Partial<IAutomaticLotOccupancy> & { message?: string }
      if (response.status === 403) setOcupacaoSemPermissao(true)
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível atualizar a ocupação dos lotes.")
      if (payload.configId !== configId || !Array.isArray(payload.lotes)) {
        throw new Error("A ocupação recebida não corresponde à configuração carregada.")
      }
      setOcupacao(payload as IAutomaticLotOccupancy)
    } catch (error) {
      setOcupacaoErro(error instanceof Error ? error.message : "Não foi possível atualizar a ocupação dos lotes.")
    } finally {
      setOcupacaoCarregando(false)
    }
  }, [])

  const carregarConfig = useCallback(async () => {
    setConfigCarregando(true)
    setConfigErro(null)
    try {
      const response = await fetch("/api/get/pagamentos/configuracaoPagamento", { cache: "no-store" })
      const payload: unknown = await response.json().catch(() => null)
      const dados = parseAdminPaymentConfigHttpResponse(response.ok, payload)
      if (!dados) {
        throw new Error(mensagemDe(payload, response.ok
          ? "A configuração financeira recebida está em formato inválido."
          : "Não foi possível carregar a configuração financeira."))
      }
      setConfig(dados)
      if (dados.modo === "automatico") void carregarOcupacao(dados._id)
    } catch (error) {
      setConfigErro(error instanceof Error ? error.message : "Não foi possível carregar a configuração financeira.")
    } finally {
      setConfigCarregando(false)
    }
  }, [carregarOcupacao])

  const carregarInscritos = useCallback(async () => {
    setInscritosCarregando(true)
    setInscritosErro(null)
    try {
      const response = await fetch("/api/get/pagamentos/listaInscritos/", { cache: "no-store" })
      const payload: unknown = await response.json().catch(() => null)
      const lista = parseAdminUserListHttpResponse(response.ok, payload)
      if (!lista) {
        throw new Error(mensagemDe(payload, response.ok
          ? "A lista de inscritos recebida está em formato inválido."
          : "Não foi possível carregar a lista de inscritos."))
      }
      setInscritos(lista)
    } catch (error) {
      setInscritosErro(error instanceof Error ? error.message : "Não foi possível carregar a lista de inscritos.")
    } finally {
      setInscritosCarregando(false)
    }
  }, [])

  const recarregarTudo = useCallback(() => Promise.all([carregarConfig(), carregarInscritos()]).then(() => undefined), [carregarConfig, carregarInscritos])

  useEffect(() => { void recarregarTudo() }, [recarregarTudo])

  const aoSalvarTipos = () => Promise.all([carregarConfig(), carregarInscritos()]).then(() => undefined)
  const atualizando = configCarregando || inscritosCarregando

  const acoes = (
    <>
      <Botao estilo="contorno" carregando={atualizando && config !== null} onClick={() => void recarregarTudo()}>
        <RefreshCw className="size-4" aria-hidden="true" />Atualizar tudo
      </Botao>
      <BotaoLink href="/financeiro/codigos" estilo="contorno"><Tag className="size-4" aria-hidden="true" />Códigos de desconto e rastreio</BotaoLink>
    </>
  )

  if (!config) {
    return (
      <Pagina largura="ampla">
        <Cabecalho etiqueta="CIEPS" titulo="Financeiro" sub="Valores, formas de pagamento, lotes e inscritos da edição em uso." />
        {configCarregando
          ? <Estado tipo="carregando" titulo="Carregando configurações financeiras…" />
          : <Estado tipo="erro" titulo="Não foi possível carregar o financeiro" texto={configErro ?? "Atualize a página ou tente novamente em alguns instantes."} aoTentar={() => void recarregarTudo()} />}
      </Pagina>
    )
  }

  const automatico = config.modo === "automatico"
  const lotesAuto = config.configuracaoLotesAutomaticos?.lotes
  const saldo = ocupacao ? Math.max(0, ocupacao.capacidadeTotal - ocupacao.ocupadasEfetivas) : null

  return (
    <Pagina largura="ampla">
      <Cabecalho
        etiqueta="CIEPS"
        titulo="Financeiro"
        sub={<>Edição em uso: <strong className="text-white">{config.edicaoId ?? "não configurada"}</strong>. Valores, lotes, formas de pagamento e inscritos.</>}
        acoes={acoes}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica rotulo="Pessoas inscritas" valor={inscritos === null ? null : formatarNumero(inscritos.length)} detalhe="Inscrição confirmada, não transações" />
          <Metrica rotulo="Saldo de vagas" valor={automatico && saldo !== null ? formatarNumero(saldo) : null} detalhe={ocupacao ? `Capacidade total: ${formatarNumero(ocupacao.capacidadeTotal)}` : automatico ? "Ocupação indisponível" : "Só no modo automático"} />
          <Metrica
            rotulo={automatico ? "Lotes automáticos" : "Parcelamentos legados"}
            valor={automatico ? (Array.isArray(lotesAuto) ? formatarNumero(lotesAuto.length) : null) : formatarNumero(config.parcelamentos?.length ?? 0)}
          />
          <Metrica rotulo="Formas de pagamento" valor={formatarNumero(config.pagamentosAceitos?.length ?? 0)} detalhe="Aceitas no checkout" />
        </div>
      </Cabecalho>

      <Abas rotulo="Seções do financeiro" abas={ABAS} ativa={aba} aoMudar={trocarAba} />

      {configErro && (
        <Aviso tom="alerta" titulo="Não foi possível atualizar a configuração">
          {configErro} Os últimos dados válidos continuam na tela.
        </Aviso>
      )}
      {!config.edicaoId && (
        <Aviso tom="alerta" titulo="Esta configuração não tem identificador de edição">
          Os contadores e a ocupação usam um identificador de reserva. Defina a edição em &quot;Compatibilidade legada&quot;, na seção Configuração.
        </Aviso>
      )}

      {/* Todos os painéis ficam montados e só o ativo aparece: filtros e campos em edição não se perdem ao trocar de aba.
          A lista de inscritos é paginada, então manter montado não pesa. */}
      <div role="tabpanel" id={idPainel("visao-geral")} aria-labelledby={idAba("visao-geral")} hidden={aba !== "visao-geral"} className="grid gap-6">
        <VisaoGeral
          config={config}
          ocupacao={ocupacao}
          ocupacaoCarregando={ocupacaoCarregando}
          ocupacaoErro={ocupacaoErro}
          ocupacaoSemPermissao={ocupacaoSemPermissao}
          aoAtualizarOcupacao={() => void carregarOcupacao(config._id)}
        />
      </div>

      <div role="tabpanel" id={idPainel("inscritos")} aria-labelledby={idAba("inscritos")} hidden={aba !== "inscritos"} className="grid gap-6">
        <Inscritos
          inscritos={inscritos}
          carregando={inscritosCarregando}
          erro={inscritosErro}
          aoTentar={() => void carregarInscritos()}
          aoRemovido={(id) => {
            setInscritos((atual) => atual?.filter((u) => u._id !== id) ?? atual)
            if (config.modo === "automatico") void carregarOcupacao(config._id)
          }}
        />
      </div>

      <div role="tabpanel" id={idPainel("configuracao")} aria-labelledby={idAba("configuracao")} hidden={aba !== "configuracao"} className="grid gap-6">
        <Secao
          titulo="Configuração"
          descricao="Preços, lotes, parcelamentos e formas de pagamento. As alterações valem para novas compras; pagamentos já criados não mudam."
        >
          <PrecoOrganizador key={config.configuracaoOrganizador?.valorFinalCentavos ?? 0} config={config} aoSalvar={carregarConfig} />
          {config.modo === "automatico" && (
            <LotesAutomaticos config={config} ocupacao={ocupacao} ocupacaoCarregando={ocupacaoCarregando} aoSalvar={carregarConfig} />
          )}
          <TiposAceitos key={(config.pagamentosAceitos ?? []).join()} config={config} aoSalvar={aoSalvarTipos} />
          <CamposLegados config={config} aoSalvar={carregarConfig} />
          <ParcelamentosLegados config={config} aoSalvar={carregarConfig} />
        </Secao>
      </div>

      <div role="tabpanel" id={idPainel("manutencao")} aria-labelledby={idAba("manutencao")} hidden={aba !== "manutencao"} className="grid gap-6">
        <Manutencao
          aoRemoverTodas={() => {
            void carregarInscritos()
            if (config.modo === "automatico") void carregarOcupacao(config._id)
          }}
        />
      </div>
    </Pagina>
  )
}
