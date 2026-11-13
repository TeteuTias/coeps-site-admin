import Link from "next/link";
import { Ban, House, LogOut } from "lucide-react";
import { Cartao, classeBotao } from "@/app/components/ui";
import { menuDaSessao } from "@/app/lib/menu-admin-servidor";

export default async function NotAllowedPage() {
  const menu = await menuDaSessao();

  return (
    <main className="mx-auto grid min-h-[70dvh] w-full max-w-3xl content-center px-4 py-6 sm:px-8 sm:py-10">
      <Cartao aria-labelledby="acesso-negado" className="grid justify-items-start gap-4 sm:p-8">
        <span className="grid size-12 place-items-center rounded-full bg-erro-fundo text-erro">
          <Ban className="size-6" aria-hidden="true" />
        </span>
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sutil">Erro 403</p>
          <h1 id="acesso-negado" className="titulo text-[clamp(1.7rem,3.6vw,2.4rem)] leading-tight">Acesso negado</h1>
          <div className="regua w-24" aria-hidden="true" />
        </div>
        <p className="text-[15px] text-sutil">
          Sua conta{menu?.email ? <> (<strong className="font-semibold text-tinta">{menu.email}</strong>)</> : null} não tem permissão para abrir esta área do painel.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={classeBotao("principal")}><House className="size-4" aria-hidden="true" />Voltar ao início</Link>
          {/* <a>, não <Link>: o prefetch do Link chamaria a saída sozinho */}
          <a href="/auth/logout" className={classeBotao("contorno")}><LogOut className="size-4" aria-hidden="true" />Entrar com outra conta</a>
        </div>
        <p className="text-sm text-sutil">Se isso parece um engano, peça a revisão do seu perfil ao responsável pelo sistema.</p>
      </Cartao>
    </main>
  );
}
