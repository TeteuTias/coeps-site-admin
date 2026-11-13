'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { LogIn, LogOut, QrCode, RefreshCw } from 'lucide-react'
import {
    displayUserField,
    displayUserName,
    parseAdminUserListPayload,
} from '@/app/lib/users/admin-user-contract'
import type { AdminUserSummary } from '@/app/lib/users/admin-user-contract'
import { parseDataObjectPayload } from '@/app/lib/api-data-contract'
import { useUser } from '@/app/lib/auth0-client'
import { Aviso, Botao, Cabecalho, Metrica, Pagina, Secao, Selo } from '@/app/components/ui'
import { Atualizando, Estado } from '@/app/components/Estado'
import { useAvisos } from '@/app/components/Avisos'
import { formatarDataHora, formatarNumero } from '@/app/lib/formatar'
import { LeitorQr } from '../../_componentes/leitor-qr'
import { normalizarBusca } from '../../_componentes/chamada'
import { useAcoesChamada } from '../../_componentes/use-acoes-chamada'
import type { PedidoAcao, Turno } from '../../_componentes/use-acoes-chamada'
import { useLeituraQr } from '../../_componentes/use-leitura-qr'
import { usuariosComPresenca } from '../../_componentes/dados-chamada'
import { AvisoPendentes, usePendentesPresenca } from '../../PendentesPresenca'
import {
    BotaoExportar, BuscaChamada, FiltroPresenca, ListaChamada, ListaObservacoes, MarcasPessoa, Recentes,
    ResultadoLeitura, observacoesBase, useFocoBusca,
} from '../../_componentes/chamada-ui'
import type { Filtro, Observacao } from '../../_componentes/chamada-ui'

interface Palestra { nome: string; entrada: string[]; saida: string[]; encontros: { date_init?: string; local?: string }[] }

const ehTexto = (l: unknown): l is string[] => Array.isArray(l) && l.every((id) => typeof id === 'string')

function lerPalestra(payload: unknown): Palestra | null {
    const p = parseDataObjectPayload(payload)
    if (!p || typeof p.name !== 'string' || !ehTexto(p.attendanceListInit) || !ehTexto(p.attendanceListEnd)) return null
    return { nome: p.name, entrada: p.attendanceListInit, saida: p.attendanceListEnd, encontros: Array.isArray(p.timeline) ? p.timeline : [] }
}

const porNome = (a: AdminUserSummary, b: AdminUserSummary) => displayUserName(a).localeCompare(displayUserName(b), 'pt-BR')
const comId = (s: ReadonlySet<string>, id: string, entra: boolean) => { const n = new Set(s); if (entra) n.add(id); else n.delete(id); return n }
const casa = (u: AdminUserSummary, termo: string, bruto: string) =>
    normalizarBusca(displayUserName(u)).includes(termo) || normalizarBusca(u.informacoes_usuario.email ?? '').includes(termo) || u._id === bruto.trim().toLowerCase()

const NOME_TURNO = { init: 'entrada', end: 'saída' } as const
const VOLTAR = { href: '/presenca', rotulo: 'Voltar às listas de presença' }

