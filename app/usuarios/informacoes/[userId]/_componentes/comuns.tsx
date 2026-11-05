import type { ReactNode } from "react"
import { Copiavel } from "@/app/components/Copiavel"
import { Aviso, Botao } from "@/app/components/ui"
import { Atualizando, Estado } from "@/app/components/Estado"
import type { Carga } from "./carga"

export function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-semibold text-sutil">{rotulo}</dt>
            <dd className="mt-0.5 text-sm break-words">{children}</dd>
        </div>
    )
}

/** Linha de código técnico com botão de copiar; sem valor mostra texto, nunca um traço mudo. */
export function Codigo({ rotulo, texto }: { rotulo: string; texto: string | null | undefined }) {
    return (
        <div className="grid gap-1 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <span className="text-xs font-semibold text-sutil">{rotulo}</span>
            {texto ? <Copiavel texto={texto} rotulo={rotulo} /> : <span className="text-sutil">Não informado</span>}
        </div>
    )
}

/** Expansão para detalhe técnico (códigos para levar ao suporte). `<details>` já anuncia aberto/fechado. */
export function Tecnico({ titulo = "Códigos técnicos (para o suporte)", children }: { titulo?: string; children: ReactNode }) {
    return (
        <details className="rounded-xl bg-recuo/60 px-4 py-2.5 text-sm">
            <summary className="min-h-9 cursor-pointer py-1.5 font-medium">{titulo}</summary>
            <div className="mt-2 grid gap-2 pb-1">{children}</div>
        </details>
    )
}

/** Corpo padrão de uma seção que depende de uma carga: esqueleto, erro com nova tentativa, ou o conteúdo (mantido se uma recarga falhar). */
export function CorpoCarga<T>({ carga, titulo, linhas = 2, children }: {
    carga: Carga<T>; titulo: string; linhas?: number; children: (dados: T) => ReactNode
}) {
    if (carga.dados === null) {
        if (carga.carregando) return <Estado tipo="carregando" titulo={titulo} linhas={linhas} />
        return <Estado tipo="erro" titulo={`Não foi possível carregar: ${titulo.toLowerCase()}`} texto={carga.erro ?? undefined} aoTentar={() => void carga.recarregar()} />
    }
    return (
        <>
            <Atualizando ativo={carga.atualizando} />
            {carga.erro && (
                <Aviso tom="erro" titulo="Não foi possível atualizar. Mostrando a última versão carregada.">
                    <p>{carga.erro}</p>
                    <Botao tamanho="pequeno" estilo="contorno" className="mt-2" onClick={() => void carga.recarregar()}>Tentar de novo</Botao>
                </Aviso>
            )}
            {children(carga.dados)}
        </>
    )
}

export function capitalizar(texto: string): string {
    const t = texto.replaceAll("_", " ").toLowerCase()
    return t.charAt(0).toUpperCase() + t.slice(1)
}
