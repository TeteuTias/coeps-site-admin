"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { CircleHelp, Save } from "lucide-react"
import { Aviso, Botao, Campo, Caixa, Secao } from "@/app/components/ui"
import { useAvisos } from "@/app/components/Avisos"
import { Copiavel } from "@/app/components/Copiavel"
import { formatarData } from "@/app/lib/formatar"
import type { AdminUserDetails } from "@/app/lib/users/admin-user-contract"
import { enviarPut, type Carga } from "./carga"
import { camposFaltantes } from "./campos-cadastro"
import { CorpoCarga } from "./comuns"

interface Rascunho {
    id_api: string
    nome: string
    email: string
    numero_telefone: string
    situacao_animacao: boolean
    isPos_registration: boolean
}

const ROTULOS: Record<keyof Rascunho, string> = {
    id_api: "ID no Asaas",
    nome: "Nome completo",
    email: "E-mail",
    numero_telefone: "Telefone",
    situacao_animacao: "Animação de boas-vindas",
    isPos_registration: "Informações iniciais",
}

const doUsuario = (u: AdminUserDetails): Rascunho => ({
    id_api: u.id_api ?? "",
    nome: u.informacoes_usuario.nome ?? "",
    email: u.informacoes_usuario.email ?? "",
    numero_telefone: u.informacoes_usuario.numero_telefone ?? "",
    situacao_animacao: u.pagamento.situacao_animacao,
    isPos_registration: u.isPos_registration,
})

export function CadastroSecao({ carga, userId }: { carga: Carga<AdminUserDetails>; userId: string }) {
    return (
        <Secao id="cadastro" titulo="Cadastro" descricao="Dados pessoais e configurações da conta. Só os campos que você alterar são enviados." className="scroll-mt-4">
            <CorpoCarga carga={carga} titulo="Cadastro" linhas={3}>
                {(usuario) => {
                    const faltantes = camposFaltantes(usuario.informacoes_usuario)
                    return (
                        <>
                            {faltantes.length > 0 && (
                                <Aviso tom="alerta" titulo="Cadastro incompleto">
                                    <p>Faltam os campos abaixo, por isso a pessoa aparece como cadastro pendente.</p>
                                    <ul className="mt-1.5 list-disc pl-5">
                                        {faltantes.map((campo) => (
                                            <li key={campo.rotulo}>
                                                <strong>{campo.rotulo}:</strong>{" "}
                                                {campo.editavel
                                                    ? "preencha neste formulário."
                                                    : "não pode ser editado nesta tela; peça ao suporte técnico."}
                                            </li>
                                        ))}
                                    </ul>
                                </Aviso>
                            )}
                            {/* a chave refaz o formulário com os dados novos depois de salvar ou recarregar */}
                            <Formulario key={JSON.stringify(doUsuario(usuario))} usuario={usuario} userId={userId} aoSalvar={carga.recarregar} />
                        </>
                    )
                }}
            </CorpoCarga>
        </Secao>
    )
}

