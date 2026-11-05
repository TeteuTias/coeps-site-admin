import type { ReactNode } from "react";

/** Subseção dentro de um cartão (h3), com borda leve. */
export function Bloco({ titulo, descricao, acoes, children }: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-xl border border-linha p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-sm text-sutil">{descricao}</p>}
        </div>
        {acoes}
      </div>
      {children}
    </div>
  );
}
