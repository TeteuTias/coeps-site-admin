"use client"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Download, FilterX, History, Loader2, RefreshCw, Search, UserX } from "lucide-react"
import "./style.css"

type Log = {
    _id: string
    em: string
    origem: string
    acao: string
    categoria: string
    resumo: string
    sucesso: boolean
    status: number | null
    ator?: { tipo?: string; id?: string | null; conta?: string | null; email?: string | null; nome?: string | null }
    alvo?: { usuarioId?: string | null; usuarioNome?: string | null; minicursoId?: string | null; minicursoNome?: string | null; cobrancaId?: string | null }
    antes?: unknown
    depois?: unknown
    detalhes?: unknown
    requisicao?: { metodo?: string; rota?: string; ip?: string | null; userAgent?: string | null; corpo?: unknown; duracaoMs?: number }
}

type Pagina = { data: Log[]; total: number; pagina: number; totalPaginas: number }
type Opcoes = { acoes: string[]; contas: { id: string; nome: string }[]; minicursos: { id: string; nome: string }[] }

type LinhaSemVaga = {
    usuarioId: string; nome: string; email: string; minicurso: string; etapaFaltando: string | null; valor: number | null
    pagoEm: string | null; causa: string; sumiuEm: string | null; detalheCausa: string; vagasLivres: number | null; minicursoJaComecou: boolean | null
}

const CATEGORIAS: [string, string][] = [
    ["inscricao", "Inscrições"], ["pagamento", "Pagamentos e webhooks"], ["minicurso", "Atividades"], ["presenca", "Presença"],
    ["usuario", "Congressistas"], ["financeiro", "Financeiro"], ["trabalhos", "Trabalhos"], ["acesso", "Entradas e acessos"],
    ["logs", "Logs"], ["outro", "Outros"],
]
const ORIGENS: [string, string][] = [["admin", "Admin"], ["site", "Site"], ["webhook", "Asaas (webhook)"], ["sistema", "Automático"]]
const CAUSAS: Record<string, string> = {
    lista_apagada_ao_editar_minicurso: "Lista apagada ao editar a atividade",
    cancelado_sem_estorno_pelo_admin: "Cancelado sem estorno pelo Admin",
    cobranca_excluida_ou_estornada: "Cobrança excluída/estornada",
    desconhecida: "Sem rastro",
}

const VAZIO = { de: "", ate: "", categoria: "", acao: "", origem: "", conta: "", afetado: "", minicurso: "", sucesso: "", q: "" }

const dataHora = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"

const quem = (l: Log) => {
    const a = l.ator
    if (!a) return "—"
    if (a.tipo === "asaas") return "Asaas"
    if (a.tipo === "sistema") return "Automático"
    if (a.tipo === "congressista") return a.nome || a.email || a.id || "Congressista"
    return [a.conta ? `Conta ${a.conta}` : null, a.email].filter(Boolean).join(" · ") || a.id || "Admin"
}

function Json({ valor }: { valor: unknown }) {
    if (valor === undefined) return <span className="logs-vazio">—</span>
    return <pre className="logs-json">{JSON.stringify(valor, null, 2)}</pre>
}

/** Campos que mudaram entre antes e depois (só primeiro nível). */
function Diferencas({ antes, depois }: { antes: unknown; depois: unknown }) {
    if (!antes || !depois || typeof antes !== "object" || typeof depois !== "object") return null
    const a = antes as Record<string, unknown>
    const d = depois as Record<string, unknown>
    const campos = Array.from(new Set([...Object.keys(a), ...Object.keys(d)])).filter((c) => JSON.stringify(a[c]) !== JSON.stringify(d[c]))
    if (campos.length === 0) return <p className="logs-nota">Nenhum campo mudou.</p>
    return (
        <table className="logs-diff">
            <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
            <tbody>
                {campos.map((c) => (
                    <tr key={c}><td>{c}</td><td><code>{JSON.stringify(a[c]) ?? "—"}</code></td><td><code>{JSON.stringify(d[c]) ?? "—"}</code></td></tr>
                ))}
            </tbody>
        </table>
    )
}