export default function ChamadaPalestra() {
    const { _id } = useParams<{ _id: string }>()
    const user = useUser()
    const { avisar } = useAvisos()
    // conta administradora atual (a mesma de userPermissionsServerSide); o servidor também valida
    const podeGerir = Boolean(user?.user?.sub?.includes('6a8799078ecd649be9bdb061'))

    const [carga, setCarga] = useState<'carregando' | 'erro' | 'ok'>('carregando')
    const [atualizando, setAtualizando] = useState(false)
    const [palestra, setPalestra] = useState<Palestra | null>(null)
    const [lista, setLista] = useState<AdminUserSummary[]>([])
    const [entrada, setEntrada] = useState<ReadonlySet<string>>(new Set())
    const [saida, setSaida] = useState<ReadonlySet<string>>(new Set())
    const [turno, setTurno] = useState<Turno>('init')
    const [busca, setBusca] = useState('')
    const [filtro, setFiltro] = useState<Filtro>('todos')
    const [leitorAberto, setLeitorAberto] = useState(false)
    const [feito, setFeito] = useState<{ lido: number; texto: string } | null>(null)
    const { ref: refBusca, focar: focarBusca } = useFocoBusca()
    const { leitura, ler, limpar } = useLeituraQr(lista)
    const seq = useRef(0)
    const jaCarregou = useRef(false)

    const carregar = useCallback(async (manual: boolean) => {
        const n = ++seq.current
        if (manual) setAtualizando(true)
        try {
            const [palestraRes, inscritosRes] = await Promise.all([fetch(`/api/get/palestraProps/${_id}`), fetch('/api/get/todosCongressistasInscritos/')])
            if (!palestraRes.ok || !inscritosRes.ok) throw new Error('carga')
            const p = lerPalestra(await palestraRes.json().catch(() => null))
            const l = parseAdminUserListPayload(await inscritosRes.json().catch(() => null))
            if (!p || !l) throw new Error('dados')
            if (n !== seq.current) return
            setPalestra(p); setLista(l); setEntrada(new Set(p.entrada)); setSaida(new Set(p.saida))
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

    // presença sem resposta do servidor fica guardada no aparelho e é reenviada; ao entregar, recarrega a lista
    const { pendentes, enviarAgora } = usePendentesPresenca(_id, () => { void carregar(false) })
    const guardados = useMemo(
        () => new Map(pendentes.filter((p) => p.eventId === _id && p.turno === turno).map((p) => [p.userId, p.quer])),
        [pendentes, _id, turno],
    )

    const { ocupados, incertos, recentes, executar, conferir } = useAcoesChamada({
        atividade: { tipo: 'palestra', eventId: _id },
        enviar: ({ pessoa, quer, turno: t }: PedidoAcao, signal) => fetch(quer === 'dar' ? '/api/post/darPresencaPalestra' : '/api/post/retirarPresencaPalestra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: _id, userId: pessoa._id, listType: t }),
            signal,
        }),
        aplicar: ({ pessoa, quer, turno: t }) => {
            const id = pessoa._id
            ;(t === 'end' ? setSaida : setEntrada)((s) => comId(s, id, quer === 'dar'))
            // quem foi lido pelo QR sem estar na lista de inscritos entra na tela com a presença já marcada
            setLista((l) => (l.some((u) => u._id === id) ? l : [...l, pessoa].sort(porNome)))
        },
        reconsultar: async ({ pessoa, turno: t }) => {
            const res = await fetch(`/api/get/palestraProps/${_id}`)
            if (!res.ok) return null
            const p = lerPalestra(await res.json().catch(() => null))
            if (!p) return null
            setPalestra(p); setEntrada(new Set(p.entrada)); setSaida(new Set(p.saida))
            return { presente: (t === 'end' ? p.saida : p.entrada).includes(pessoa._id), inscrito: true }
        },
    })

    const ativo = turno === 'init' ? entrada : saida
    const nomeTurno = NOME_TURNO[turno]
    const termo = normalizarBusca(busca)
    const filtrados = useMemo(
        () => lista.filter((u) => (filtro === 'todos' || (filtro === 'presentes') === ativo.has(u._id)) && (!termo || casa(u, termo, busca))),
        [lista, filtro, ativo, termo, busca],
    )
    const totais = useMemo(
        () => ({ entrada: lista.filter((u) => entrada.has(u._id)).length, saida: lista.filter((u) => saida.has(u._id)).length }),
        [lista, entrada, saida],
    )

    if (carga === 'carregando') {
        return (
            <Pagina largura="ampla">
                <Cabecalho etiqueta="Chamada · Palestra" titulo="Lista de presença" voltar={VOLTAR} />
                <Estado tipo="carregando" titulo="Carregando a chamada…" linhas={4} />
            </Pagina>
        )
    }
    if (carga === 'erro' || !palestra) {
        return (
            <Pagina largura="ampla">
                <Cabecalho etiqueta="Chamada · Palestra" titulo="Lista de presença" voltar={VOLTAR} />
                <Estado
                    tipo="erro"
                    titulo="Não foi possível abrir a chamada"
                    texto="A lista não carregou ou esta palestra não existe mais. Confira a conexão e tente de novo."
                    aoTentar={() => { setCarga('carregando'); void carregar(false) }}
                />
            </Pagina>
        )
    }

    const primeiro = palestra.encontros[0]
    const sub = [primeiro?.date_init ? formatarDataHora(primeiro.date_init) : null, primeiro?.local || null].filter(Boolean).join(' · ') || undefined

    function trocarTurno(novo: Turno) {
        if (novo === turno) return
        setTurno(novo)
        setFiltro('todos')
        avisar('info', `Agora registrando a ${NOME_TURNO[novo].toUpperCase()}`, 'Toda presença dada ou retirada daqui em diante vale para este turno.')
    }

    async function daLeitura(pessoa: AdminUserSummary, quer: 'dar' | 'retirar', lido: number) {
        const desfecho = await executar({ pessoa, quer, turno })
        if (desfecho === 'ocupado') return
        if (desfecho === 'registrado') setFeito({ lido, texto: quer === 'dar' ? `Presença de ${nomeTurno} registrada agora.` : `Presença de ${nomeTurno} retirada agora.` })
        else if (desfecho === 'jaEstava') setFeito({ lido, texto: quer === 'dar' ? `Já estava com ${nomeTurno}: nada foi alterado.` : `Já estava sem ${nomeTurno}: nada foi alterado.` })
        else if (desfecho === 'guardado') setFeito({ lido, texto: `${quer === 'dar' ? 'Presença' : 'Retirada'} de ${nomeTurno} guardada neste aparelho: será enviada quando a internet voltar.` })
        else if (desfecho === 'semResposta') setFeito({ lido, texto: 'Sem resposta do servidor: confira a pessoa na lista antes de repetir.' })
        requestAnimationFrame(focarBusca)
    }

    function conteudoLeitura(pessoa: AdminUserSummary) {
        const id = pessoa._id
        const presente = ativo.has(id)
        const obs: Observacao[] = observacoesBase(pessoa)
        obs.push(presente
            ? { tom: 'info', texto: `Já tem a ${nomeTurno} registrada.` }
            : { tom: 'neutro', texto: `A ${nomeTurno} ainda não foi registrada.` })
        return (
            <>
                <div className="flex flex-wrap gap-2">
                    <Selo tom={entrada.has(id) ? 'ok' : 'neutro'}>Entrada: {entrada.has(id) ? 'registrada' : 'não registrada'}</Selo>
                    <Selo tom={saida.has(id) ? 'ok' : 'neutro'}>Saída: {saida.has(id) ? 'registrada' : 'não registrada'}</Selo>
                </div>
                <ListaObservacoes itens={obs} />
                {feito && leitura && feito.lido === leitura.lido && <Aviso tom="ok" titulo={feito.texto} />}
                <div className="flex flex-wrap gap-2">
                    {presente
                        ? <Botao estilo="contorno" carregando={ocupados.has(id)} onClick={() => void daLeitura(pessoa, 'retirar', leitura!.lido)}>Retirar {nomeTurno}</Botao>
                        : <Botao data-principal="" carregando={ocupados.has(id)} onClick={() => void daLeitura(pessoa, 'dar', leitura!.lido)}>Registrar {nomeTurno}</Botao>}
                    <Botao estilo="fantasma" onClick={() => { limpar(); focarBusca() }}>Fechar</Botao>
                </div>
            </>
        )
    }

    const selo = (marcado: boolean) => (marcado ? <Selo tom="ok">Registrada</Selo> : <Selo>Não registrada</Selo>)
    const colunas = [
        { titulo: turno === 'init' ? 'Entrada (ativa)' : 'Entrada', render: (u: AdminUserSummary) => selo(entrada.has(u._id)) },
        { titulo: turno === 'end' ? 'Saída (ativa)' : 'Saída', render: (u: AdminUserSummary) => selo(saida.has(u._id)) },
        {
            titulo: 'Situação',
            render: (u: AdminUserSummary) => {
                const e = entrada.has(u._id)
                const s = saida.has(u._id)
                return (
                    <span className="flex flex-wrap gap-1.5">
                        {e && s ? <Selo tom="ok">Ambas</Selo> : e ? <Selo tom="info">Só entrada</Selo> : s ? <Selo tom="alerta">Só saída</Selo> : <Selo>Sem registro</Selo>}
                        {incertos.has(u._id) && <Selo tom="alerta">Sem resposta: conferir</Selo>}
                        {guardados.has(u._id) && <Selo tom="alerta">{guardados.get(u._id) === 'retirar' ? 'Retirada guardada, aguardando envio' : 'Presença guardada, aguardando envio'}</Selo>}
                    </span>
                )
            },
        },
    ]

    return (
        <Pagina largura="ampla">
            <Cabecalho
                etiqueta="Chamada · Palestra"
                titulo={palestra.nome}
                sub={sub}
                voltar={VOLTAR}
                acoes={(
                    <>
                        <Botao estilo="contorno" carregando={atualizando} onClick={() => void carregar(true)}>
                            <RefreshCw className="size-4" aria-hidden="true" />Atualizar lista
                        </Botao>
                        <BotaoExportar
                            rotulo={`Exportar planilha (entrada ${formatarNumero(totais.entrada)} · saída ${formatarNumero(totais.saida)})`}
                            desabilitado={totais.entrada + totais.saida === 0}
                            gerar={async () => {
                                // a tela pode estar velha (outros leitores registram ao mesmo tempo): usa as listas do servidor no momento do clique
                                let ids = { init: [...entrada], end: [...saida] }
                                let usuarios: AdminUserSummary[] = lista
                                try {
                                    const res = await fetch(`/api/get/palestraProps/${_id}`)
                                    const atual = res.ok ? lerPalestra(await res.json().catch(() => null)) : null
                                    if (!atual) throw new Error('palestra')
                                    ids = { init: atual.entrada, end: atual.saida }
                                    // quem tem presença mas não está entre os inscritos listados também entra na planilha
                                    usuarios = await usuariosComPresenca([...ids.init, ...ids.end], lista)
                                } catch {
                                    ids = { init: [...entrada], end: [...saida] }
                                    usuarios = lista
                                    avisar('alerta', 'Planilha com a lista desta tela', 'Não foi possível buscar a lista atual no servidor: podem faltar presenças registradas em outros aparelhos.')
                                }
                                const guardadas = pendentes.filter((p) => p.eventId === _id).length
                                if (guardadas) avisar('alerta', 'Há presenças fora da planilha', `${guardadas} presença(s) guardada(s) neste aparelho ainda não chegaram ao servidor e não estão na planilha.`)
                                const XLSX = await import('xlsx')
                                const linhas = (porId: readonly string[]) => porId.map((id) => usuarios.find((u) => u._id === id)).filter((u): u is AdminUserSummary => !!u).sort(porNome).map((u) => ({
                                    NOME: displayUserName(u),
                                    CPF: displayUserField(u.informacoes_usuario.cpf),
                                    EMAIL: displayUserField(u.informacoes_usuario.email),
                                }))
                                const livro = XLSX.utils.book_new()
                                for (const aba of ['init', 'end'] as const) {
                                    const planilha = XLSX.utils.json_to_sheet(linhas(ids[aba]))
                                    planilha['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 34 }]
                                    XLSX.utils.book_append_sheet(livro, planilha, aba)
                                }
                                XLSX.writeFile(livro, 'Presenca.xlsx')
                            }}
                        />
                    </>
                )}
            >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metrica rotulo="Inscritos" valor={formatarNumero(lista.length)} />
                    <Metrica rotulo="Com entrada" valor={formatarNumero(totais.entrada)} />
                    <Metrica rotulo="Com saída" valor={formatarNumero(totais.saida)} />
                    <Metrica rotulo={`Sem ${nomeTurno}`} valor={formatarNumero(lista.length - (turno === 'init' ? totais.entrada : totais.saida))} />
                </div>
            </Cabecalho>

            <AvisoPendentes pendentes={pendentes} eventId={_id} enviarAgora={enviarAgora} />

            <section
                aria-label="Turno ativo"
                className={`grid gap-3 rounded-2xl border-2 p-4 sm:p-5 ${turno === 'init' ? 'border-info bg-info-fundo text-info' : 'border-alerta bg-alerta-fundo text-alerta'}`}
            >
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em]">Registrando agora</p>
                        <p className="titulo flex items-center gap-2 text-3xl uppercase">
                            {turno === 'init' ? <LogIn className="size-7" aria-hidden="true" /> : <LogOut className="size-7" aria-hidden="true" />}
                            {nomeTurno}
                        </p>
                    </div>
                    <div role="group" aria-label="Trocar o turno registrado" className="flex gap-2">
                        <Botao estilo={turno === 'init' ? 'principal' : 'contorno'} aria-pressed={turno === 'init'} onClick={() => trocarTurno('init')}>Entrada</Botao>
                        <Botao estilo={turno === 'end' ? 'principal' : 'contorno'} aria-pressed={turno === 'end'} onClick={() => trocarTurno('end')}>Saída</Botao>
                    </div>
                </div>
                <p className="text-sm">Toda presença dada ou retirada nesta tela vale para a <strong>{nomeTurno}</strong>. A tela só registra: a regra de frequência para certificado é definida pela comissão.</p>
            </section>

            <Secao titulo="Credenciamento" descricao={`Leia o QR da credencial ou busque a pessoa. Cada registro vale para a ${nomeTurno}.`}>
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
                titulo={`Lista de inscritos · ${nomeTurno}`}
                descricao={`${formatarNumero(filtrados.length)} de ${formatarNumero(lista.length)} pessoas${termo ? ' na busca' : ''}.`}
                acoes={<Atualizando ativo={atualizando} />}
            >
                <FiltroPresenca valor={filtro} aoMudar={setFiltro} rotulos={{ todos: 'Todos', ausentes: `Sem ${nomeTurno}`, presentes: `Com ${nomeTurno}` }} />
                {lista.length === 0 && <Estado tipo="vazio" titulo="Nenhum inscrito nesta palestra" texto="Quando houver congressistas com ingresso confirmado, eles aparecem aqui." />}
                {lista.length > 0 && filtrados.length === 0 && (
                    <Estado tipo="semResultado" acao={<Botao estilo="contorno" onClick={() => { setBusca(''); setFiltro('todos') }}>Limpar busca e filtro</Botao>} />
                )}
                {filtrados.length > 0 && (
                    <ListaChamada
                        rotulo={`Inscritos e presença de ${nomeTurno} na palestra`}
                        pessoas={filtrados}
                        classeTabela="[&_table]:min-w-[60rem]"
                        colunas={colunas}
                        extraNome={(u) => <MarcasPessoa u={u} />}
                        acoes={podeGerir ? (u) => {
                            const nome = displayUserName(u)
                            const ocupado = ocupados.has(u._id)
                            if (incertos.has(u._id)) {
                                return <Botao estilo="contorno" carregando={ocupado} onClick={() => void conferir(u, turno)} aria-label={`Conferir a situação de ${nome}`}>Conferir</Botao>
                            }
                            return ativo.has(u._id)
                                ? <Botao estilo="contorno" carregando={ocupado} onClick={() => void executar({ pessoa: u, quer: 'retirar', turno })} aria-label={`Retirar a ${nomeTurno} de ${nome}`}>Retirar {nomeTurno}</Botao>
                                : <Botao carregando={ocupado} onClick={() => void executar({ pessoa: u, quer: 'dar', turno })} aria-label={`Registrar a ${nomeTurno} de ${nome}`}>Registrar {nomeTurno}</Botao>
                        } : undefined}
                    />
                )}
            </Secao>
        </Pagina>
    )
}
