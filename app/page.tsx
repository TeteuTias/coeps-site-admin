import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardList, CreditCard, FileText, UserCheck, Users } from "lucide-react";
import { Aviso, Cabecalho, Pagina } from "@/app/components/ui";
import { menuDaSessao } from "@/app/lib/menu-admin-servidor";
import type { IconeMenu } from "@/app/lib/menu-admin";

const ICONES: Record<Exclude<IconeMenu, "inicio">, typeof Users> = {
  usuarios: Users,
  trabalhos: FileText,
  listas: ClipboardList,
  presenca: UserCheck,
  financeiro: CreditCard,
  atividades: CalendarDays,
};

// Cor de cada área: ladrilho do ícone e brilho da faixa das telas. Texto sempre ≥ 4,5:1 sobre o ladrilho.
const LADRILHO: Record<Exclude<IconeMenu, "inicio">, string> = {
  usuarios: "bg-info text-white",
  listas: "bg-info text-white",
  trabalhos: "bg-acao text-white",
  atividades: "bg-acao text-white",
  presenca: "bg-destaque text-tinta",
  financeiro: "bg-destaque text-tinta",
};

export default async function Page() {
  // só os destinos que a conta pode abrir (mesma regra do proxy)
  const menu = await menuDaSessao();
  const destinos = (menu?.itens ?? []).filter((i) => i.icone !== "inicio");

  return (
    <Pagina>
      <Cabecalho
        etiqueta="Administração"
        titulo="Início"
        sub="Escolha o que você vai fazer agora. Aparecem só as áreas liberadas para a sua conta."
      />

      {destinos.length === 0 ? (
        <Aviso tom="alerta" titulo="Nenhuma área liberada">
          Sua conta entrou, mas ainda não tem acesso a nenhuma área do painel. Peça a revisão do perfil ao responsável pelo sistema.
        </Aviso>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {destinos.map((item) => {
            const Icone = ICONES[item.icone as Exclude<IconeMenu, "inicio">];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex h-full min-h-40 flex-col justify-between gap-6 rounded-2xl border border-linha bg-cartao p-5 shadow-[0_1px_2px_rgb(26_20_10/.06),0_10px_24px_-14px_rgb(26_20_10/.28)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-moldura hover:shadow-[0_16px_32px_-16px_rgb(15_30_51/.5)] sm:p-6"
                >
                  <div className="flex items-start justify-between">
                    <span className={`grid size-12 place-items-center rounded-2xl ${LADRILHO[item.icone as Exclude<IconeMenu, "inicio">]}`}>
                      <Icone className="size-5" aria-hidden="true" />
                    </span>
                    <ArrowUpRight className="size-5 text-sutil transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="titulo text-xl">{item.rotulo}</h2>
                    <p className="mt-1 text-sm text-sutil">{item.descricao}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Pagina>
  );
}
