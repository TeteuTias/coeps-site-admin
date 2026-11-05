"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterX, RefreshCw, UserX } from "lucide-react";
import { Aviso, Botao, Campo, CampoBusca, Escolha, Secao, Selo, TabelaRolavel, classeBotao, classeTd, classeTh } from "@/app/components/ui";
import { Atualizando, Estado } from "@/app/components/Estado";
import { useAvisos } from "@/app/components/Avisos";
import { formatarNumero } from "@/app/lib/formatar";
import { type AdminUserSummary, adminUserLotKey, adminUserLotLabel, displayUserField, displayUserName, filterAdminUsers } from "@/app/lib/users/admin-user-contract";
import { enviar, relatarFalha, rotuloTipo } from "./util";

interface Props {
  /** null = ainda não lida (carregando ou falha na primeira leitura). */
  inscritos: AdminUserSummary[] | null;
  carregando: boolean;
  erro: string | null;
  aoTentar: () => void;
  aoRemovido: (id: string) => void;
}

export function Inscritos({ inscritos, carregando, erro, aoTentar, aoRemovido }: Props) {
  const { avisar, confirmar } = useAvisos();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [lote, setLote] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);
  const lista = useMemo(() => inscritos ?? [], [inscritos]);

  const filtrados = useMemo(
    () => filterAdminUsers(lista, { searchTerm: busca, selectedPaymentType: tipo, selectedLot: lote, startDate: de, endDate: ate }),
    [lista, busca, tipo, lote, de, ate],
  );

  // Opções do filtro vêm dos próprios inscritos, com contagem, inclusive lotes que já saíram da configuração.
  const opcoesLote = useMemo(() => {
    const opcoes = new Map<string, { rotulo: string; total: number }>();
    for (const u of lista) {
      const chave = adminUserLotKey(u);
      const o = opcoes.get(chave) ?? { rotulo: adminUserLotLabel(u), total: 0 };
      o.total += 1;
      opcoes.set(chave, o);
    }
    const ordem = (k: string) => (Number.isFinite(Number(k)) ? Number(k) : Infinity);
    return Array.from(opcoes, ([chave, o]) => ({ chave, ...o })).sort((a, b) => ordem(a.chave) - ordem(b.chave) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [lista]);

  const tipos = useMemo(() => Array.from(new Set(lista.map((u) => u.pagamento.tipo_pagamento).filter((t): t is string => Boolean(t)))), [lista]);
  const filtrando = Boolean(busca || tipo || lote || de || ate);
  const limpar = () => { setBusca(""); setTipo(""); setLote(""); setDe(""); setAte(""); };

  async function remover(u: AdminUserSummary) {
    const ok = await confirmar({
      titulo: `Remover a inscrição de ${displayUserName(u)}?`,
      descricao: "Os indicadores de pagamento do cadastro voltam para \"sem inscrição\". Compras e registros de pagamento não são apagados por esta ação.",
      perigo: true,
      rotuloConfirmar: "Remover inscrição",
    });
    if (!ok) return;
    setRemovendo(u._id);
    try {
      const r = await enviar(`/api/delete/pagamentos/removerInscricao/${u._id}`, { method: "DELETE" }, "Não foi possível remover a inscrição.");
      if (relatarFalha(avisar, r, "Inscrição não removida")) return;
      aoRemovido(u._id);
      avisar("ok", "Inscrição removida", displayUserName(u));
    } finally {
      setRemovendo(null);
    }
  }

  let corpo;
  if (inscritos === null && carregando) corpo = <Estado tipo="carregando" titulo="Carregando pessoas inscritas…" />;
  else if (inscritos === null) corpo = <Estado tipo="erro" titulo="Não foi possível carregar as pessoas inscritas" texto={erro ?? undefined} aoTentar={aoTentar} />;
  else if (lista.length === 0) corpo = <Estado tipo="vazio" titulo="Ainda não há pessoas inscritas" texto="Quando houver inscrições confirmadas, elas aparecem aqui." />;
  else if (filtrados.length === 0) corpo = <Estado tipo="semResultado" acao={<Botao estilo="contorno" onClick={limpar}>Limpar filtros</Botao>} />;
  else {
    corpo = (
      <TabelaRolavel rotulo="Pessoas inscritas" className="[&_table]:min-w-[56rem]">
        <thead>
          <tr>
            <th className={classeTh}>Pessoa</th><th className={classeTh}>Contato</th><th className={classeTh}>CPF</th>
            <th className={classeTh}>Lote</th><th className={classeTh}>Pagamento</th><th className={classeTh}>ID Asaas</th><th className={classeTh}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((u) => (
            <tr key={u._id}>
              <td className={classeTd}>
                <p className="font-medium">{displayUserName(u)}</p>
                {u.cadastroPendente && <Selo tom="alerta">Cadastro pendente</Selo>}
              </td>
              <td className={classeTd}>
                <p className="break-all">{displayUserField(u.informacoes_usuario.email)}</p>
                <p className="text-sutil">{displayUserField(u.informacoes_usuario.numero_telefone)}</p>
              </td>
              <td className={`${classeTd} num whitespace-nowrap`}>{displayUserField(u.informacoes_usuario.cpf)}</td>
              <td className={classeTd}>{adminUserLotLabel(u)}</td>
              <td className={classeTd}>{u.pagamento.tipo_pagamento ? rotuloTipo(u.pagamento.tipo_pagamento) : "Não informado"}</td>
              <td className={`${classeTd} num break-all`}>{displayUserField(u.id_api)}</td>
              <td className={classeTd}>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/usuarios/informacoes/${u._id}`} className={classeBotao("contorno", "", "pequeno")}>Ver perfil</Link>
                  <Botao estilo="perigo" tamanho="pequeno" carregando={removendo === u._id} disabled={removendo !== null} onClick={() => void remover(u)}>
                    <UserX className="size-4" aria-hidden="true" />Remover inscrição
                  </Botao>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TabelaRolavel>
    );
  }

  return (
    <Secao
      id="inscritos"
      className="scroll-mt-4"
      titulo="Inscritos"
      descricao="Esta lista mostra pessoas inscritas (inscrição confirmada), uma linha por pessoa. Não é uma lista de transações: pagamentos, parcelas e estornos ficam no perfil de cada pessoa."
      acoes={
        <>
          <Atualizando ativo={carregando && inscritos !== null} />
          <Botao estilo="contorno" tamanho="pequeno" carregando={carregando} onClick={aoTentar}><RefreshCw className="size-4" aria-hidden="true" />Atualizar lista</Botao>
        </>
      }
    >
      {erro && inscritos !== null && <Aviso tom="alerta" titulo="Não foi possível atualizar a lista">{erro} A última lista válida continua na tela.</Aviso>}

      {inscritos !== null && lista.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <CampoBusca className="sm:col-span-2" rotulo="Buscar pessoa" rotuloOculto={false} placeholder="Nome, e-mail, ID ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Escolha rotulo="Forma de pagamento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todas</option>
            {tipos.map((t) => <option key={t} value={t}>{rotuloTipo(t)}</option>)}
          </Escolha>
          <Escolha rotulo="Lote" value={lote} onChange={(e) => setLote(e.target.value)}>
            <option value="">Todos os lotes</option>
            {opcoesLote.map((o) => <option key={o.chave} value={o.chave}>{o.rotulo} — {formatarNumero(o.total)}</option>)}
          </Escolha>
          <Campo type="date" rotulo="Cadastrado desde" ajuda="Data de cadastro da conta" value={de} onChange={(e) => setDe(e.target.value)} />
          <Campo type="date" rotulo="Cadastrado até" ajuda="Data de cadastro da conta" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      )}

      {inscritos !== null && lista.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="text-sm text-sutil">
            Mostrando <strong className="num text-tinta">{formatarNumero(filtrados.length)}</strong> de <span className="num">{formatarNumero(lista.length)}</span> pessoas inscritas
          </p>
          {filtrando && <Botao estilo="fantasma" tamanho="pequeno" onClick={limpar}><FilterX className="size-4" aria-hidden="true" />Limpar filtros</Botao>}
        </div>
      )}

      {corpo}

      <p className="text-sm text-sutil">
        Para outras ações sobre uma pessoa, use <Link href="/usuarios" className="font-medium text-tinta underline">Usuários</Link>.
      </p>
    </Secao>
  );
}