export default function Page() {
    const [filtros, setFiltros] = useState(VAZIO)
    const [aplicados, setAplicados] = useState(VAZIO)
    const [pagina, setPagina] = useState(1)
    const [dados, setDados] = useState<Pagina | null>(null)
    const [opcoes, setOpcoes] = useState<Opcoes | null>(null)
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [aberto, setAberto] = useState<string | null>(null)
    const [exportando, setExportando] = useState(false)
    const [aba, setAba] = useState<"logs" | "semvaga">("logs")
    const [semVaga, setSemVaga] = useState<{ linhas: LinhaSemVaga[]; geradoEm: string } | null>(null)
    const [semVagaErro, setSemVagaErro] = useState<string | null>(null)
    const [semVagaCarregando, setSemVagaCarregando] = useState(false)

    const params = useMemo(() => {
        const p = new URLSearchParams()
        for (const [k, v] of Object.entries(aplicados)) if (v) p.set(k, v)
        return p
    }, [aplicados])

    useEffect(() => {
        fetch("/api/get/logs/?opcoes=1", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => j && setOpcoes(j))
            .catch(() => null)
    }, [])

    const carregar = useCallback(async () => {
        setCarregando(true)
        setErro(null)
        try {
            const p = new URLSearchParams(params)
            p.set("pagina", String(pagina))
            const r = await fetch(`/api/get/logs/?${p.toString()}`, { cache: "no-store" })
            const j = await r.json().catch(() => null)
            if (!r.ok) throw new Error(j?.message || "Não foi possível carregar os logs.")
            setDados(j)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível carregar os logs.")
        } finally {
            setCarregando(false)
        }
    }, [params, pagina])

    useEffect(() => { void carregar() }, [carregar])

    const aplicar = (e?: React.FormEvent) => {
        e?.preventDefault()
        setPagina(1)
        setAplicados({ ...filtros })
    }
    const limpar = () => { setFiltros(VAZIO); setAplicados(VAZIO); setPagina(1) }
    const set = (campo: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))

    const exportar = async () => {
        setExportando(true)
        try {
            const p = new URLSearchParams(params)
            p.set("formato", "csv")
            const r = await fetch(`/api/get/logs/?${p.toString()}`, { cache: "no-store" })
            const j = await r.json().catch(() => null)
            if (!r.ok || typeof j?.csv !== "string") throw new Error(j?.message || "Falha ao exportar.")
            const url = URL.createObjectURL(new Blob([j.csv], { type: "text/csv;charset=utf-8" }))
            const a = document.createElement("a")
            a.href = url
            a.download = j.arquivo
            a.click()
            URL.revokeObjectURL(url)
            if (j.limitado) setErro(`A exportação parou em ${j.linhas} linhas. Use um intervalo de datas menor para o restante.`)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Falha ao exportar.")
        } finally {
            setExportando(false)
        }
    }

    const carregarSemVaga = async () => {
        setSemVagaCarregando(true)
        setSemVagaErro(null)
        try {
            const r = await fetch("/api/get/logs/pagos-sem-vaga/", { cache: "no-store" })
            const j = await r.json().catch(() => null)
            if (!r.ok) throw new Error(j?.message || "Não foi possível montar o relatório.")
            setSemVaga(j)
        } catch (e) {
            setSemVagaErro(e instanceof Error ? e.message : "Não foi possível montar o relatório.")
        } finally {
            setSemVagaCarregando(false)
        }
    }

    return (
        <main className="logs-page">
            <div className="logs-conteudo">
            <span className="main-eyebrow">CIEPS / Auditoria</span>
            <h1 className="logs-title">Logs</h1>
            <p className="logs-subtitle">Tudo o que acontece no Admin e no site: quem fez, o quê, em quem, antes e depois. Os registros não podem ser apagados.</p>

            <div className="logs-abas" role="tablist">
                <button role="tab" aria-selected={aba === "logs"} className={aba === "logs" ? "ativa" : ""} onClick={() => setAba("logs")} type="button"><History size={16} /> Registro de ações</button>
                <button role="tab" aria-selected={aba === "semvaga"} className={aba === "semvaga" ? "ativa" : ""} onClick={() => { setAba("semvaga"); if (!semVaga && !semVagaCarregando) void carregarSemVaga() }} type="button"><UserX size={16} /> Pagaram e estão sem vaga</button>
            </div>

            {aba === "logs" && (
                <>
                    <form className="logs-filtros" onSubmit={aplicar}>
                        <label className="logs-campo logs-campo-largo">
                            <span>Busca</span>
                            <div className="logs-busca"><Search size={16} /><input value={filtros.q} onChange={set("q")} placeholder="Nome, atividade, cobrança, IP, e-mail…" /></div>
                        </label>
                        <label className="logs-campo"><span>De</span><input type="date" value={filtros.de} onChange={set("de")} /></label>
                        <label className="logs-campo"><span>Até</span><input type="date" value={filtros.ate} onChange={set("ate")} /></label>
                        <label className="logs-campo"><span>Tipo</span>
                            <select value={filtros.categoria} onChange={set("categoria")}><option value="">Todos</option>{CATEGORIAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
                        </label>
                        <label className="logs-campo"><span>Ação</span>
                            <select value={filtros.acao} onChange={set("acao")}><option value="">Todas</option>{opcoes?.acoes.map((a) => <option key={a} value={a}>{a}</option>)}</select>
                        </label>
                        <label className="logs-campo"><span>Origem</span>
                            <select value={filtros.origem} onChange={set("origem")}><option value="">Todas</option>{ORIGENS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
                        </label>
                        <label className="logs-campo"><span>Quem fez</span>
                            <input list="logs-contas" value={filtros.conta} onChange={set("conta")} placeholder="Conta, e-mail ou id" />
                            <datalist id="logs-contas">{opcoes?.contas.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
                        </label>
                        <label className="logs-campo"><span>Quem foi afetado</span><input value={filtros.afetado} onChange={set("afetado")} placeholder="Nome ou id do congressista" /></label>
                        <label className="logs-campo"><span>Atividade</span>
                            <select value={filtros.minicurso} onChange={set("minicurso")}><option value="">Todas</option>{opcoes?.minicursos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
                        </label>
                        <label className="logs-campo"><span>Resultado</span>
                            <select value={filtros.sucesso} onChange={set("sucesso")}><option value="">Todos</option><option value="sim">Deu certo</option><option value="nao">Falhou</option></select>
                        </label>
                        <div className="logs-acoes">
                            <button type="submit" className="logs-btn logs-btn-primario"><Search size={16} /> Filtrar</button>
                            <button type="button" className="logs-btn" onClick={limpar}><FilterX size={16} /> Limpar</button>
                            <button type="button" className="logs-btn" onClick={() => void carregar()} aria-label="Atualizar"><RefreshCw size={16} /></button>
                            <button type="button" className="logs-btn" onClick={() => void exportar()} disabled={exportando}>{exportando ? <Loader2 size={16} className="logs-gira" /> : <Download size={16} />} Exportar CSV</button>
                        </div>
                    </form>

                    {erro && <p className="logs-erro" role="alert">{erro}</p>}

                    <div className="logs-contagem">
                        {carregando ? <><Loader2 size={16} className="logs-gira" /> Carregando…</> : dados ? `${dados.total.toLocaleString("pt-BR")} registro(s)` : null}
                    </div>

                    <div className="logs-tabela-wrap">
                        <table className="logs-tabela">
                            <thead>
                                <tr><th>Data e hora</th><th>Quem fez</th><th>O que fez</th><th>Em quem / onde</th><th>IP</th><th aria-label="Detalhes" /></tr>
                            </thead>
                            <tbody>
                                {dados?.data.length === 0 && !carregando && (
                                    <tr><td colSpan={6} className="logs-vazio-linha">Nenhum registro com esses filtros.</td></tr>
                                )}
                                {dados?.data.map((l) => (
                                    <Fragment key={l._id}>
                                        <tr className={`${l.sucesso ? "" : "logs-falhou"} ${aberto === l._id ? "logs-aberta" : ""}`} onClick={() => setAberto(aberto === l._id ? null : l._id)}>
                                            <td className="logs-data">{dataHora(l.em)}</td>
                                            <td><span className={`logs-origem logs-origem-${l.origem}`}>{ORIGENS.find(([v]) => v === l.origem)?.[1] ?? l.origem}</span><div className="logs-quem">{quem(l)}</div></td>
                                            <td><div className="logs-resumo">{l.resumo}</div><code className="logs-acao">{l.acao}</code></td>
                                            <td>
                                                {l.alvo?.usuarioNome || l.alvo?.usuarioId ? <div>{l.alvo?.usuarioNome || l.alvo?.usuarioId}</div> : null}
                                                {l.alvo?.minicursoNome || l.alvo?.minicursoId ? <div className="logs-atividade">{l.alvo?.minicursoNome || l.alvo?.minicursoId}</div> : null}
                                                {l.alvo?.cobrancaId ? <code className="logs-acao">{l.alvo.cobrancaId}</code> : null}
                                            </td>
                                            <td className="logs-ip">{l.requisicao?.ip || "—"}</td>
                                            <td><button type="button" className="logs-expandir" aria-expanded={aberto === l._id} aria-label="Ver detalhes"><ChevronDown size={18} /></button></td>
                                        </tr>
                                        {aberto === l._id && (
                                            <tr className="logs-detalhe">
                                                <td colSpan={6}>
                                                    <div className="logs-detalhe-grid">
                                                        <section>
                                                            <h3>O que mudou</h3>
                                                            <Diferencas antes={l.antes} depois={l.depois} />
                                                            <div className="logs-antes-depois">
                                                                <div><h4>Antes</h4><Json valor={l.antes} /></div>
                                                                <div><h4>Depois</h4><Json valor={l.depois} /></div>
                                                            </div>
                                                            {l.detalhes !== undefined && <><h4>Detalhes</h4><Json valor={l.detalhes} /></>}
                                                        </section>
                                                        <section>
                                                            <h3>Origem do pedido</h3>
                                                            <dl className="logs-dl">
                                                                <dt>Quem</dt><dd>{quem(l)}{l.ator?.id ? <> · <code>{l.ator.id}</code></> : null}</dd>
                                                                <dt>Resultado</dt><dd>{l.sucesso ? "Deu certo" : "Falhou"}{l.status ? ` (HTTP ${l.status})` : ""}</dd>
                                                                <dt>Rota</dt><dd><code>{l.requisicao?.metodo} {l.requisicao?.rota || "—"}</code></dd>
                                                                <dt>IP</dt><dd>{l.requisicao?.ip || "—"}</dd>
                                                                <dt>Navegador</dt><dd className="logs-ua">{l.requisicao?.userAgent || "—"}</dd>
                                                                {l.alvo?.usuarioId && <><dt>Id do afetado</dt><dd><code>{l.alvo.usuarioId}</code></dd></>}
                                                                {l.alvo?.minicursoId && <><dt>Id da atividade</dt><dd><code>{l.alvo.minicursoId}</code></dd></>}
                                                            </dl>
                                                            {l.requisicao?.corpo !== undefined && l.requisicao?.corpo !== null && <><h4>Dados enviados</h4><Json valor={l.requisicao.corpo} /></>}
                                                        </section>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {dados && dados.totalPaginas > 1 && (
                        <nav className="logs-paginacao" aria-label="Páginas">
                            <button type="button" className="logs-btn" disabled={pagina <= 1 || carregando} onClick={() => setPagina((p) => p - 1)}><ChevronLeft size={16} /> Anterior</button>
                            <span>Página {dados.pagina} de {dados.totalPaginas}</span>
                            <button type="button" className="logs-btn" disabled={pagina >= dados.totalPaginas || carregando} onClick={() => setPagina((p) => p + 1)}>Próxima <ChevronRight size={16} /></button>
                        </nav>
                    )}
                </>
            )}

            {aba === "semvaga" && (
                <section className="logs-semvaga">
                    <p className="logs-nota">
                        Pessoas com cobrança de atividade <strong>paga</strong> que não estão na lista de inscritos (ou faltam numa etapa do pacote).
                        Só leitura: ninguém é reinscrito por aqui.
                    </p>
                    <div className="logs-acoes">
                        <button type="button" className="logs-btn" onClick={() => void carregarSemVaga()} disabled={semVagaCarregando}>
                            {semVagaCarregando ? <Loader2 size={16} className="logs-gira" /> : <RefreshCw size={16} />} Atualizar
                        </button>
                    </div>
                    {semVagaErro && <p className="logs-erro" role="alert">{semVagaErro}</p>}
                    {semVaga && (
                        <>
                            <div className="logs-contagem">{semVaga.linhas.length} pessoa(s) · gerado em {dataHora(semVaga.geradoEm)}</div>
                            <div className="logs-tabela-wrap">
                                <table className="logs-tabela">
                                    <thead><tr><th>Pessoa</th><th>Atividade</th><th>Valor</th><th>Pago em</th><th>Como sumiu</th><th>Vagas livres</th></tr></thead>
                                    <tbody>
                                        {semVaga.linhas.length === 0 && <tr><td colSpan={6} className="logs-vazio-linha">Ninguém pagou e ficou sem vaga.</td></tr>}
                                        {semVaga.linhas.map((l) => (
                                            <tr key={`${l.usuarioId}-${l.minicurso}`}>
                                                <td><a href={`/usuarios/informacoes/${l.usuarioId}`}>{l.nome || l.usuarioId}</a><div className="logs-quem">{l.email}</div></td>
                                                <td>{l.minicurso}{l.etapaFaltando ? <div className="logs-atividade">falta na etapa: {l.etapaFaltando}</div> : null}{l.minicursoJaComecou ? <div className="logs-atividade">já começou</div> : null}</td>
                                                <td>{l.valor != null ? l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                                                <td className="logs-data">{dataHora(l.pagoEm)}</td>
                                                <td><div className="logs-resumo">{CAUSAS[l.causa] ?? l.causa}</div><div className="logs-quem">{l.sumiuEm ? dataHora(l.sumiuEm) : ""} {l.detalheCausa}</div></td>
                                                <td>{l.vagasLivres ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </section>
            )}
            </div>
        </main>
    )
}
