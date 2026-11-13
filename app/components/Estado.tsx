import type { ReactNode } from "react";
import { FileSearch, Inbox, LoaderCircle, ShieldOff, TriangleAlert } from "lucide-react";
import { Botao } from "./ui";

// Uma família de estados para toda lista e painel:
//   carregando  · primeira carga (esqueleto)             vazio      · ainda não há nada
//   semResultado · há dados, o filtro não achou nada     erro       · falhou, com "Tentar de novo"
//   semPermissao · a conta não pode ver isto
// Ao atualizar ou salvar, o conteúdo FICA na tela: use <Atualizando /> e trave só o botão da ação.

export function Esqueleto({ className = "" }: { className?: string }) {
  return <div className={`esq ${className}`} aria-hidden="true" />;
}

type Tipo = "carregando" | "vazio" | "semResultado" | "erro" | "semPermissao";

const PADRAO: Record<Exclude<Tipo, "carregando">, { icone: typeof Inbox; titulo: string; texto?: string }> = {
  vazio: { icone: Inbox, titulo: "Nada por aqui ainda" },
  semResultado: { icone: FileSearch, titulo: "Nenhum resultado", texto: "Nenhum item corresponde à busca ou aos filtros. Ajuste-os ou limpe para ver tudo." },
  erro: { icone: TriangleAlert, titulo: "Não foi possível carregar", texto: "Verifique sua conexão e tente de novo." },
  semPermissao: { icone: ShieldOff, titulo: "Sem acesso a esta área", texto: "Sua conta não tem permissão para ver este conteúdo." },
};

export function Estado({ tipo, titulo, texto, acao, aoTentar, linhas = 3, className = "" }: {
  tipo: Tipo; titulo?: string; texto?: ReactNode; acao?: ReactNode; aoTentar?: () => void; linhas?: number; className?: string;
}) {
  if (tipo === "carregando") {
    return (
      <div role="status" aria-live="polite" className={`grid gap-3 ${className}`}>
        <span className="sr-only">{titulo ?? "Carregando…"}</span>
        {Array.from({ length: linhas }, (_, i) => <Esqueleto key={i} className="h-20" />)}
      </div>
    );
  }
  const p = PADRAO[tipo];
  const Icone = p.icone;
  const cor = tipo === "erro" ? "bg-erro-fundo text-erro" : "bg-recuo text-sutil";
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`grid justify-items-center gap-2 rounded-2xl border border-dashed border-linha bg-cartao px-6 py-12 text-center ${className}`}>
      <span className={`grid size-12 place-items-center rounded-full ${cor}`}><Icone className="size-6" aria-hidden="true" /></span>
      <p className="titulo text-lg">{titulo ?? p.titulo}</p>
      {(texto ?? p.texto) && <p className="max-w-md text-sm text-sutil">{texto ?? p.texto}</p>}
      {(acao || (tipo === "erro" && aoTentar)) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {tipo === "erro" && aoTentar && <Botao onClick={aoTentar}>Tentar de novo</Botao>}
          {acao}
        </div>
      )}
    </div>
  );
}

/** Indicador discreto de "atualizando", sem esconder o que já está na tela. */
export function Atualizando({ ativo, className = "" }: { ativo: boolean; className?: string }) {
  return (
    <p role="status" aria-live="polite" className={`flex h-5 items-center gap-1.5 text-xs text-sutil ${className}`}>
      {ativo && <><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Atualizando…</>}
    </p>
  );
}
