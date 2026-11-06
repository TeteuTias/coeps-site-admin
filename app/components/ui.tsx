import Link from "next/link";
import { useId } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";

// Peças do painel. Ação principal em pílula de tinta, as demais em contorno; cartões claros sobre o papel.
// Toda cor vem de token (app/globals.css), então um tema escuro depois não pede mexer aqui.

// Dentro da faixa escura do Cabecalho ([data-faixa]) o principal inverte para branco e o contorno vira vidro.
// As classes com variante ficam escritas por inteiro: o Tailwind só enxerga o que aparece literal no código.
const BOTAO = {
  principal: "bg-tinta text-white hover:bg-black [[data-faixa]_&]:bg-white [[data-faixa]_&]:text-tinta [[data-faixa]_&]:hover:bg-recuo",
  contorno: "border border-linha bg-cartao text-tinta hover:border-tinta/40 [[data-faixa]_&]:border-white/25 [[data-faixa]_&]:bg-white/10 [[data-faixa]_&]:text-white [[data-faixa]_&]:hover:bg-white/20 [[data-faixa]_&]:hover:border-white/40",
  fantasma: "text-tinta hover:bg-recuo [[data-faixa]_&]:text-white [[data-faixa]_&]:hover:bg-white/10",
  perigo: "border border-erro/30 bg-cartao text-erro hover:bg-erro-fundo",
  perigoSolido: "bg-erro text-white hover:bg-[#8c1f15]",
} as const;
const TAMANHO = {
  normal: "min-h-11 px-5 text-sm",
  pequeno: "min-h-9 px-3.5 text-[13px]",
} as const;
export type EstiloBotao = keyof typeof BOTAO;
export type TamanhoBotao = keyof typeof TAMANHO;

export const classeBotao = (estilo: EstiloBotao = "principal", extra = "", tamanho: TamanhoBotao = "normal") =>
  `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background,border-color,transform] duration-200 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ${TAMANHO[tamanho]} ${BOTAO[estilo]} ${extra}`;

type PropsBotao = ComponentProps<"button"> & { estilo?: EstiloBotao; tamanho?: TamanhoBotao; carregando?: boolean };

