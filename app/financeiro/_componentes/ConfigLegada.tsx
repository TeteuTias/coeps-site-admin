"use client";

import { useState } from "react";
import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { Aviso, Botao, Campo } from "@/app/components/ui";
import { useAvisos } from "@/app/components/Avisos";
import { formatarMoeda, formatarNumero } from "@/app/lib/formatar";
import type { IPaymentConfig } from "@/app/lib/types/payments/payment.t";
import { Bloco } from "./Bloco";
import { corpoGeral, enviarJson, relatarFalha, type IParcelamento } from "./util";

const VALORES = [
  ["valorAVista", "Crédito à vista"],
  ["valorDebito", "Débito"],
  ["valorBoleto", "Boleto"],
  ["valorPix", "PIX"],
] as const;

type Info = { nome: string; edicaoId: string; valorAVista: number; valorBoleto: number; valorDebito: number; valorPix: number };
const infoDe = (c: IPaymentConfig): Info => ({
  nome: c.nome, edicaoId: c.edicaoId ?? "", valorAVista: c.valorAVista, valorBoleto: c.valorBoleto, valorDebito: c.valorDebito, valorPix: c.valorPix,
});

/** Nome, edição ativa e valores únicos: usados no modo manual e mantidos por compatibilidade no automático. */
export function CamposLegados({ config, aoSalvar }: { config: IPaymentConfig; aoSalvar: () => Promise<void> }) {
  const { avisar, confirmar } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [info, setInfo] = useState<Info>(infoDe(config));
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const automatico = config.modo === "automatico";
  const erroNome = !info.nome.trim() ? "O nome é obrigatório." : undefined;
  const erroEdicao = !info.edicaoId.trim() ? "Informe o identificador da edição." : undefined;

  const numero = (campo: keyof Info) => (e: React.ChangeEvent<HTMLInputElement>) => setInfo((a) => ({ ...a, [campo]: parseFloat(e.target.value) || 0 }));
  const texto = (campo: "nome" | "edicaoId") => (e: React.ChangeEvent<HTMLInputElement>) => setInfo((a) => ({ ...a, [campo]: e.target.value }));
  const abrir = () => { setInfo(infoDe(config)); setTentou(false); setEditando(true); };

  async function salvar() {
    setTentou(true);
    if (erroNome || erroEdicao) return;
    const novaEdicao = Boolean(info.edicaoId && info.edicaoId !== config.edicaoId);
    if (novaEdicao) {
      const ok = await confirmar({
        titulo: "Iniciar uma nova edição?",
        descricao: (
          <>
            Iniciar uma nova edição zera o contador de pagantes legados e desativa as outras configurações. Se o servidor tiver a edição fixada por variável de
            ambiente (PAYMENT_EDITION_ID ou COEPS_ACTIVE_EDITION_ID), o valor lá precisa ser igual ao novo identificador: senão a página deixa de achar a configuração ativa.
          </>
        ),
        perigo: true,
        rotuloConfirmar: "Iniciar nova edição",
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      const r = await enviarJson("/api/put/pagamentos/configuracaoGeralPagamento", "PUT", corpoGeral(config, info), "Não foi possível salvar os dados. Recarregue a página e tente de novo.");
      if (relatarFalha(avisar, r, "Alterações não salvas")) return;
      await aoSalvar();
      setEditando(false);
      avisar("ok", novaEdicao ? "Nova edição iniciada" : "Campos salvos");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Bloco
      titulo="Compatibilidade legada e modo manual"
      descricao="Nome, edição ativa e valores únicos por forma de pagamento."
    >
      {automatico && (
        <Aviso tom="info">
          Os valores e o nome abaixo permanecem por compatibilidade, mas não são os preços usados pelo checkout enquanto o modo for automático. Edite os lotes acima para alterar novas compras.
        </Aviso>
      )}

      {editando ? (
        <div className="grid gap-3">
          <Campo rotulo="Nome da configuração" ajuda="Este nome aparece na fatura do cartão" value={info.nome} erro={tentou ? erroNome : undefined} onChange={texto("nome")} />
          <Campo
            rotulo="Identificador da edição ativa"
            ajuda="Exemplo: COEPS-2026. Alterar este campo inicia uma nova edição e zera os pagantes legados."
            value={info.edicaoId}
            maxLength={64}
            required
            erro={tentou ? erroEdicao : undefined}
            onChange={texto("edicaoId")}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {VALORES.map(([campo, rotulo]) => (
              <Campo key={campo} rotulo={`${rotulo} (R$)`} type="number" min="0" step="0.01" value={info[campo]} onChange={numero(campo)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao carregando={salvando} onClick={() => void salvar()}><Save className="size-4" aria-hidden="true" />Salvar</Botao>
            <Botao estilo="contorno" disabled={salvando} onClick={() => setEditando(false)}><X className="size-4" aria-hidden="true" />Cancelar</Botao>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs text-sutil">Nome (aparece na fatura do cartão)</dt><dd className="font-medium">{config.nome}</dd></div>
            <div><dt className="text-xs text-sutil">Edição ativa</dt><dd className="font-medium">{config.edicaoId ?? "Não configurada"}</dd></div>
            <div><dt className="text-xs text-sutil">Pagantes legados</dt><dd className="num font-medium">{formatarNumero(config.pagantesLegados ?? null)}</dd></div>
            {VALORES.map(([campo, rotulo]) => (
              <div key={campo}><dt className="text-xs text-sutil">{rotulo}</dt><dd className="num font-medium">{formatarMoeda(config[campo])}</dd></div>
            ))}
          </dl>
          <div><Botao estilo="contorno" onClick={abrir}><Edit3 className="size-4" aria-hidden="true" />Editar campos legados</Botao></div>
        </div>
      )}
    </Bloco>
  );
}

export function ParcelamentosLegados({ config, aoSalvar }: { config: IPaymentConfig; aoSalvar: () => Promise<void> }) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [lista, setLista] = useState<IParcelamento[]>([]);
  const [salvando, setSalvando] = useState(false);

  const abrir = () => { setLista(structuredClone(config.parcelamentos ?? [])); setEditando(true); };
  const mudar = (i: number, campo: "totalParcelas" | "valorCadaParcela", valor: string) =>
    setLista((a) => a.map((p, j) => (j === i ? { ...p, [campo]: parseFloat(valor) || 0 } : p)));
  const adicionar = () => setLista((a) => [...a, { codigo: a.reduce((m, p) => (p.codigo > m ? p.codigo : m), 0) + 1, totalParcelas: 2, valorCadaParcela: 0 }]);
  const total = (p: IParcelamento) => formatarMoeda(p.valorCadaParcela * p.totalParcelas);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await enviarJson("/api/put/pagamentos/configuracaoParcelamentos", "PUT", { _id: config._id, parcelamentos: lista }, "Falha ao salvar parcelamentos.");
      if (relatarFalha(avisar, r, "Parcelamentos não salvos")) return;
      await aoSalvar();
      setEditando(false);
      avisar("ok", "Parcelamentos atualizados");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Bloco
      titulo="Parcelamentos legados"
      descricao="Pagamentos já criados preservam o snapshot dos valores originais e não são alterados por esta tela."
    >
      {!editando ? (
        <>
          {(config.parcelamentos ?? []).length === 0 ? (
            <p className="text-sm text-sutil">Nenhum parcelamento cadastrado.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {config.parcelamentos.map((p) => (
                <li key={p.codigo} className="rounded-xl bg-recuo/50 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sutil">Código {p.codigo}</p>
                  <p className="num mt-1 font-semibold">{p.totalParcelas}x de {formatarMoeda(p.valorCadaParcela)}</p>
                  <p className="num text-sutil">Total {total(p)}</p>
                </li>
              ))}
            </ul>
          )}
          <div><Botao estilo="contorno" onClick={abrir}><Edit3 className="size-4" aria-hidden="true" />Editar parcelamentos</Botao></div>
        </>
      ) : (
        <div className="grid gap-3">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((p, i) => (
              <li key={p.codigo} className="grid gap-2 rounded-xl border border-linha p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sutil">Código {p.codigo}</span>
                  <Botao estilo="perigo" tamanho="pequeno" aria-label={`Remover parcelamento ${p.codigo}`} onClick={() => setLista((a) => a.filter((x) => x.codigo !== p.codigo))}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Botao>
                </div>
                <Campo rotulo="Total de parcelas" type="number" min="1" step="1" value={p.totalParcelas} onChange={(e) => mudar(i, "totalParcelas", e.target.value)} />
                <Campo rotulo="Valor por parcela (R$)" type="number" min="0" step="0.01" value={p.valorCadaParcela} onChange={(e) => mudar(i, "valorCadaParcela", e.target.value)} />
                <p className="num text-sm text-sutil">Novo total: {total(p)}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Botao estilo="contorno" onClick={adicionar}><Plus className="size-4" aria-hidden="true" />Adicionar parcelamento</Botao>
            <Botao carregando={salvando} onClick={() => void salvar()}><Save className="size-4" aria-hidden="true" />Salvar alterações</Botao>
            <Botao estilo="contorno" disabled={salvando} onClick={() => setEditando(false)}><X className="size-4" aria-hidden="true" />Cancelar</Botao>
          </div>
        </div>
      )}
    </Bloco>
  );
}
