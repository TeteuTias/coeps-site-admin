"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface Carga<T> {
    dados: T | null
    erro: string | null
    /** Primeira carga, ainda sem nada para mostrar. */
    carregando: boolean
    /** Recarga com dados já na tela: o conteúdo fica, só o indicador aparece. */
    atualizando: boolean
    recarregar: () => Promise<void>
}

/** Carga independente de uma seção: falha numa seção não derruba as outras, e recarregar mantém a última versão válida. */
export function useCarga<T>(carregar: () => Promise<T>): Carga<T> {
    const funcao = useRef(carregar)
    useEffect(() => { funcao.current = carregar })
    const ordem = useRef(0)
    const [estado, setEstado] = useState<{ dados: T | null; erro: string | null; carregando: boolean; atualizando: boolean }>({
        dados: null, erro: null, carregando: true, atualizando: false,
    })

    const recarregar = useCallback(async () => {
        const minha = ++ordem.current
        setEstado((a) => ({ ...a, erro: null, atualizando: a.dados !== null }))
        try {
            const dados = await funcao.current()
            if (minha === ordem.current) setEstado({ dados, erro: null, carregando: false, atualizando: false })
        } catch (error) {
            if (minha === ordem.current) {
                setEstado((a) => ({
                    ...a,
                    erro: error instanceof Error ? error.message : "Não foi possível carregar.",
                    carregando: false,
                    atualizando: false,
                }))
            }
        }
    }, [])

    useEffect(() => {
        void recarregar()
        // invalida a resposta em voo ao desmontar: o contador precisa ser o valor atual, não o de quando o efeito rodou
        // eslint-disable-next-line react-hooks/exhaustive-deps
        return () => { ordem.current++ }
    }, [recarregar])

    return { ...estado, recarregar }
}

export interface RespostaJson { ok: boolean; status: number; corpo: unknown }

const SEM_RESPOSTA = "Sem resposta do servidor. Confira sua conexão e recarregue a ficha antes de repetir."

export async function pedirJson(url: string, init?: RequestInit): Promise<RespostaJson> {
    let resposta: Response
    try {
        resposta = await fetch(url, init)
    } catch {
        throw new Error(SEM_RESPOSTA)
    }
    return { ok: resposta.ok, status: resposta.status, corpo: await resposta.json().catch(() => null) }
}

/** PUT com corpo JSON. Em falha de rede o resultado da gravação é desconhecido, então a mensagem manda conferir antes de repetir. */
export async function enviarPut(url: string, corpo: unknown): Promise<void> {
    let resposta: RespostaJson
    try {
        resposta = await pedirJson(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
    } catch {
        throw new Error("Sem resposta do servidor: a alteração pode ou não ter sido gravada. Recarregue a ficha e confira antes de repetir.")
    }
    if (!resposta.ok) throw new Error(mensagemDe(resposta.corpo) ?? "Não foi possível concluir a operação.")
}

export function mensagemDe(corpo: unknown): string | null {
    return typeof corpo === "object" && corpo !== null && "message" in corpo && typeof corpo.message === "string" ? corpo.message : null
}
