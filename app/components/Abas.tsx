"use client";

import type { KeyboardEvent } from "react";

export interface AbaItem { id: string; rotulo: string; perigo?: boolean }

/** id do botão e do painel de cada aba: o painel usa `aria-labelledby={idAba(id)}`. */
export const idAba = (id: string) => `aba-${id}`;
export const idPainel = (id: string) => `painel-${id}`;

/** Abas com teclado completo (setas, Home, End). O painel de cada aba é de quem usa: marque-o com role="tabpanel", id={idPainel(id)} e `hidden` quando inativo. */
export function Abas({ rotulo, abas, ativa, aoMudar }: { rotulo: string; abas: AbaItem[]; ativa: string; aoMudar: (id: string) => void }) {
  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    const i = abas.findIndex((a) => a.id === ativa);
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const proxima = abas[(destino + abas.length) % abas.length];
    aoMudar(proxima.id);
    document.getElementById(idAba(proxima.id))?.focus();
  }

  return (
    <div role="tablist" aria-label={rotulo} onKeyDown={teclas} className="flex gap-1 overflow-x-auto rounded-2xl border border-linha bg-cartao p-1 shadow-[0_1px_2px_rgb(26_20_10/.06)]">
      {abas.map((a) => {
        const sel = a.id === ativa;
        return (
          <button
            key={a.id}
            id={idAba(a.id)}
            role="tab"
            type="button"
            aria-selected={sel}
            aria-controls={idPainel(a.id)}
            tabIndex={sel ? 0 : -1}
            onClick={() => aoMudar(a.id)}
            className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors ${
              sel ? "bg-moldura text-white" : a.perigo ? "text-erro hover:bg-erro-fundo" : "text-sutil hover:bg-recuo hover:text-tinta"
            }`}
          >
            {a.rotulo}
          </button>
        );
      })}
    </div>
  );
}
