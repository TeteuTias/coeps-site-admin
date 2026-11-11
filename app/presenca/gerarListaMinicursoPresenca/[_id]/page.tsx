'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { QrCode, RefreshCw, UserPlus } from 'lucide-react'
import {
    displayUserField,
    displayUserName,
    parseAdminUserListPayload,
} from '@/app/lib/users/admin-user-contract'
import type { AdminUserDetails, AdminUserSummary } from '@/app/lib/users/admin-user-contract'
import { parseDataObjectPayload } from '@/app/lib/api-data-contract'
import { useUser } from '@/app/lib/auth0-client'
import { Aviso, Botao, Cabecalho, Metrica, Pagina, Secao, Selo } from '@/app/components/ui'
import { Atualizando, Estado } from '@/app/components/Estado'
import { useAvisos } from '@/app/components/Avisos'
import { formatarDataHora, formatarHora, formatarNumero } from '@/app/lib/formatar'
import { LeitorQr } from '../../_componentes/leitor-qr'
import { normalizarBusca } from '../../_componentes/chamada'
import { useAcoesChamada } from '../../_componentes/use-acoes-chamada'
import type { PedidoAcao } from '../../_componentes/use-acoes-chamada'
import { useLeituraQr } from '../../_componentes/use-leitura-qr'
import {
    BotaoExportar, BuscaChamada, ListaChamada, ListaObservacoes, MarcasPessoa, Recentes, ResultadoLeitura,
    FiltroPresenca, observacoesBase, useFocoBusca,
} from '../../_componentes/chamada-ui'
import type { Filtro, Observacao } from '../../_componentes/chamada-ui'

interface Curso { nome: string; vagas: number; participants: string[]; attendanceList: string[]; encontros: { date_init?: string; local?: string }[] }

const ehTexto = (l: unknown): l is string[] => Array.isArray(l) && l.every((id) => typeof id === 'string')

function lerCurso(payload: unknown): Curso | null {
    const c = parseDataObjectPayload(payload)
    if (!c || typeof c.name !== 'string' || typeof c.maxParticipants !== 'number' || !Number.isFinite(c.maxParticipants) || !ehTexto(c.participants) || !ehTexto(c.attendanceList)) return null
    return { nome: c.name, vagas: c.maxParticipants, participants: c.participants, attendanceList: c.attendanceList, encontros: Array.isArray(c.timeline) ? c.timeline : [] }
}

const porNome = (a: AdminUserSummary, b: AdminUserSummary) => displayUserName(a).localeCompare(displayUserName(b), 'pt-BR')
const comId = (s: ReadonlySet<string>, id: string, entra: boolean) => { const n = new Set(s); if (entra) n.add(id); else n.delete(id); return n }
const casa = (u: AdminUserSummary, termo: string, bruto: string) =>
    normalizarBusca(displayUserName(u)).includes(termo) || normalizarBusca(u.informacoes_usuario.email ?? '').includes(termo) || u._id === bruto.trim().toLowerCase()

const VOLTAR = { href: '/presenca', rotulo: 'Voltar às listas de presença' }
const jsonPost = { 'Content-Type': 'application/json' }

