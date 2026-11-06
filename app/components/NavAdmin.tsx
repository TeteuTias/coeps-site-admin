"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ClipboardList, CreditCard, FileText, House, LogOut, Menu, UserCheck, Users, X } from "lucide-react";
import { ehRotaDeImpressao, itemAtivo, type IconeMenu, type ItemMenu } from "@/app/lib/menu-admin";

const ICONES: Record<IconeMenu, typeof House> = {
  inicio: House,
  usuarios: Users,
  trabalhos: FileText,
  listas: ClipboardList,
  presenca: UserCheck,
  financeiro: CreditCard,
  atividades: CalendarDays,
};

function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="titulo grid size-10 place-items-center rounded-lg bg-acao text-xl text-[#f4f1ea] ring-1 ring-white/25" aria-hidden="true">C</span>
      <span className="leading-tight">
        <span className="titulo block text-[19px] text-[#f4f1ea]">CIEPS Admin</span>
        <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#f4f1ea]/60">Painel administrativo</span>
      </span>
    </span>
  );
}

/** Barra lateral no computador; topo com menu aberto por botão no celular (todos os destinos ficam visíveis, sem rolagem lateral). */
export function NavAdmin({ itens, nome, email }: { itens: ItemMenu[]; nome: string; email: string }) {
  const atual = usePathname();
  // "aberto" é derivado da rota em que o menu foi aberto: ao navegar, fecha sozinho
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === atual;
  const botao = useRef<HTMLButtonElement>(null);
  // voltar ao mesmo caminho pelo histórico não pode reabrir o menu
  useEffect(() => { setAbertoEm(null); }, [atual]);

  if (ehRotaDeImpressao(atual)) return null;

  const lista = (
    <nav aria-label="Navegação principal">
      <p className="px-3 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#f4f1ea]/50" aria-hidden="true">Navegação</p>
      <ul className="grid gap-1.5">
        {itens.map((item) => {
          const Icone = ICONES[item.icone];
          const ativo = itemAtivo(atual, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                onClick={() => setAbertoEm(null)}
                className={`flex min-h-11 items-center gap-3 rounded-lg border px-2.5 py-1.5 text-[14px] font-bold transition-colors ${ativo ? "border-white/20 bg-moldura text-[#f4f1ea] shadow-[0_10px_24px_rgb(74_14_18/.5)]" : "border-transparent text-[#f4f1ea]/75 hover:border-white/10 hover:bg-white/10 hover:text-[#f4f1ea]"}`}
              >
                <span className={`grid size-8 shrink-0 place-items-center rounded-md border ${ativo ? "border-white/40 bg-white/10 text-[#f4f1ea]" : "border-white/10 bg-white/5 text-destaque"}`} aria-hidden="true">
                  <Icone className="size-[17px]" />
                </span>
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const rodape = (
    <div className="relative grid gap-1 border-t border-white/15 pt-3">
      <p className="truncate px-3 text-sm font-medium text-[#f4f1ea]" title={nome}>{nome}</p>
      {email && email !== nome && <p className="truncate px-3 text-xs text-[#f4f1ea]/60" title={email}>{email}</p>}
      {/* <a>, não <Link>: o prefetch do Link chamaria a saída sozinho */}
      <a href="/auth/logout" className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-bold text-[#f4f1ea]/75 hover:bg-white/10 hover:text-[#f4f1ea]">
        <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
        Sair
      </a>
    </div>
  );

  return (
    <>
      <aside data-nao-imprimir="" data-moldura="" className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-white/15 bg-lateral p-4 shadow-[16px_0_48px_rgb(26_26_26/.14)] lg:flex">
        {/* textura da barra: brilhos e hachura bem discretos */}
        <div className="pointer-events-none absolute inset-0 opacity-[.18] bg-[radial-gradient(circle_at_16%_9%,rgb(239_159_39/.75),transparent_8rem),radial-gradient(circle_at_90%_24%,rgb(24_95_165/.85),transparent_10rem),repeating-linear-gradient(135deg,rgb(244_241_234/.08)_0_1px,transparent_1px_22px)]" aria-hidden="true" />
        <div className="relative grid content-start gap-5">
          <Link href="/" aria-label="CIEPS Admin, ir para o início" className="grid gap-4 border-b border-white/15 px-1 pb-5 pt-1">
            <Marca />
          </Link>
          {lista}
        </div>
        {rodape}
      </aside>

      <header
        data-nao-imprimir=""
        data-moldura=""
        className="sticky top-0 z-30 border-b border-white/15 bg-lateral lg:hidden"
        onKeyDown={(e) => {
          if (e.key === "Escape" && aberto) { setAbertoEm(null); botao.current?.focus(); }
        }}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" aria-label="CIEPS Admin, ir para o início"><Marca /></Link>
          <button
            ref={botao}
            type="button"
            onClick={() => setAbertoEm(aberto ? null : atual)}
            aria-expanded={aberto}
            aria-controls="menu-mobile"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            className="grid size-11 place-items-center rounded-full text-white hover:bg-white/10"
          >
            {aberto ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
        <div className="regua" aria-hidden="true" />
        {aberto && (
          <div id="menu-mobile" className="aviso-entra absolute inset-x-0 top-full grid max-h-[calc(100dvh-4rem)] gap-3 overflow-y-auto border-t border-white/10 bg-lateral p-4 shadow-lg">
            {lista}
            {rodape}
          </div>
        )}
      </header>
    </>
  );
}
