import { parseAdminUserListPayload } from "@/app/lib/users/admin-user-contract";
import type { AdminUserSummary } from "@/app/lib/users/admin-user-contract";

/** `conhecidos` mais quem tem presença registrada (em outro aparelho) mas não está na lista desta tela. Lança erro se não conseguir buscar. */
export async function usuariosComPresenca(ids: readonly string[], conhecidos: readonly AdminUserSummary[]): Promise<AdminUserSummary[]> {
  const faltam = [...new Set(ids)].filter((id) => !conhecidos.some((u) => u._id === id));
  if (!faltam.length) return [...conhecidos];
  const res = await fetch("/api/post/informacoesVariosUsuarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(faltam) });
  const extras = res.ok ? parseAdminUserListPayload(await res.json().catch(() => null)) : null;
  if (!extras) throw new Error("usuarios");
  return [...conhecidos, ...extras];
}