export default function ChamadaMinicurso() {
    const { _id } = useParams<{ _id: string }>()
    const user = useUser()
    const { avisar, confirmar } = useAvisos()
    // conta administradora atual (a mesma de userPermissionsServerSide); o servidor também valida
    const podeGerir = Boolean(user?.user?.sub?.includes('6a8799078ecd649be9bdb061'))

    const [carga, setCarga] = useState<'carregando' | 'erro' | 'ok'>('carregando')
    const [atualizando, setAtualizando] = useState(false)
    const [curso, setCurso] = useState<Curso | null>(null)
    const [todos, setTodos] = useState<AdminUserSummary[]>([])
    const [lista, setLista] = useState<AdminUserSummary[]>([])
    const [inscritos, setInscritos] = useState<ReadonlySet<string>>(new Set())
    const [presentes, setPresentes] = useState<ReadonlySet<string>>(new Set())
    const [naHora, setNaHora] = useState<ReadonlySet<string>>(new Set())
    const [busca, setBusca] = useState('')
    const [filtro, setFiltro] = useState<Filtro>('todos')
    const [leitorAberto, setLeitorAberto] = useState(false)
    const [feito, setFeito] = useState<{ lido: number; texto: string } | null>(null)
    const { ref: refBusca, focar: focarBusca } = useFocoBusca()
    const { leitura, ler, limpar } = useLeituraQr()
    const seq = useRef(0)
    const jaCarregou = useRef(false)

    const carregar = useCallback(async (manual: boolean) => {
        const n = ++seq.current
        if (manual) setAtualizando(true)
        try {
            const [cursoRes, todosRes] = await Promise.all([fetch(`/api/get/minicursoProps/${_id}`), fetch('/api/get/todosCongressistas/')])
            if (!cursoRes.ok || !todosRes.ok) throw new Error('carga')
            const c = lerCurso(await cursoRes.json().catch(() => null))
            const t = parseAdminUserListPayload(await todosRes.json().catch(() => null))
            if (!c || !t) throw new Error('dados')
            const infoRes = await fetch('/api/post/informacoesVariosUsuarios', { method: 'POST', headers: jsonPost, body: JSON.stringify(c.participants) })
            if (!infoRes.ok) throw new Error('inscritos')
            const l = parseAdminUserListPayload(await infoRes.json().catch(() => null))
            if (!l) throw new Error('inscritos')
            if (n !== seq.current) return
            setCurso(c); setTodos(t); setLista(l)
            setInscritos(new Set(c.participants)); setPresentes(new Set(c.attendanceList)); setNaHora(new Set())
            jaCarregou.current = true
            setCarga('ok')
        } catch {
            if (n !== seq.current) return
            if (jaCarregou.current) avisar('erro', 'Não foi possível atualizar a lista', 'A lista que está na tela foi mantida. Confira a conexão e tente de novo.')
            else setCarga('erro')
        } finally {
            if (n === seq.current) setAtualizando(false)
        }
    }, [_id, avisar])

    useEffect(() => { void carregar(false) }, [carregar])

    const { ocupados, incertos, recentes, executar, conferir } = useAcoesChamada({
        enviar: ({ pessoa, quer }: PedidoAcao) => quer === 'desinscrever'
            ? fetch('/api/delete/removerInscricaoMinicurso/', { method: 'DELETE', body: JSON.stringify({ eventId: _id, userId: pessoa._id }) })
            : fetch(quer === 'dar' ? '/api/post/darPresenca' : '/api/post/retirarPresenca', { method: 'POST', headers: jsonPost, body: JSON.stringify({ eventId: _id, userId: pessoa._id }) }),
        aplicar: ({ pessoa, quer, inscreveJunto }) => {
            const id = pessoa._id
            if (quer === 'dar') {
                setPresentes((s) => comId(s, id, true))
                // dar presença também inscreve (a rota grava nas duas listas)
                setInscritos((s) => comId(s, id, true))
                if (inscreveJunto) setNaHora((s) => comId(s, id, true))
                setLista((l) => (l.some((u) => u._id === id) ? l : [...l, pessoa].sort(porNome)))
            } else if (quer === 'retirar') {
                setPresentes((s) => comId(s, id, false))
            } else {
                setPresentes((s) => comId(s, id, false)); setInscritos((s) => comId(s, id, false)); setNaHora((s) => comId(s, id, false))
                setLista((l) => l.filter((u) => u._id !== id))
            }
        },
        reconsultar: async ({ pessoa }) => {
            const res = await fetch(`/api/get/minicursoProps/${_id}`)
            if (!res.ok) return null
            const c = lerCurso(await res.json().catch(() => null))
            if (!c) return null
            setCurso(c); setInscritos(new Set(c.participants)); setPresentes(new Set(c.attendanceList))
            return { presente: c.attendanceList.includes(pessoa._id), inscrito: c.participants.includes(pessoa._id) }
        },
    })

    const termo = normalizarBusca(busca)
    const filtrados = useMemo(
        () => lista.filter((u) => (filtro === 'todos' || (filtro === 'presentes') === presentes.has(u._id)) && (!termo || casa(u, termo, busca))),
        [lista, filtro, presentes, termo, busca],
    )
    const foraDaLista = useMemo(
        () => (podeGerir && termo.length >= 2 ? todos.filter((u) => !inscritos.has(u._id) && casa(u, termo, busca)).slice(0, 8) : []),
        [podeGerir, termo, todos, inscritos, busca],
    )
    const totalPresentes = useMemo(() => lista.filter((u) => presentes.has(u._id)).length, [lista, presentes])

    if (carga === 'carregando') {
        return (
            <Pagina largura="ampla">
                <Cabecalho etiqueta="Chamada · Minicurso" titulo="Lista de presença" voltar={VOLTAR} />
                <Estado tipo="carregando" titulo="Carregando a chamada…" linhas={4} />
            </Pagina>
        )
    }
    if (carga === 'erro' || !curso) {
        return (
            <Pagina largura="ampla">
                <Cabecalho etiqueta="Chamada · Minicurso" titulo="Lista de presença" voltar={VOLTAR} />
                <Estado
                    tipo="erro"
                    titulo="Não foi possível abrir a chamada"
                    texto="A lista não carregou ou este minicurso não existe mais. Confira a conexão e tente de novo."
                    aoTentar={() => { setCarga('carregando'); void carregar(false) }}
                />
            </Pagina>
        )
    }

    // vagas 0 = limite não definido (o catálogo também trata assim): nunca "lotado"
    const lotado = curso.vagas > 0 && inscritos.size >= curso.vagas
    const primeiro = curso.encontros[0]
    const sub = [
        primeiro?.date_init ? formatarDataHora(primeiro.date_init) : null,
        primeiro?.local || null,
        curso.encontros.length > 1 ? `${curso.encontros.length} encontros` : null,
    ].filter(Boolean).join(' · ') || undefined

    async function darPresenca(pessoa: AdminUserSummary) {
        const inscreveJunto = !inscritos.has(pessoa._id)
        if (inscreveJunto && lotado && !(await confirmar({
            titulo: 'Minicurso lotado',
            descricao: `As ${curso!.vagas} vagas já estão preenchidas. Dar presença a ${displayUserName(pessoa)} também a inscreve e passa do limite. Continuar?`,
            rotuloConfirmar: 'Inscrever e dar presença',
        }))) return 'ocupado' as const
        return executar({ pessoa, quer: 'dar', inscreveJunto })
    }

    async function removerInscricao(pessoa: AdminUserSummary) {
        const confirmou = await confirmar({
            titulo: 'Remover a inscrição?',
            descricao: `${displayUserName(pessoa)} sai da lista deste minicurso e perde a presença registrada. Se houver cobrança em aberto no Asaas, ela será cancelada. Pagamento já recebido NÃO é estornado por aqui.`,
            perigo: true,
            rotuloConfirmar: 'Remover inscrição',
        })
        if (!confirmou) return
        const desfecho = await executar({ pessoa, quer: 'desinscrever' })
        // a linha some: o foco vai para a busca, sem mexer na rolagem
        if (desfecho === 'registrado' || desfecho === 'jaEstava') requestAnimationFrame(focarBusca)
    }

    async function daLeitura(pessoa: AdminUserDetails, quer: 'dar' | 'retirar', lido: number) {
        const desfecho = quer === 'dar' ? await darPresenca(pessoa) : await executar({ pessoa, quer })
        if (desfecho === 'ocupado') return
        if (desfecho === 'registrado') setFeito({ lido, texto: quer === 'dar' ? 'Presença registrada agora.' : 'Presença retirada agora.' })
        else if (desfecho === 'jaEstava') setFeito({ lido, texto: quer === 'dar' ? 'Já estava presente: nada foi alterado.' : 'Já estava sem presença: nada foi alterado.' })
        else if (desfecho === 'semResposta') setFeito({ lido, texto: 'Sem resposta do servidor: confira a pessoa na lista antes de repetir.' })
        requestAnimationFrame(focarBusca)
    }

    function conteudoLeitura(pessoa: AdminUserDetails) {
        const id = pessoa._id
        const presente = presentes.has(id)
        const inscrito = inscritos.has(id)
        const quando = recentes.find((r) => r.id === id)?.quando
        const obs: Observacao[] = observacoesBase(pessoa)
        obs.push(inscrito
            ? { tom: 'ok', texto: 'Inscrita neste minicurso.' }
            : { tom: 'alerta', texto: `Sem inscrição neste minicurso. Dar presença também inscreve a pessoa${lotado ? ` e passa do limite de ${curso!.vagas} vagas` : ''}.` })
        if (presente && feito?.lido !== leitura?.lido) {
            obs.push({ tom: 'info', texto: quando ? `Já estava presente: registrada às ${formatarHora(quando)} nesta tela.` : 'Já estava presente: a presença foi registrada antes.' })
        }
        return (
            <>
                <ListaObservacoes itens={obs} />
                {feito && leitura && feito.lido === leitura.lido && <Aviso tom="ok" titulo={feito.texto} />}
                <div className="flex flex-wrap gap-2">
                    {presente
                        ? <Botao estilo="contorno" carregando={ocupados.has(id)} onClick={() => void daLeitura(pessoa, 'retirar', leitura!.lido)}>Retirar presença</Botao>
                        : <Botao data-principal="" carregando={ocupados.has(id)} onClick={() => void daLeitura(pessoa, 'dar', leitura!.lido)}>{inscrito ? 'Dar presença' : 'Inscrever e dar presença'}</Botao>}
                    <Botao estilo="fantasma" onClick={() => { limpar(); focarBusca() }}>Fechar</Botao>
                </div>
            </>
        )
    }

    const colunaSituacao = {
        titulo: 'Situação',
        render: (u: AdminUserSummary) => (
            <span className="flex flex-wrap gap-1.5">
                {presentes.has(u._id) ? <Selo tom="ok">Presente</Selo> : <Selo>Inscrito, ainda não chegou</Selo>}
                {naHora.has(u._id) && <Selo tom="info">Inscrito na hora</Selo>}
                {incertos.has(u._id) && <Selo tom="alerta">Sem resposta: conferir</Selo>}
            </span>
        ),
    }

    return (
        <Pagina largura="ampla">
            <Cabecalho
                etiqueta="Chamada · Minicurso"
                titulo={curso.nome}
                sub={sub}
                voltar={VOLTAR}
                acoes={(
                    <>
                        <Botao estilo="contorno" carregando={atualizando} onClick={() => void carregar(true)}>
                            <RefreshCw className="size-4" aria-hidden="true" />Atualizar lista
                        </Botao>
                        <BotaoExportar
                            rotulo={`Exportar presentes (${formatarNumero(totalPresentes)})`}
                            desabilitado={totalPresentes === 0}
                            gerar={async () => {
                                const XLSX = await import('xlsx')
                                const linhas = lista.filter((u) => presentes.has(u._id)).map((u) => ({
                                    NOME: displayUserName(u),
                                    CPF: displayUserField(u.informacoes_usuario.cpf),
                                    EMAIL: displayUserField(u.informacoes_usuario.email),
                                }))
                                const planilha = XLSX.utils.json_to_sheet(linhas)
                                planilha['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 34 }]
                                const livro = XLSX.utils.book_new()
                                XLSX.utils.book_append_sheet(livro, planilha, 'Dados')
                                XLSX.writeFile(livro, 'MinhaPlanilha.xlsx')
                            }}
                        />
                    </>
                )}
            >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metrica rotulo="Inscritos" valor={formatarNumero(lista.length)} />
                    <Metrica rotulo="Vagas" valor={formatarNumero(curso.vagas)} detalhe={lotado ? 'Lotado' : `${formatarNumero(Math.max(curso.vagas - inscritos.size, 0))} livres`} />
                    <Metrica rotulo="Presentes" valor={formatarNumero(totalPresentes)} />
                    <Metrica rotulo="Ainda não chegaram" valor={formatarNumero(lista.length - totalPresentes)} />
                </div>
            </Cabecalho>

            <Secao titulo="Credenciamento" descricao="Leia o QR da credencial ou busque a pessoa. A busca também filtra a lista abaixo.">
                <Aviso tom="info" titulo="Presença e inscrição andam juntas">
                    Dar presença neste minicurso também inscreve a pessoa, e remover a inscrição retira a presença. O valor pago não é estornado por aqui.
                </Aviso>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="grid content-start gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <BuscaChamada valor={busca} aoMudar={setBusca} dica="Nome, e-mail ou código da credencial" foco={refBusca} />
                            {!leitorAberto && (
                                <Botao onClick={() => setLeitorAberto(true)}><QrCode className="size-4" aria-hidden="true" />Ler QR</Botao>
                            )}
                        </div>
                        {leitorAberto && <LeitorQr aoLer={ler} aoFechar={() => setLeitorAberto(false)} />}
                        {leitura && <ResultadoLeitura leitura={leitura} aoFechar={() => { limpar(); focarBusca() }}>{conteudoLeitura}</ResultadoLeitura>}
                    </div>
                    <Recentes itens={recentes} />
                </div>
            </Secao>

            <Secao
                titulo="Lista de inscritos"
                descricao={`${formatarNumero(filtrados.length)} de ${formatarNumero(lista.length)} pessoas${termo ? ' na busca' : ''}.`}
                acoes={<Atualizando ativo={atualizando} />}
            >
                <FiltroPresenca valor={filtro} aoMudar={setFiltro} rotulos={{ todos: 'Todos', ausentes: 'Ainda não chegaram', presentes: 'Presentes' }} />
                {lista.length === 0 && (
                    <Estado tipo="vazio" titulo="Ninguém inscrito neste minicurso" texto={podeGerir ? 'Busque uma pessoa acima para inscrevê-la e dar presença.' : 'Quando houver inscritos, eles aparecem aqui.'} />
                )}
                {lista.length > 0 && filtrados.length === 0 && (
                    <Estado tipo="semResultado" acao={<Botao estilo="contorno" onClick={() => { setBusca(''); setFiltro('todos') }}>Limpar busca e filtro</Botao>} />
                )}
                {filtrados.length > 0 && (
                    <ListaChamada
                        rotulo="Inscritos e presença no minicurso"
                        pessoas={filtrados}
                        classeTabela="[&_table]:min-w-[44rem]"
                        colunas={[colunaSituacao]}
                        extraNome={(u) => <MarcasPessoa u={u} />}
                        acoes={(u) => {
                            const nome = displayUserName(u)
                            return (
                                <>
                                    {podeGerir && (incertos.has(u._id)
                                        ? <Botao estilo="contorno" carregando={ocupados.has(u._id)} onClick={() => void conferir(u)} aria-label={`Conferir a situação de ${nome}`}>Conferir</Botao>
                                        : presentes.has(u._id)
                                            ? <Botao estilo="contorno" carregando={ocupados.has(u._id)} onClick={() => void executar({ pessoa: u, quer: 'retirar' })} aria-label={`Retirar a presença de ${nome}`}>Retirar presença</Botao>
                                            : <Botao carregando={ocupados.has(u._id)} onClick={() => void darPresenca(u)} aria-label={`Dar presença a ${nome}`}>Dar presença</Botao>)}
                                    {/* como no original, remover inscrição não depende do gate de presença */}
                                    <Botao estilo="perigo" disabled={ocupados.has(u._id)} onClick={() => void removerInscricao(u)} aria-label={`Remover a inscrição de ${nome}`}>Remover inscrição</Botao>
                                </>
                            )
                        }}
                    />
                )}
            </Secao>

            {foraDaLista.length > 0 && (
                <Secao titulo="Sem inscrição neste minicurso" descricao="Resultados da busca entre todos os congressistas. Dar presença também inscreve a pessoa.">
                    {lotado && <Aviso tom="alerta" titulo="Minicurso lotado">As {formatarNumero(curso.vagas)} vagas já estão preenchidas. Você será avisado antes de passar do limite.</Aviso>}
                    <ul className="grid gap-2">
                        {foraDaLista.map((u) => (
                            <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linha px-4 py-3">
                                <div className="min-w-0">
                                    <p className="break-words font-medium">{displayUserName(u)}</p>
                                    <p className="break-all text-sm text-sutil">{displayUserField(u.informacoes_usuario.email)}</p>
                                    <div className="mt-1"><MarcasPessoa u={u} /></div>
                                </div>
                                <Botao carregando={ocupados.has(u._id)} onClick={() => void darPresenca(u)} aria-label={`Inscrever e dar presença a ${displayUserName(u)}`}>
                                    <UserPlus className="size-4" aria-hidden="true" />Inscrever e dar presença
                                </Botao>
                            </li>
                        ))}
                    </ul>
                </Secao>
            )}
        </Pagina>
    )
}
