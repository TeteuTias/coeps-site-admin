"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
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
      <span className="titulo grid size-9 place-items-center rounded-xl bg-tinta text-lg text-white" aria-hidden="true">C</span>
      <span className="leading-tight">
        <span className="titulo block text-[17px]">CIEPS</span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-sutil">Admin</span>
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

  if (ehRotaDeImpressao(atual)) return null;

  const lista = (
    <nav aria-label="Navegação principal">
      <ul className="grid gap-0.5">
        {itens.map((item) => {
          const Icone = ICONES[item.icone];
          const ativo = itemAtivo(atual, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition-colors ${ativo ? "bg-tinta text-white" : "text-sutil hover:bg-recuo hover:text-tinta"}`}
              >
                <Icone className="size-[18px] shrink-0" aria-hidden="true" />
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const rodape = (
    <div className="grid gap-1 border-t border-linha pt-3">
      <p className="truncate px-3 text-sm font-medium" title={nome}>{nome}</p>
      {email && email !== nome && <p className="truncate px-3 text-xs text-sutil" title={email}>{email}</p>}
      {/* <a>, não <Link>: o prefetch do Link chamaria a saída sozinho */}
      <a href="/auth/logout" className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium text-sutil hover:bg-recuo hover:text-tinta">
        <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
        Sair
      </a>
    </div>
  );

  return (
    <>
      <aside data-nao-imprimir="" className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-linha bg-cartao p-4 lg:flex">
        <div className="grid content-start gap-5">
          <Link href="/" aria-label="CIEPS Admin, ir para o início" className="grid gap-3 px-3 pt-1">
            <Marca />
            <span className="regua" aria-hidden="true" />
          </Link>
          {lista}
        </div>
        {rodape}
      </aside>

      <header
        data-nao-imprimir=""
        className="sticky top-0 z-30 border-b border-linha bg-cartao/95 backdrop-blur lg:hidden"
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
            className="grid size-11 place-items-center rounded-full hover:bg-recuo"
          >
            {aberto ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
        <div className="regua" aria-hidden="true" />
        {aberto && (
          <div id="menu-mobile" className="aviso-entra absolute inset-x-0 top-full grid max-h-[calc(100dvh-4rem)] gap-3 overflow-y-auto border-b border-linha bg-cartao p-4 shadow-lg">
            {lista}
            {rodape}
          </div>
        )}
      </header>
    </>
  );
}
