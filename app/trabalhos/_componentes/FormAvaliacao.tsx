"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import { Area, Aviso, Botao, Campo } from "@/app/components/ui";
import { Esqueleto } from "@/app/components/Estado";
import type { IAcademicWorks } from "@/app/lib/types/academicWorks/academicWorks.t";
import { fichasDe } from "./registro";
import { textoDe, type Rascunho } from "./rascunhos";
import { ORDEM_AVALIACAO, SITUACOES, situacaoDe } from "./situacao";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false, loading: () => <Esqueleto className="h-48" /> });

const MODULOS = {
  toolbar: [[{ header: [1, 2, false] }], ["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"], ["clean"]],
};
// Os estilos do Quill não ficam em camada: só `!` vence a borda e a altura padrão dele.
const CLASSE_EDITOR = "overflow-hidden rounded-xl bg-cartao [&_.ql-editor]:min-h-40! [&_.ql-editor]:text-[15px] [&_.ql-toolbar]:bg-recuo/50";

/** Formulário de avaliação. O texto e as notas vêm e vão para o rascunho da página, nunca ficam só neste componente. */
export function FormAvaliacao({ trabalho, rascunho, aoMudar, aoEnviar }: {
  trabalho: IAcademicWorks;
  rascunho?: Rascunho;
  aoMudar: (patch: Partial<Rascunho>) => void;
  aoEnviar: () => Promise<boolean>;
}) {
  const nome = useId();
  const idParecer = useId();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atual = situacaoDe(trabalho.status);
  const escolhida = rascunho?.situacao ?? atual;
  const parecer = rascunho?.parecer ?? "";
  const pedeFicha = escolhida === "aceito" || escolhida === "recusado";
  const fichas = fichasDe(trabalho);

  const mudarFicha = (id: string, campo: "nota" | "justificativa", valor: string) =>
    aoMudar({ fichas: { ...rascunho?.fichas, [id]: { ...rascunho?.fichas?.[id], [campo]: valor } } });

  async function enviar() {
    if (!textoDe(parecer)) { setErro("Escreva o parecer antes de enviar."); return; }
    setErro(null);
    setEnviando(true);
    try {
      await aoEnviar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Nova situação do trabalho</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORDEM_AVALIACAO.map((id) => (
            <label key={id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-linha bg-cartao px-3.5 py-2 text-sm has-[:checked]:border-tinta has-[:checked]:bg-recuo">
              <input type="radio" name={nome} className="size-4 shrink-0" checked={escolhida === id} onChange={() => aoMudar({ situacao: id === atual ? undefined : id })} />
              <span>{SITUACOES[id].rotulo}{id === atual && <span className="block text-xs text-sutil">Situação atual</span>}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {pedeFicha && (
        <div className="grid gap-3">
          <h4 className="titulo text-base">Ficha de avaliação final</h4>
          {fichas.length === 0 && <p className="text-sm text-sutil">Esta modalidade não tem critérios de nota cadastrados.</p>}
          {fichas.map((item) => {
            const id = `${item._id}`;
            const d = rascunho?.fichas?.[id];
            return (
              <fieldset key={id} className="grid gap-3 rounded-xl border border-linha p-4 sm:grid-cols-[12rem_1fr]">
                <legend className="px-1 text-sm font-semibold">{item.nome}</legend>
                <Campo
                  rotulo="Nota"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={item.notaMinima}
                  max={item.notaMaxima}
                  ajuda={`Mínimo ${item.notaMinima} · máximo ${item.notaMaxima} · peso ${item.peso}`}
                  value={d?.nota ?? item.notasRecebidas?.[0] ?? ""}
                  onChange={(e) => mudarFicha(id, "nota", e.target.value)}
                />
                <Area
                  rotulo="Justificativa da nota"
                  rows={2}
                  value={d?.justificativa ?? item.justificativa?.[0] ?? ""}
                  onChange={(e) => mudarFicha(id, "justificativa", e.target.value)}
                />
              </fieldset>
            );
          })}
        </div>
      )}

      <div role="group" aria-labelledby={idParecer}>
        <p id={idParecer} className="mb-1.5 text-sm font-medium">Parecer descritivo</p>
        <div className={CLASSE_EDITOR}>
          <ReactQuill
            theme="snow"
            value={parecer}
            onChange={(v: string) => {
              // o editor devolve "<p><br></p>" ao montar ou esvaziar: não vira rascunho
              if (v === parecer || (!textoDe(parecer) && !textoDe(v))) return;
              aoMudar({ parecer: textoDe(v) ? v : undefined });
            }}
            modules={MODULOS}
            placeholder="Escreva seu parecer detalhado aqui..."
          />
        </div>
        <p className="mt-1 text-xs text-sutil">O texto fica guardado neste navegador até o envio, mesmo se você trocar de busca ou filtro.</p>
      </div>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div>
        <Botao type="submit" carregando={enviando}>{enviando ? "Enviando avaliação…" : "Enviar avaliação"}</Botao>
      </div>
    </form>
  );
}
