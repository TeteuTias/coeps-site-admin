"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Texto técnico (ID, código, resposta de integração) com botão de copiar, para a pessoa levar ao suporte. */
export function Copiavel({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem permissão de área de transferência: o texto continua selecionável na tela
    }
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <code className="num min-w-0 select-all break-all rounded bg-recuo px-1.5 py-0.5 text-xs">{texto}</code>
      <button type="button" onClick={() => void copiar()} aria-label={`Copiar ${rotulo}`} className="grid size-8 shrink-0 place-items-center rounded-full text-sutil hover:bg-recuo hover:text-tinta">
        {copiado ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">{copiado ? `${rotulo} copiado` : ""}</span>
    </span>
  );
}