/** Botão. `carregando` trava o clique, mostra o indicador e avisa o leitor de tela; o resto da tela continua utilizável. */
export function Botao({ estilo, tamanho, carregando, className = "", children, disabled, type = "button", ...p }: PropsBotao) {
  return (
    <button {...p} type={type} disabled={disabled || carregando} aria-busy={carregando || undefined} className={classeBotao(estilo, className, tamanho)}>
      {carregando && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function BotaoLink({ estilo, tamanho, className, ...p }: ComponentProps<typeof Link> & { estilo?: EstiloBotao; tamanho?: TamanhoBotao }) {
  return <Link {...p} className={classeBotao(estilo, className, tamanho)} />;
}

export function Pagina({ largura = "normal", className = "", children, ...p }: ComponentProps<"main"> & { largura?: "estreita" | "normal" | "ampla" }) {
  // "normal" e "ampla" têm a mesma largura: o conteúdo não muda de tamanho de uma tela para outra
  const max = { estreita: "max-w-3xl", normal: "max-w-[1400px]", ampla: "max-w-[1400px]" }[largura];
  return (
    <main {...p} className={`mx-auto grid w-full content-start gap-6 px-4 py-6 sm:px-8 sm:py-10 ${max} ${className}`}>
      {children}
    </main>
  );
}

// Brilho suave no canto da faixa: cada área tem o seu acento CIEPS
const ACENTO = { vermelho: "#e5534b", azul: "#3b82d6", ouro: "#ef9f27" } as const;
export type AcentoFaixa = keyof typeof ACENTO;

/** Faixa escura do topo da página: título, ações e, como filhos, as métricas da tela (que ficam em vidro sobre o azul-noite). */
export function Cabecalho({ titulo, sub, etiqueta, acoes, voltar, acento = "ouro", children }: {
  titulo: ReactNode; sub?: ReactNode; etiqueta?: string; acoes?: ReactNode; voltar?: { href: string; rotulo: string };
  acento?: AcentoFaixa; children?: ReactNode;
}) {
  return (
    <header
      data-faixa=""
      style={{ "--brilho": ACENTO[acento] } as CSSProperties}
      className="relative grid gap-5 overflow-hidden rounded-3xl bg-moldura p-5 text-moldura-texto shadow-[0_12px_32px_-16px_rgb(15_30_51/.7)] sm:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_120%_at_100%_0%,color-mix(in_srgb,var(--brilho)_30%,transparent),transparent)]" aria-hidden="true" />
      <div className="relative grid gap-3">
        {voltar && (
          <Link href={voltar.href} className="inline-flex w-fit items-center gap-1.5 text-sm text-moldura-sutil hover:text-white">
            <ArrowLeft className="size-4" aria-hidden="true" />{voltar.rotulo}
          </Link>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {etiqueta && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-destaque">{etiqueta}</p>}
            <h1 className="titulo text-[clamp(1.7rem,3.6vw,2.4rem)] leading-tight text-white">{titulo}</h1>
            {sub && <p className="mt-1.5 max-w-3xl text-[15px] text-moldura-sutil">{sub}</p>}
          </div>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
        <div className="regua w-24" aria-hidden="true" />
      </div>
      {children && <div className="relative">{children}</div>}
    </header>
  );
}

export function Cartao({ className = "", children, ...p }: ComponentProps<"section">) {
  return <section {...p} className={`rounded-2xl border border-linha bg-cartao p-5 shadow-[0_1px_2px_rgb(26_20_10/.06),0_10px_24px_-14px_rgb(26_20_10/.28)] sm:p-6 ${className}`}>{children}</section>;
}

/** Cartão com título de seção (h2). */
export function Secao({ titulo, descricao, acoes, className = "", children, ...p }: Omit<ComponentProps<"section">, "title"> & {
  titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode;
}) {
  const id = useId();
  return (
    <Cartao {...p} aria-labelledby={id} className={`grid gap-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="titulo text-xl leading-snug">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-sutil">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
      {children}
    </Cartao>
  );
}

const SELO = {
  neutro: "bg-recuo text-tinta",
  ok: "bg-ok-fundo text-ok",
  alerta: "bg-alerta-fundo text-alerta",
  erro: "bg-erro-fundo text-erro",
  info: "bg-info-fundo text-info",
  escuro: "bg-tinta text-white",
} as const;
export type TomSelo = keyof typeof SELO;

/** Situação curta (pago, pendente, suspenso…). Sempre com texto: a cor sozinha não basta. */
export function Selo({ tom = "neutro", children }: { tom?: TomSelo; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SELO[tom]}`}>{children}</span>;
}

export function Aviso({ tom = "neutro", titulo, children }: { tom?: "neutro" | "ok" | "alerta" | "erro" | "info"; titulo?: string; children?: ReactNode }) {
  const cor = {
    neutro: "border-linha bg-cartao",
    ok: "border-ok/20 bg-ok-fundo text-ok",
    alerta: "border-alerta/20 bg-alerta-fundo text-alerta",
    erro: "border-erro/20 bg-erro-fundo text-erro",
    info: "border-info/20 bg-info-fundo text-info",
  }[tom];
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${cor}`}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className={titulo ? "mt-0.5" : ""}>{children}</div>}
    </div>
  );
}

/** Número de destaque. Sem valor (`null`/`undefined`) mostra "Indisponível": nunca um zero que parece dado. */
export function Metrica({ rotulo, valor, detalhe, className = "" }: { rotulo: string; valor?: ReactNode | null; detalhe?: ReactNode; className?: string }) {
  const semValor = valor === null || valor === undefined;
  return (
    <div className={`rounded-2xl border border-linha bg-cartao p-4 shadow-[0_1px_2px_rgb(26_20_10/.06)] [[data-faixa]_&]:border-white/15 [[data-faixa]_&]:bg-white/[.08] [[data-faixa]_&]:shadow-none ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-sutil [[data-faixa]_&]:text-moldura-sutil">{rotulo}</p>
      <p className={`num mt-1 ${semValor ? "text-base italic text-sutil [[data-faixa]_&]:text-moldura-sutil" : "titulo text-3xl leading-none [[data-faixa]_&]:text-white"}`}>{semValor ? "Indisponível" : valor}</p>
      {detalhe && <p className="mt-1.5 text-xs text-sutil [[data-faixa]_&]:text-moldura-sutil">{detalhe}</p>}
    </div>
  );
}

type CampoBase = { rotulo: string; erro?: string; ajuda?: ReactNode; className?: string };
const CAMPO = "mt-1.5 block w-full rounded-xl border border-linha bg-cartao px-3.5 py-2.5 text-[15px] transition-colors placeholder:text-sutil/70 focus:border-tinta aria-[invalid=true]:border-erro disabled:opacity-60";

function Dica({ id, erro, ajuda }: { id: string; erro?: string; ajuda?: ReactNode }) {
  if (erro) return <p id={`${id}-erro`} className="mt-1 text-sm text-erro">{erro}</p>;
  if (ajuda) return <p id={`${id}-ajuda`} className="mt-1 text-xs text-sutil">{ajuda}</p>;
  return null;
}
const descrito = (id: string, erro?: string, ajuda?: ReactNode) => (erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined);

export function Campo({ rotulo, erro, ajuda, className = "", ...input }: CampoBase & Omit<ComponentProps<"input">, "className">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <input id={id} aria-invalid={erro ? true : undefined} aria-describedby={descrito(id, erro, ajuda)} className={CAMPO} {...input} />
      <Dica id={id} erro={erro} ajuda={ajuda} />
    </div>
  );
}

export function Area({ rotulo, erro, ajuda, className = "", ...area }: CampoBase & Omit<ComponentProps<"textarea">, "className">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <textarea id={id} aria-invalid={erro ? true : undefined} aria-describedby={descrito(id, erro, ajuda)} className={`${CAMPO} min-h-28`} {...area} />
      <Dica id={id} erro={erro} ajuda={ajuda} />
    </div>
  );
}

export function Escolha({ rotulo, erro, ajuda, className = "", children, ...sel }: CampoBase & Omit<ComponentProps<"select">, "className">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <select id={id} aria-invalid={erro ? true : undefined} aria-describedby={descrito(id, erro, ajuda)} className={`${CAMPO} pr-8`} {...sel}>{children}</select>
      <Dica id={id} erro={erro} ajuda={ajuda} />
    </div>
  );
}

/** Busca com ícone. O rótulo existe para o leitor de tela mesmo quando `rotuloOculto`. */
export function CampoBusca({ rotulo, rotuloOculto = true, className = "", ...input }: { rotulo: string; rotuloOculto?: boolean; className?: string } & Omit<ComponentProps<"input">, "className" | "type">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={rotuloOculto ? "sr-only" : "text-sm font-medium"}>{rotulo}</label>
      <div className={`relative ${rotuloOculto ? "" : "mt-1.5"}`}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-sutil" aria-hidden="true" />
        <input id={id} type="search" autoComplete="off" className="block min-h-11 w-full rounded-xl border border-linha bg-cartao py-2.5 pl-10 pr-3.5 text-[15px] placeholder:text-sutil/70 focus:border-tinta" {...input} />
      </div>
    </div>
  );
}

/** Caixa de marcar com texto clicável. */
export function Caixa({ rotulo, ajuda, className = "", ...input }: { rotulo: ReactNode; ajuda?: ReactNode; className?: string } & Omit<ComponentProps<"input">, "className" | "type">) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-linha bg-cartao px-3.5 py-2.5 text-sm has-[:checked]:border-tinta ${className}`}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0" {...input} />
      <span><span className="font-medium">{rotulo}</span>{ajuda && <span className="block text-xs text-sutil">{ajuda}</span>}</span>
    </label>
  );
}

export const classeTh = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sutil whitespace-nowrap";
export const classeTd = "px-4 py-3 align-middle";

/** Tabela com rolagem interna e foco por teclado: a página nunca ganha rolagem horizontal. */
export function TabelaRolavel({ rotulo, className = "", children }: { rotulo: string; className?: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={rotulo} tabIndex={0} className={`overflow-x-auto rounded-2xl border border-linha bg-cartao shadow-[0_1px_2px_rgb(26_20_10/.06)] ${className}`}>
      <table className="w-full min-w-[40rem] border-collapse text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-linha [&_tbody_tr:nth-child(even)]:bg-recuo/50 [&_thead_tr]:bg-recuo">{children}</table>
    </div>
  );
}

/** Paginação controlada: "1–50 de 663" e Anterior/Próxima. Some quando tudo cabe numa página. */
export function Paginacao({ pagina, total, porPagina, aoMudar, rotulo = "itens", className = "" }: {
  pagina: number; total: number; porPagina: number; aoMudar: (pagina: number) => void; rotulo?: string; className?: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const atual = Math.min(Math.max(pagina, 1), paginas);
  const de = (atual - 1) * porPagina + 1;
  const ate = Math.min(atual * porPagina, total);
  return (
    <nav aria-label="Paginação" className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="num text-sm text-sutil">{de}–{ate} de {total} {rotulo}</p>
      <div className="flex items-center gap-2">
        <Botao estilo="contorno" tamanho="pequeno" disabled={atual <= 1} onClick={() => aoMudar(atual - 1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />Anterior
        </Botao>
        <span className="num px-1 text-sm text-sutil" aria-current="page">Página {atual} de {paginas}</span>
        <Botao estilo="contorno" tamanho="pequeno" disabled={atual >= paginas} onClick={() => aoMudar(atual + 1)}>
          Próxima<ChevronRight className="size-4" aria-hidden="true" />
        </Botao>
      </div>
    </nav>
  );
}