function Formulario({ usuario, userId, aoSalvar }: { usuario: AdminUserDetails; userId: string; aoSalvar: () => Promise<void> }) {
    const { avisar, confirmar } = useAvisos()
    const base = doUsuario(usuario)
    const [rascunho, setRascunho] = useState<Rascunho>(base)
    const [salvando, setSalvando] = useState(false)
    const [ajudaAberta, setAjudaAberta] = useState(false)

    // Só o que mudou: o servidor grava apenas os campos recebidos, então o resto não é sobrescrito.
    const alterados = (Object.keys(base) as (keyof Rascunho)[]).filter((k) => rascunho[k] !== base[k])
    const mudou = alterados.length > 0
    const campo = (k: "id_api" | "nome" | "email" | "numero_telefone") => ({
        value: rascunho[k],
        onChange: (e: { target: { value: string } }) => setRascunho((r) => ({ ...r, [k]: e.target.value })),
    })

    async function salvar(e: FormEvent) {
        e.preventDefault()
        if (!mudou) return
        const apagados = alterados.filter((k) => typeof base[k] === "string" && base[k] !== "" && rascunho[k] === "")
        if (alterados.includes("id_api") || apagados.length > 0) {
            const ok = await confirmar({
                titulo: alterados.includes("id_api") ? "Trocar o ID no Asaas?" : "Apagar dado do cadastro?",
                descricao: alterados.includes("id_api")
                    ? "Um ID errado desliga esta pessoa do cliente dela no Asaas e quebra cobranças futuras. Confirme só se copiou o código direto do Asaas."
                    : `Você está deixando em branco: ${apagados.map((k) => ROTULOS[k]).join(", ")}. O cadastro pode voltar a ficar incompleto.`,
                perigo: true,
                rotuloConfirmar: "Salvar mesmo assim",
            })
            if (!ok) return
        }
        setSalvando(true)
        try {
            const corpo: Record<string, string | boolean> = { userId }
            for (const k of alterados) corpo[k] = rascunho[k]
            await enviarPut("/api/put/usuario/atualizarUsuario/", corpo)
            avisar("ok", "Cadastro salvo", `Campos atualizados: ${alterados.map((k) => ROTULOS[k]).join(", ")}.`)
            await aoSalvar()
        } catch (error) {
            avisar("erro", "Não foi possível salvar o cadastro", error instanceof Error ? error.message : undefined)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <form onSubmit={salvar} className="grid gap-5">
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div><dt className="inline text-sutil">Cadastro criado em </dt><dd className="inline">{formatarData(usuario.informacoes_usuario.data_criacao, "data não informada")}</dd></div>
                <div className="flex flex-wrap items-center gap-1.5"><dt className="text-sutil">ID da pessoa</dt><dd><Copiavel texto={usuario._id} rotulo="ID da pessoa" /></dd></div>
            </dl>

            <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Nome completo" name="nome" autoComplete="off" {...campo("nome")} />
                <Campo rotulo="E-mail" name="email" type="email" autoComplete="off" {...campo("email")} />
                <Campo rotulo="Telefone" name="numero_telefone" type="tel" autoComplete="off" {...campo("numero_telefone")} />
                {/* Somente leitura: preenchida pela própria pessoa no cadastro do site. */}
                <div>
                    <p className="text-sm font-medium">Profissão</p>
                    <p className="mt-1.5 rounded-xl bg-recuo/60 px-3.5 py-2.5 text-[15px]">
                        {usuario.informacoes_usuario.profissao ?? "Não informada (estudante ou cadastro anterior ao campo)"}
                    </p>
                    <p className="mt-1 text-xs text-sutil">Preenchida pela pessoa no cadastro do site; não é editada aqui.</p>
                </div>
                {/* Somente leitura: preenchidos pelo congressista formado no cadastro do site. */}
                <div>
                    <p className="text-sm font-medium">Matrícula do município</p>
                    <p className="mt-1.5 rounded-xl bg-recuo/60 px-3.5 py-2.5 text-[15px]">
                        {usuario.informacoes_usuario.matricula_municipio || "Não informada (estudante ou cadastro anterior ao campo)"}
                    </p>
                </div>
                <div>
                    <p className="text-sm font-medium">Unidade de Origem</p>
                    <p className="mt-1.5 rounded-xl bg-recuo/60 px-3.5 py-2.5 text-[15px]">
                        {usuario.informacoes_usuario.unidade_origem || "Não informada (estudante ou cadastro anterior ao campo)"}
                    </p>
                </div>
            </div>

            <div className="grid gap-2">
                <Campo
                    rotulo="ID no Asaas"
                    name="id_api"
                    autoComplete="off"
                    ajuda="Código desta pessoa como cliente no Asaas (o sistema de cobranças). Troque só com cuidado."
                    {...campo("id_api")}
                />
                <div>
                    <button
                        type="button"
                        aria-expanded={ajudaAberta}
                        aria-controls="ajuda-id-asaas"
                        onClick={() => setAjudaAberta((a) => !a)}
                        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-info hover:underline"
                    >
                        <CircleHelp className="size-4" aria-hidden="true" />Como alterar com segurança?
                    </button>
                    {ajudaAberta && (
                        <div id="ajuda-id-asaas" className="mt-1 grid gap-2 rounded-xl bg-info-fundo px-4 py-3 text-sm text-info">
                            <p><strong>O que é:</strong> cada pessoa cadastrada aqui também é cliente no Asaas. Este código liga as duas coisas.</p>
                            <p><strong>Como trocar:</strong> copie o código direto do painel do Asaas. Se não conseguir, desmarque &ldquo;Já preencheu as informações iniciais&rdquo; abaixo: a pessoa preenche tudo de novo e o sistema gera um novo ID já sincronizado.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                <Caixa
                    rotulo="Já preencheu as informações iniciais"
                    ajuda="Desmarque para a pessoa preencher tudo de novo no próximo acesso."
                    checked={rascunho.isPos_registration}
                    onChange={(e) => setRascunho((r) => ({ ...r, isPos_registration: e.target.checked }))}
                />
                <Caixa
                    rotulo="Animação de boas-vindas já exibida"
                    ajuda="Desmarque para exibir a animação de novo."
                    checked={rascunho.situacao_animacao}
                    onChange={(e) => setRascunho((r) => ({ ...r, situacao_animacao: e.target.checked }))}
                />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-linha pt-4">
                <p className="text-sm text-sutil" role="status">
                    {mudou ? `Alterado: ${alterados.map((k) => ROTULOS[k]).join(", ")}.` : "Altere um campo para poder salvar."}
                </p>
                <Botao type="submit" carregando={salvando} disabled={!mudou}>
                    <Save className="size-4" aria-hidden="true" />Salvar cadastro
                </Botao>
            </div>
        </form>
    )
}
