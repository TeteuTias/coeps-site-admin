"use client"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import {
    Botao,
    BotaoLink,
    Cabecalho,
    Campo,
    CampoBusca,
    Cartao,
    Escolha,
    Metrica,
    Pagina,
    Paginacao,
    Selo,
    TabelaRolavel,
    classeTd,
    classeTh,
    type TomSelo,
} from "../components/ui"
import { Atualizando, Estado } from "../components/Estado"
import QrCodeUserSearch from "../components/QrCodeUserSearch"
import {
    type AdminUserSummary,
    displayUserField,
    displayUserName,
    normalizeAdminUserList,
} from "../lib/users/admin-user-contract"
import { CONGRESSISTAS_MIN_QUERY_LENGTH, CONGRESSISTAS_PAGE_SIZE } from "../lib/users/congressistas-busca"
import { participationModeLabel } from "../lib/users/admin-remote-work"
import { formatarData, formatarNumero } from "../lib/formatar"

const PARAMS = ["q", "situacao", "modo", "pgto", "de", "ate", "pag"] as const

const SITUACOES: Record<number, { rotulo: string; tom: TomSelo }> = {
    0: { rotulo: "Não inscrito", tom: "erro" },
    1: { rotulo: "Inscrito", tom: "ok" },
    2: { rotulo: "Pagamento em aberto", tom: "alerta" },
    3: { rotulo: "Suspenso", tom: "alerta" },
}

function SeloSituacao({ situacao }: { situacao: AdminUserSummary["pagamento"]["situacao"] }) {
    const s = situacao === null ? null : SITUACOES[situacao]
    return <Selo tom={s?.tom ?? "neutro"}>{s?.rotulo ?? "Situação não informada"}</Selo>
}

// Só diz o que falta; o CPF em si nunca aparece na lista.
function camposFaltando(u: AdminUserSummary): string[] {
    const p = u.informacoes_usuario
    return [
        !p.nome && "nome",
        !p.email && "e-mail",
        !p.cpf && "CPF",
        !p.numero_telefone && "telefone",
    ].filter((c): c is string => Boolean(c))
}

function Pendencia({ user }: { user: AdminUserSummary }) {
    if (!user.cadastroPendente) return null
    const falta = camposFaltando(user)
    return <Selo tom="alerta">Cadastro incompleto{falta.length ? `: falta ${falta.join(", ")}` : ""}</Selo>
}

function resumoParticipacao(u: AdminUserSummary): string {
    const p = u.participacao
    const partes = [participationModeLabel(p.mode)]
    if (p.remoteWorkCount > 0) partes.push(`${formatarNumero(p.remoteWorkCount)} trabalho(s) remoto(s)`)
    if (p.proof) partes.push("comprovante enviado")
    return partes.join(" · ")
}

interface Resumo {
    total: number
    inscritos: number
    naoInscritos: number
    pagamentoAberto: number
    participantesRemotos: number
    paymentTypes: string[]
}

interface PaginaBusca {
    users: AdminUserSummary[]
    total: number
    page: number
    totalPages: number
}

const ehContagem = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

function lerResumo(valor: unknown): Resumo | null {
    if (typeof valor !== "object" || valor === null) return null
    const r = valor as Record<string, unknown>
    if (![r.total, r.inscritos, r.naoInscritos, r.pagamentoAberto, r.participantesRemotos].every(ehContagem)) return null
    if (!Array.isArray(r.paymentTypes) || !r.paymentTypes.every(t => typeof t === "string")) return null
    return r as unknown as Resumo
}

function lerPagina(valor: unknown): PaginaBusca | null {
    if (typeof valor !== "object" || valor === null) return null
    const r = valor as Record<string, unknown>
    const users = normalizeAdminUserList(r.data)
    if (!users || !ehContagem(r.total) || !ehContagem(r.page) || !ehContagem(r.totalPages)) return null
    return { users, total: r.total, page: r.page, totalPages: r.totalPages }
}

function mensagemDe(corpo: unknown, padrao: string): string {
    return typeof corpo === "object" && corpo !== null && "message" in corpo && typeof corpo.message === "string" ? corpo.message : padrao
}

