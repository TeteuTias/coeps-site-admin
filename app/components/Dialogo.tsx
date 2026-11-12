"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Botao } from "./ui";

export interface PropsDialogo {
  aberto: boolean;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  /** Terceira opção, entre "Cancelar" e "Confirmar" (ex.: "Cancelar sem estorno"). */
  rotuloAlternativa?: string;
  onAlternativa?: () => void;
  /** Ação destrutiva: o foco começa em "Cancelar" e o botão de confirmar fica vermelho. */
  perigo?: boolean;
  /** Pedido em andamento: trava os botões, o Escape e o clique no fundo. */
  ocupado?: boolean;
  /** Texto exato que a pessoa precisa digitar para liberar a confirmação (operações coletivas). */
  digitar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Diálogo modal sobre <dialog>.showModal(): o navegador deixa o fundo inerte, contém o Tab, trata o Escape e devolve
 * o foco a quem abriu. Aqui entram só o que ele não faz: foco inicial conforme o risco, confirmação digitada,
 * trava durante o envio e rolagem da página parada.
 */
export function Dialogo(props: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null);
  const { aberto, ocupado, onCancelar } = props;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-foco-inicial]")?.focus();
    } else if (!aberto && d.open) {
      d.close();
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = anterior; };
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      className="dialogo m-auto w-[min(92vw,32rem)] rounded-2xl border-0 bg-cartao p-0 text-tinta shadow-2xl"
      onCancel={(e) => { e.preventDefault(); if (!ocupado) onCancelar(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !ocupado) onCancelar(); }}
    >
      {aberto && <Conteudo {...props} />}
    </dialog>
  );
}

function Conteudo({ titulo, descricao, children, rotuloConfirmar = "Confirmar", rotuloCancelar = "Cancelar", rotuloAlternativa, onAlternativa, perigo, ocupado, digitar, onConfirmar, onCancelar }: PropsDialogo) {
  const idTitulo = useId();
  const idDescricao = useId();
  const idDigitar = useId();
  const [texto, setTexto] = useState("");
  const liberado = !digitar || texto.trim() === digitar;

  return (
    <form
      method="dialog"
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      aria-busy={ocupado || undefined}
      className="grid gap-4 p-6"
      onSubmit={(e) => { e.preventDefault(); if (liberado && !ocupado) onConfirmar(); }}
    >
      <h2 id={idTitulo} className="titulo text-xl leading-snug">{titulo}</h2>
      {descricao && <div id={idDescricao} className="text-[15px] text-sutil">{descricao}</div>}
      {children}
      {digitar && (
        <div>
          <label htmlFor={idDigitar} className="text-sm font-medium">
            Para continuar, digite <strong className="num select-all rounded bg-recuo px-1.5 py-0.5">{digitar}</strong>
          </label>
          <input
            id={idDigitar}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            data-foco-inicial=""
            autoComplete="off"
            className="mt-1.5 block w-full rounded-xl border border-linha bg-cartao px-3.5 py-2.5 text-[15px] focus:border-tinta"
          />
        </div>
      )}
      <div className="mt-1 flex flex-wrap justify-end gap-2">
        <Botao estilo="contorno" disabled={ocupado} onClick={onCancelar} {...(perigo && !digitar ? { "data-foco-inicial": "" } : {})}>
          {rotuloCancelar}
        </Botao>
        {rotuloAlternativa && onAlternativa && (
          <Botao estilo={perigo ? "perigo" : "contorno"} disabled={ocupado || !liberado} onClick={onAlternativa}>{rotuloAlternativa}</Botao>
        )}
        <Botao type="submit" estilo={perigo ? "perigoSolido" : "principal"} carregando={ocupado} disabled={!liberado} {...(!perigo && !digitar ? { "data-foco-inicial": "" } : {})}>
          {rotuloConfirmar}
        </Botao>
      </div>
    </form>
  );
}
