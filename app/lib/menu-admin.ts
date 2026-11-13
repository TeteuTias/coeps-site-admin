// Destinos do painel. Constantes puras: a barra lateral (cliente) e a página inicial (servidor) usam a mesma lista.
// Quem pode abrir cada um é decidido no servidor por checkUserPermission (menu-admin-servidor.ts).

export type IconeMenu = "inicio" | "usuarios" | "trabalhos" | "listas" | "presenca" | "financeiro" | "atividades";

export interface ItemMenu {
  href: string;
  rotulo: string;
  icone: IconeMenu;
  descricao: string;
}

export const ITENS_MENU: ItemMenu[] = [
  { href: "/", rotulo: "Início", icone: "inicio", descricao: "Atalhos para o que você pode fazer." },
  { href: "/usuarios", rotulo: "Usuários", icone: "usuarios", descricao: "Consulte congressistas, perfis, status de cadastro e inscrições." },
  { href: "/trabalhos", rotulo: "Trabalhos", icone: "trabalhos", descricao: "Acompanhe submissões, pareceres, arquivos e status de avaliação." },
  { href: "/listas", rotulo: "Listas", icone: "listas", descricao: "Gere listas de participantes por atividade, minicurso ou palestra." },
  { href: "/presenca", rotulo: "Presença", icone: "presenca", descricao: "Controle listas de presença e rotinas de conferência do evento." },
  { href: "/financeiro", rotulo: "Financeiro", icone: "financeiro", descricao: "Revise pagamentos, parcelamentos e configurações de inscrição." },
  { href: "/gerenciarMinicursos", rotulo: "Atividades", icone: "atividades", descricao: "Configure minicursos, vagas, cronogramas e visibilidade pública." },
];

/** Páginas de impressão A4: sem barra lateral. */
export const ROTAS_IMPRESSAO = ["/gerarListaMinicurso/", "/gerarListaPalestras"];

export function ehRotaDeImpressao(pathname: string) {
  return ROTAS_IMPRESSAO.some((r) => pathname.startsWith(r));
}

export function itemAtivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