function Lista() {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()

    const [resumo, setResumo] = useState<Resumo | null>(null)
    const [resultados, setResultados] = useState<PaginaBusca | null>(null)
    const [buscando, setBuscando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [tentativa, setTentativa] = useState(0)
    const topoRef = useRef<HTMLDivElement>(null)

    const q = params.get("q") ?? ""
    const situacao = params.get("situacao") ?? ""
    const modo = params.get("modo") ?? ""
    const pgto = params.get("pgto") ?? ""
    const de = params.get("de") ?? ""
    const ate = params.get("ate") ?? ""
    const pagParam = Number.parseInt(params.get("pag") ?? "1", 10)

    const mudarParams = useCallback((mudancas: Partial<Record<(typeof PARAMS)[number], string>>) => {
        const next = new URLSearchParams(window.location.search)
        for (const [chave, valor] of Object.entries(mudancas)) {
            if (valor) next.set(chave, valor)
            else next.delete(chave)
        }
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [pathname, router])

    // A digitação fica local e só vai para a URL depois de uma pausa; o que veio da URL (voltar do navegador) volta para o campo.
    const [busca, setBusca] = useState(q)
    const ultimoEnviado = useRef(q)
    useEffect(() => {
        if (q !== ultimoEnviado.current) {
            ultimoEnviado.current = q
            setBusca(q)
        }
    }, [q])
    useEffect(() => {
        if (busca === ultimoEnviado.current) return
        const t = setTimeout(() => {
            ultimoEnviado.current = busca
            mudarParams({ q: busca, pag: "" })
        }, 300)
        return () => clearTimeout(t)
    }, [busca, mudarParams])

    const termo = q.trim()
    const temFiltro = Boolean(q || situacao || modo || pgto || de || ate)
    const buscaAtiva = termo.length >= CONGRESSISTAS_MIN_QUERY_LENGTH || Boolean(situacao || modo || pgto || de || ate)
    const pagina = Number.isFinite(pagParam) && pagParam >= 1 ? pagParam : 1

    // Resumo (métricas e tipos de pagamento): não bloqueia a tela; se falhar, as métricas mostram "Indisponível".
    useEffect(() => {
        const controle = new AbortController()
        void (async () => {
            try {
                const response = await fetch("/api/get/congressistasResumo/", { cache: "no-store", signal: controle.signal })
                const lido = response.ok ? lerResumo(await response.json().catch(() => null)) : null
                if (lido && !controle.signal.aborted) setResumo(lido)
            } catch { /* sem resumo: a métrica fica "Indisponível" */ }
        })()
        return () => controle.abort()
    }, [tentativa])

    // A busca roda no servidor, 12 por página. O AbortController descarta a resposta de uma busca já substituída.
    useEffect(() => {
        if (!buscaAtiva) {
            setResultados(null)
            setBuscando(false)
            setErro(null)
            return
        }
        const controle = new AbortController()
        void (async () => {
            setBuscando(true)
            setErro(null)
            try {
                const qs = new URLSearchParams()
                if (termo) qs.set("q", termo)
                if (situacao) qs.set("status", situacao)
                if (pgto) qs.set("paymentType", pgto)
                if (modo) qs.set("mode", modo)
                if (de) qs.set("startDate", de)
                if (ate) qs.set("endDate", ate)
                qs.set("page", String(pagina))
                const response = await fetch(`/api/get/congressistasBusca/?${qs.toString()}`, { cache: "no-store", signal: controle.signal })
                const corpo: unknown = await response.json().catch(() => null)
                const lida = response.ok ? lerPagina(corpo) : null
                if (!lida) {
                    throw new Error(mensagemDe(corpo, response.ok
                        ? "A lista de congressistas recebida está em formato inválido."
                        : "Não foi possível buscar os congressistas."))
                }
                if (controle.signal.aborted) return
                setResultados(lida)
                setBuscando(false)
            } catch (cause) {
                if (controle.signal.aborted) return
                setResultados(null)
                setErro(cause instanceof Error ? cause.message : "Não foi possível buscar os congressistas.")
                setBuscando(false)
            }
        })()
        return () => controle.abort()
    }, [buscaAtiva, termo, situacao, pgto, modo, de, ate, pagina, tentativa])

    const tiposPagamento = Array.from(new Set([...(resumo?.paymentTypes ?? []), ...(pgto ? [pgto] : [])]))
        .sort((a, b) => a.localeCompare(b, "pt-BR"))

    const visiveis = resultados?.users ?? []
    const total = resultados?.total ?? 0
    const inicio = resultados ? (resultados.page - 1) * CONGRESSISTAS_PAGE_SIZE : 0

    const limpar = () => {
        ultimoEnviado.current = ""
        setBusca("")
        mudarParams(Object.fromEntries(PARAMS.map(p => [p, ""])))
    }
    const irParaPagina = (n: number) => {
        mudarParams({ pag: n > 1 ? String(n) : "" })
        topoRef.current?.scrollIntoView({ block: "start" })
    }

    const filtro = (chave: (typeof PARAMS)[number]) => (e: { target: { value: string } }) =>
        mudarParams({ [chave]: e.target.value, pag: "" })

    return (
        <Pagina largura="ampla">
            <Cabecalho
                etiqueta="Pessoas"
                titulo="Usuários"
                sub="Congressistas cadastrados, com situação de pagamento e participação."
                acoes={
                    <Botao estilo="contorno" carregando={buscando && resultados !== null} onClick={() => setTentativa(t => t + 1)}>
                        {!(buscando && resultados !== null) && <RefreshCw className="size-4" aria-hidden="true" />}
                        Atualizar lista
                    </Botao>
                }
            >
                <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <Metrica className="col-span-2 lg:col-span-1" rotulo="Total" valor={resumo ? formatarNumero(resumo.total) : null} />
                    <Metrica rotulo="Inscritos" valor={resumo ? formatarNumero(resumo.inscritos) : null} />
                    <Metrica rotulo="Não inscritos" valor={resumo ? formatarNumero(resumo.naoInscritos) : null} />
                    <Metrica rotulo="Pagamento em aberto" valor={resumo ? formatarNumero(resumo.pagamentoAberto) : null} />
                    <Metrica rotulo="Acesso remoto" valor={resumo ? formatarNumero(resumo.participantesRemotos) : null} />
                </section>
            </Cabecalho>

            <Cartao className="grid gap-4" aria-label="Busca e filtros">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <CampoBusca
                        rotulo="Buscar usuário"
                        rotuloOculto={false}
                        placeholder="Mínimo de 4 letras: nome, e-mail, telefone ou ID"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                    />
                    <QrCodeUserSearch titleText="Pesquisar por QR Code" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <Escolha rotulo="Situação" value={situacao} onChange={filtro("situacao")}>
                        <option value="">Todas</option>
                        <option value="1">Inscrito</option>
                        <option value="0">Não inscrito</option>
                        <option value="2">Pagamento em aberto</option>
                        <option value="3">Suspenso</option>
                    </Escolha>
                    <Escolha rotulo="Participação" value={modo} onChange={filtro("modo")}>
                        <option value="">Todas</option>
                        <option value="REGULAR">Regular</option>
                        <option value="REMOTE">Somente remoto</option>
                        <option value="BOTH">Regular + remoto</option>
                        <option value="NONE">Sem acesso</option>
                    </Escolha>
                    <Escolha rotulo="Tipo de pagamento" value={pgto} onChange={filtro("pgto")}>
                        <option value="">Todos</option>
                        {tiposPagamento.map(t => <option key={t} value={t}>{t}</option>)}
                    </Escolha>
                    <Campo rotulo="Cadastrado de" type="date" value={de} onChange={filtro("de")} />
                    <Campo rotulo="Cadastrado até" type="date" value={ate} onChange={filtro("ate")} />
                </div>
                {temFiltro && (
                    <div>
                        <Botao estilo="fantasma" tamanho="pequeno" onClick={limpar}>Limpar busca e filtros</Botao>
                    </div>
                )}
            </Cartao>

            <div ref={topoRef} className="grid scroll-mt-4 gap-3">
                {!buscaAtiva && (
                    <Estado tipo="vazio" titulo="Digite pelo menos 4 letras para buscar um congressista" texto="Pesquise por nome, e-mail, ID ou telefone, ou use algum dos filtros acima." />
                )}
                {buscaAtiva && buscando && !resultados && !erro && <Estado tipo="carregando" titulo="Buscando congressistas…" linhas={5} />}
                {buscaAtiva && erro && <Estado tipo="erro" titulo="Não foi possível buscar os congressistas" texto={erro} aoTentar={() => setTentativa(t => t + 1)} />}
                {buscaAtiva && resultados && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="num text-sm text-sutil" aria-live="polite">
                                {total === 0
                                    ? "Nenhum usuário"
                                    : `${formatarNumero(inicio + 1)}–${formatarNumero(inicio + visiveis.length)} de ${formatarNumero(total)}`}
                            </p>
                            <Atualizando ativo={buscando} />
                        </div>

                        {total === 0 && !buscando && (
                            <Estado tipo="semResultado" acao={<Botao estilo="contorno" onClick={limpar}>Limpar busca e filtros</Botao>} />
                        )}

                        {visiveis.length > 0 && (
                            <>
                                <div className="hidden md:block">
                                    <TabelaRolavel rotulo="Lista de usuários" className="[&_table]:min-w-[60rem]">
                                        <thead>
                                            <tr>
                                                <th scope="col" className={classeTh}>Nome</th>
                                                <th scope="col" className={classeTh}>E-mail</th>
                                                <th scope="col" className={classeTh}>Situação</th>
                                                <th scope="col" className={classeTh}>Participação</th>
                                                <th scope="col" className={classeTh}>Cadastro em</th>
                                                <th scope="col" className={classeTh}><span className="sr-only">Ação</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visiveis.map(u => (
                                                <tr key={u._id}>
                                                    <td className={`${classeTd} max-w-64`}>
                                                        <p className="truncate font-medium" title={displayUserName(u)}>
                                                            <Link href={`/usuarios/informacoes/${u._id}`} prefetch={false} className="hover:underline">{displayUserName(u)}</Link>
                                                        </p>
                                                        {u.informacoes_usuario.profissao && <p className="truncate text-xs text-sutil">{u.informacoes_usuario.profissao}</p>}
                                                        {u.informacoes_usuario.matricula_municipio && <p className="truncate text-xs text-sutil">Matrícula do município: {u.informacoes_usuario.matricula_municipio}</p>}
                                                        {u.informacoes_usuario.unidade_origem && <p className="truncate text-xs text-sutil">Unidade de Origem: {u.informacoes_usuario.unidade_origem}</p>}
                                                        <div className="mt-1"><Pendencia user={u} /></div>
                                                    </td>
                                                    <td className={`${classeTd} max-w-64`}>
                                                        <p className="truncate" title={displayUserField(u.informacoes_usuario.email)}>{displayUserField(u.informacoes_usuario.email)}</p>
                                                        <p className="num text-xs text-sutil">{displayUserField(u.informacoes_usuario.numero_telefone)}</p>
                                                    </td>
                                                    <td className={classeTd}>
                                                        <SeloSituacao situacao={u.pagamento.situacao} />
                                                        <p className="mt-1 text-xs text-sutil">{u.pagamento.tipo_pagamento ?? "Tipo não informado"}</p>
                                                    </td>
                                                    <td className={`${classeTd} text-sm`}>{resumoParticipacao(u)}</td>
                                                    <td className={`${classeTd} num whitespace-nowrap text-sm`}>{formatarData(u.informacoes_usuario.data_criacao)}</td>
                                                    <td className={`${classeTd} text-right`}>
                                                        <BotaoLink href={`/usuarios/informacoes/${u._id}`} estilo="contorno" aria-label={`Abrir ficha de ${displayUserName(u)}`}>Abrir ficha</BotaoLink>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </TabelaRolavel>
                                </div>

                                <ul className="grid gap-3 md:hidden" aria-label="Lista de usuários">
                                    {visiveis.map(u => (
                                        <li key={u._id} className="grid gap-2 rounded-2xl bg-cartao p-4 ring-1 ring-linha/60">
                                            <div className="min-w-0">
                                                <p className="break-words font-semibold">
                                                    <Link href={`/usuarios/informacoes/${u._id}`} prefetch={false} className="-my-2 inline-block py-2 hover:underline">{displayUserName(u)}</Link>
                                                </p>
                                                <p className="break-all text-sm text-sutil">{displayUserField(u.informacoes_usuario.email)}</p>
                                                {u.informacoes_usuario.profissao && <p className="text-xs text-sutil">{u.informacoes_usuario.profissao}</p>}
                                                {u.informacoes_usuario.matricula_municipio && <p className="text-xs text-sutil">Matrícula do município: {u.informacoes_usuario.matricula_municipio}</p>}
                                                {u.informacoes_usuario.unidade_origem && <p className="text-xs text-sutil">Unidade de Origem: {u.informacoes_usuario.unidade_origem}</p>}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <SeloSituacao situacao={u.pagamento.situacao} />
                                                <Pendencia user={u} />
                                            </div>
                                            <BotaoLink href={`/usuarios/informacoes/${u._id}`} estilo="contorno" aria-label={`Abrir ficha de ${displayUserName(u)}`}>Abrir ficha</BotaoLink>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        <Paginacao pagina={resultados.page} total={total} porPagina={CONGRESSISTAS_PAGE_SIZE} aoMudar={irParaPagina} rotulo="usuários" />
                    </>
                )}
            </div>
        </Pagina>
    )
}

export default function Page() {
    return (
        <Suspense fallback={<Pagina largura="ampla"><Estado tipo="carregando" titulo="Carregando usuários…" linhas={5} /></Pagina>}>
            <Lista />
        </Suspense>
    )
}
