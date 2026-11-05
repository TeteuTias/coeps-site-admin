"use client"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
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
    Selo,
    TabelaRolavel,
    classeTd,
    classeTh,
    type TomSelo,
} from "../components/ui"
import { Atualizando, Estado } from "../components/Estado"
import { useAvisos } from "../components/Avisos"
import QrCodeUserSearch from "../components/QrCodeUserSearch"
import {
    type AdminUserSummary,
    displayUserField,
    displayUserName,
    filterAdminUsers,
    parseAdminUserListHttpResponse,
} from "../lib/users/admin-user-contract"
import { participationModeLabel } from "../lib/users/admin-remote-work"
import { formatarData, formatarNumero } from "../lib/formatar"

const POR_PAGINA = 50
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

function Lista() {
    const router = useRouter()
    const pathname = usePathname()
    const params = useSearchParams()
    const { avisar } = useAvisos()

    const [usuarios, setUsuarios] = useState<AdminUserSummary[] | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [atualizando, setAtualizando] = useState(false)
    const topoRef = useRef<HTMLDivElement>(null)
    const temLista = useRef(false)

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

    const carregar = useCallback(async () => {
        setAtualizando(true)
        try {
            const response = await fetch(`/api/get/todosCongressistas/`, { cache: "no-store" })
            const payload: unknown = await response.json().catch(() => null)
            const lista = parseAdminUserListHttpResponse(response.ok, payload)
            if (!lista) {
                const mensagem = typeof payload === "object" && payload !== null &&
                    "message" in payload && typeof payload.message === "string"
                    ? payload.message
                    : response.ok
                        ? "A lista de congressistas recebida está em formato inválido."
                        : "Não foi possível carregar os congressistas."
                throw new Error(mensagem)
            }
            temLista.current = true
            setUsuarios(lista)
            setErro(null)
        } catch (cause) {
            const mensagem = cause instanceof Error ? cause.message : "Não foi possível carregar os congressistas."
            // Já havia lista: mantém a última válida e só avisa.
            if (temLista.current) avisar("erro", "Não foi possível atualizar a lista", `${mensagem} Os dados abaixo podem estar desatualizados.`)
            else setErro(mensagem)
        } finally {
            setAtualizando(false)
        }
    }, [avisar])

    useEffect(() => { void carregar() }, [carregar])

    const tiposPagamento = useMemo(() => {
        const tipos = new Set((usuarios ?? []).map(u => u.pagamento.tipo_pagamento).filter((t): t is string => Boolean(t)))
        if (pgto) tipos.add(pgto)
        return Array.from(tipos).sort((a, b) => a.localeCompare(b, "pt-BR"))
    }, [usuarios, pgto])

    const filtrados = useMemo(() => filterAdminUsers(usuarios ?? [], {
        searchTerm: q,
        selectedStatus: situacao,
        selectedPaymentType: pgto,
        selectedParticipationMode: modo,
        startDate: de,
        endDate: ate,
    }), [usuarios, q, situacao, pgto, modo, de, ate])

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
    const pagina = Math.min(Math.max(Number.isFinite(pagParam) ? pagParam : 1, 1), totalPaginas)
    const inicio = (pagina - 1) * POR_PAGINA
    const visiveis = filtrados.slice(inicio, inicio + POR_PAGINA)

    const temFiltro = Boolean(q || situacao || modo || pgto || de || ate)
    const limpar = () => {
        ultimoEnviado.current = ""
        setBusca("")
        mudarParams(Object.fromEntries(PARAMS.map(p => [p, ""])))
    }
    const irParaPagina = (n: number) => {
        mudarParams({ pag: n > 1 ? String(n) : "" })
        topoRef.current?.scrollIntoView({ block: "start" })
    }

    const contar = (fn: (u: AdminUserSummary) => boolean) => (usuarios ? usuarios.filter(fn).length : null)
    const filtro = (chave: (typeof PARAMS)[number]) => (e: { target: { value: string } }) =>
        mudarParams({ [chave]: e.target.value, pag: "" })

    return (
        <Pagina largura="ampla">
            <Cabecalho
                etiqueta="Pessoas"
                titulo="Usuários"
                sub="Congressistas cadastrados, com situação de pagamento e participação."
                acoes={
                    <Botao estilo="contorno" carregando={atualizando && usuarios !== null} onClick={() => void carregar()}>
                        {!(atualizando && usuarios !== null) && <RefreshCw className="size-4" aria-hidden="true" />}
                        Atualizar lista
                    </Botao>
                }
            />

            <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Metrica rotulo="Total" valor={usuarios ? formatarNumero(usuarios.length) : null} />
                <Metrica rotulo="Inscritos" valor={formatarNullable(contar(u => u.pagamento.situacao === 1))} />
                <Metrica rotulo="Não inscritos" valor={formatarNullable(contar(u => u.pagamento.situacao === 0))} />
                <Metrica rotulo="Pagamento em aberto" valor={formatarNullable(contar(u => u.pagamento.situacao === 2))} />
                <Metrica rotulo="Acesso remoto" valor={formatarNullable(contar(u => ["REMOTE", "BOTH"].includes(u.participacao.mode)))} />
            </section>

            <Cartao className="grid gap-4" aria-label="Busca e filtros">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <CampoBusca
                        rotulo="Buscar usuário"
                        rotuloOculto={false}
                        placeholder="Nome, e-mail, telefone ou ID"
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
                {usuarios === null && !erro && <Estado tipo="carregando" titulo="Carregando congressistas…" linhas={5} />}
                {usuarios === null && erro && <Estado tipo="erro" titulo="Não foi possível carregar os congressistas" texto={erro} aoTentar={() => void carregar()} />}
                {usuarios !== null && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="num text-sm text-sutil" aria-live="polite">
                                {filtrados.length === 0
                                    ? "Nenhum usuário"
                                    : `${formatarNumero(inicio + 1)}–${formatarNumero(inicio + visiveis.length)} de ${formatarNumero(filtrados.length)}`}
                                {temFiltro && usuarios.length !== filtrados.length ? ` (filtrado de ${formatarNumero(usuarios.length)})` : ""}
                            </p>
                            <Atualizando ativo={atualizando} />
                        </div>

                        {usuarios.length === 0 && <Estado tipo="vazio" titulo="Nenhum congressista cadastrado" texto="Ainda não há usuários cadastrados no sistema." />}
                        {usuarios.length > 0 && filtrados.length === 0 && (
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
                                                        <p className="truncate font-medium" title={displayUserName(u)}>{displayUserName(u)}</p>
                                                        {u.informacoes_usuario.profissao && <p className="truncate text-xs text-sutil">{u.informacoes_usuario.profissao}</p>}
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
                                                <p className="break-words font-semibold">{displayUserName(u)}</p>
                                                <p className="break-all text-sm text-sutil">{displayUserField(u.informacoes_usuario.email)}</p>
                                                {u.informacoes_usuario.profissao && <p className="text-xs text-sutil">{u.informacoes_usuario.profissao}</p>}
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

                        {totalPaginas > 1 && (
                            <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
                                <Botao estilo="contorno" disabled={pagina <= 1} onClick={() => irParaPagina(pagina - 1)}>
                                    <ChevronLeft className="size-4" aria-hidden="true" />Anterior
                                </Botao>
                                <span className="num text-sm text-sutil" aria-current="page">Página {pagina} de {totalPaginas}</span>
                                <Botao estilo="contorno" disabled={pagina >= totalPaginas} onClick={() => irParaPagina(pagina + 1)}>
                                    Próxima<ChevronRight className="size-4" aria-hidden="true" />
                                </Botao>
                            </nav>
                        )}
                    </>
                )}
            </div>
        </Pagina>
    )
}

// Contagem que ainda não carregou fica null para a Métrica mostrar "Indisponível", nunca 0.
function formatarNullable(n: number | null): string | null {
    return n === null ? null : formatarNumero(n)
}

export default function Page() {
    return (
        <Suspense fallback={<Pagina largura="ampla"><Estado tipo="carregando" titulo="Carregando usuários…" linhas={5} /></Pagina>}>
            <Lista />
        </Suspense>
    )
}
