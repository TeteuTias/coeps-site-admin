import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Cartão recolhido por padrão (<details>: teclado e leitor de tela funcionam sem código extra). Candidato a promoção para a fundação. */
export function Recolhivel({ titulo, resumo, selo, children }: { titulo: string; resumo?: ReactNode; selo?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-cartao shadow-[0_1px_0_var(--linha)] ring-1 ring-linha/60">
      <details className="[&[open]>summary_svg]:rotate-180">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <h2 className="titulo text-xl leading-snug">{titulo}</h2>
              {selo}
            </span>
            {resumo && <span className="mt-0.5 block text-sm text-sutil">{resumo}</span>}
          </span>
          <ChevronDown className="size-5 shrink-0 text-sutil transition-transform" aria-hidden="true" />
        </summary>
        <div className="grid gap-4 border-t border-linha px-5 py-5 sm:px-6">{children}</div>
      </details>
    </section>
  );
}
