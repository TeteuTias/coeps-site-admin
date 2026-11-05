"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Tag } from "lucide-react"
import { BotaoLink, Botao, Cabecalho, Pagina, Secao, Aviso, classeBotao } from "@/app/components/ui"
import { Estado } from "@/app/components/Estado"
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

const SECOES = [
  ["visao-geral", "Visão geral e ocupação"],
  ["inscritos", "Inscritos"],
  ["configuracao", "Configuração"],
  ["manutencao", "Manutenção"],
] as const

export default function Page() {
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

  const carregarOcupacao = useCallback(async (configId: string) => {
    setOcupacaoCarregando(true)
    setOcupacaoErro(null)
    try {
      const response = await fetch(`/api/get/pagamentos/ocupacaoLotes?configId=${encodeURIComponent(configId)}`, { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as Partial<IAutomaticLotOccupancy> & { message?: string }
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

  return (
    <Pagina largura="ampla">
      <Cabecalho
        etiqueta="CIEPS"
        titulo="Financeiro"
        sub={
          <>
            Edição em uso: <strong className="text-tinta">{config.edicaoId ?? "não configurada"}</strong>. A tela usa a configuração marcada como ativa no servidor
            (que pode fixar a edição por variável de ambiente; a resposta da API não informa qual regra valeu).
          </>
        }
        acoes={acoes}
      />

      <nav aria-label="Seções do financeiro">
        <ul className="flex flex-wrap gap-2">
          {SECOES.map(([id, rotulo]) => (
            <li key={id}><a href={`#${id}`} className={classeBotao(id === "manutencao" ? "perigo" : "contorno", "", "pequeno")}>{rotulo}</a></li>
          ))}
        </ul>
      </nav>

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

      <VisaoGeral
        config={config}
        totalInscritos={inscritos?.length ?? null}
        ocupacao={ocupacao}
        ocupacaoCarregando={ocupacaoCarregando}
        ocupacaoErro={ocupacaoErro}
        aoAtualizarOcupacao={() => void carregarOcupacao(config._id)}
      />

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

      <Secao
        id="configuracao"
        className="scroll-mt-4"
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

      <Manutencao
        aoRemoverTodas={() => {
          void carregarInscritos()
          if (config.modo === "automatico") void carregarOcupacao(config._id)
        }}
      />
    </Pagina>
  )
}
