import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Cartão recolhido por padrão (<details>: teclado e leitor de tela funcionam sem código extra). `perigo` pinta a zona de risco de vermelho. */
export function Recolhivel({ titulo, resumo, selo, perigo = false, children }: { titulo: string; resumo?: ReactNode; selo?: ReactNode; perigo?: boolean; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border shadow-[0_1px_2px_rgb(26_20_10/.06),0_10px_24px_-14px_rgb(26_20_10/.28)] ${perigo ? "border-erro/40 bg-erro-fundo" : "border-linha bg-cartao"}`}>
      <details className="[&[open]>summary_svg]:rotate-180">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <h2 className={`titulo text-xl leading-snug ${perigo ? "text-erro" : ""}`}>{titulo}</h2>
              {selo}
            </span>
            {resumo && <span className={`mt-0.5 block text-sm ${perigo ? "text-erro/80" : "text-sutil"}`}>{resumo}</span>}
          </span>
          <ChevronDown className={`size-5 shrink-0 transition-transform ${perigo ? "text-erro" : "text-sutil"}`} aria-hidden="true" />
        </summary>
        <div className={`grid gap-4 border-t px-5 py-5 sm:px-6 ${perigo ? "border-erro/30 bg-cartao rounded-b-2xl" : "border-linha"}`}>{children}</div>
      </details>
    </section>
  );
}
