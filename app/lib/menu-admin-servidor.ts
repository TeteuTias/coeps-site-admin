import { connection } from "next/server";
import { getSession } from "@/app/lib/auth0";
import checkUserPermission from "@/app/lib/user/userPermissionsServerSide";
import { ITENS_MENU, type ItemMenu } from "@/app/lib/menu-admin";

export interface MenuDaSessao {
  itens: ItemMenu[];
  nome: string;
  email: string;
}

/**
 * Destinos que a conta logada pode abrir, pela MESMA regra do proxy (checkUserPermission).
 * Esconder o link é só conforto: quem barra é o proxy. Sem sessão ou com falha, devolve null e a tela fica sem menu.
 */
export async function menuDaSessao(): Promise<MenuDaSessao | null> {
  // O menu depende da conta: toda rota é renderizada por requisição. Fica fora do try para o Next
  // nunca ser enganado por um catch (sem isso, o build sem Auth0 geraria páginas estáticas sem menu).
  await connection();
  try {
    const session = await getSession();
    const sub: unknown = session?.user?.sub;
    if (typeof sub !== "string") return null;
    const userId = sub.replace(/^auth0\|/, "");

    const liberado = await Promise.all(
      ITENS_MENU.map((item) => checkUserPermission(new URL(item.href, "http://localhost"), "page", userId)),
    );
    return {
      itens: ITENS_MENU.filter((_, i) => liberado[i]),
      nome: String(session.user.name ?? session.user.email ?? "Conta"),
      email: String(session.user.email ?? ""),
    };
  } catch {
    return null;
  }
}
