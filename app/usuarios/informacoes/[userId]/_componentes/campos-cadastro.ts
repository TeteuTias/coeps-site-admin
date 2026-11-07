import type { AdminUserProfile } from "@/app/lib/users/admin-user-contract"

type Chave = "nome" | "email" | "cpf" | "numero_telefone"

/**
 * Campos que tornam o cadastro incompleto. Espelha `cadastroPendente` em admin-user-contract.ts
 * (nome, e-mail, CPF e telefone): se aquela regra mudar, mude aqui. `editavel` = a rota de atualização aceita o campo.
 */
const OBRIGATORIOS: { chave: Chave; rotulo: string; editavel: boolean }[] = [
    { chave: "nome", rotulo: "Nome completo", editavel: true },
    { chave: "email", rotulo: "E-mail", editavel: true },
    { chave: "cpf", rotulo: "CPF", editavel: false },
    { chave: "numero_telefone", rotulo: "Telefone", editavel: true },
]

export function camposFaltantes(perfil: AdminUserProfile) {
    return OBRIGATORIOS.filter((campo) => !perfil[campo.chave])
}
