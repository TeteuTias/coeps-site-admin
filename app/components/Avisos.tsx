"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { Dialogo } from "./Dialogo";

type Tom = "ok" | "erro" | "alerta" | "info";
interface AvisoItem { id: number; tom: Tom; titulo: string; texto?: string }

export interface OpcoesConfirmar {
  titulo: string;
  descricao?: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  /** Terceira opção; só `escolher` a devolve (`confirmar` a trata como "não"). */
  rotuloAlternativa?: string;
  perigo?: boolean;
  /** Texto a digitar para liberar a confirmação. */
  digitar?: string;
  conteudo?: ReactNode;
}

export type Escolha = "confirmar" | "alternativa" | "cancelar";

interface Avisos {
  /** Substitui `alert()`. Sucesso some sozinho; erro e alerta ficam até a pessoa fechar. */
  avisar: (tom: Tom, titulo: string, texto?: string) => void;
  /** Substitui `confirm()`: `if (!(await confirmar({ titulo: "Excluir?", perigo: true }))) return;` */
  confirmar: (opcoes: OpcoesConfirmar) => Promise<boolean>;
  /** Como `confirmar`, mas com a terceira opção `rotuloAlternativa`: devolve qual botão foi usado. */
  escolher: (opcoes: OpcoesConfirmar) => Promise<Escolha>;
}

const Contexto = createContext<Avisos | null>(null);

export function useAvisos(): Avisos {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAvisos precisa estar dentro de <AvisosProvider> (app/layout.tsx).");
  return ctx;
}

const ICONE = { ok: CircleCheck, erro: TriangleAlert, alerta: TriangleAlert, info: Info } as const;
const COR = {
  ok: "border-ok/25 bg-ok-fundo text-ok",
  erro: "border-erro/25 bg-erro-fundo text-erro",
  alerta: "border-alerta/25 bg-alerta-fundo text-alerta",
  info: "border-info/25 bg-info-fundo text-info",
} as const;

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoItem[]>([]);
  const [pendente, setPendente] = useState<{ opcoes: OpcoesConfirmar; resolver: (v: Escolha) => void } | null>(null);
  const proximo = useRef(1);

  const remover = useCallback((id: number) => setAvisos((l) => l.filter((a) => a.id !== id)), []);

  const avisar = useCallback<Avisos["avisar"]>((tom, titulo, texto) => {
    const id = proximo.current++;
    setAvisos((l) => [...l, { id, tom, titulo, texto }]);
    if (tom === "ok" || tom === "info") setTimeout(() => remover(id), 8000);
  }, [remover]);

  const escolher = useCallback<Avisos["escolher"]>((opcoes) => new Promise<Escolha>((resolver) => {
    // um pedido novo encerra o anterior como "cancelar"
    setPendente((atual) => { atual?.resolver("cancelar"); return { opcoes, resolver }; });
  }), []);
  const confirmar = useCallback<Avisos["confirmar"]>((opcoes) => escolher(opcoes).then((r) => r === "confirmar"), [escolher]);

  const responder = (valor: Escolha) => { pendente?.resolver(valor); setPendente(null); };
  const valor = useMemo(() => ({ avisar, confirmar, escolher }), [avisar, confirmar, escolher]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div aria-live="polite" data-nao-imprimir="" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 grid justify-items-end gap-2 sm:left-auto sm:right-6">
        {avisos.map((a) => {
          const Icone = ICONE[a.tom];
          return (
            <div key={a.id} role={a.tom === "erro" ? "alert" : "status"} className={`aviso-entra pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${COR[a.tom]}`}>
              <Icone className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.titulo}</p>
                {a.texto && <p className="mt-0.5 whitespace-pre-line break-words">{a.texto}</p>}
              </div>
              <button type="button" onClick={() => remover(a.id)} aria-label="Fechar aviso" className="-m-1.5 grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <Dialogo
        aberto={!!pendente}
        titulo={pendente?.opcoes.titulo ?? ""}
        descricao={pendente?.opcoes.descricao}
        rotuloConfirmar={pendente?.opcoes.rotuloConfirmar}
        rotuloCancelar={pendente?.opcoes.rotuloCancelar}
        perigo={pendente?.opcoes.perigo}
        digitar={pendente?.opcoes.digitar}
        rotuloAlternativa={pendente?.opcoes.rotuloAlternativa}
        onAlternativa={() => responder("alternativa")}
        onConfirmar={() => responder("confirmar")}
        onCancelar={() => responder("cancelar")}
      >
        {pendente?.opcoes.conteudo}
      </Dialogo>
    </Contexto.Provider>
  );
}
