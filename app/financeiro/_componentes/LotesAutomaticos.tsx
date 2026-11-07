"use client";

import { useState } from "react";
import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { Aviso, Botao, Campo } from "@/app/components/ui";
import { useAvisos } from "@/app/components/Avisos";
import { formatarMoeda, formatarNumero } from "@/app/lib/formatar";
import type { IAutomaticLotOccupancy, ILoteAutomatico, IPaymentConfig } from "@/app/lib/types/payments/payment.t";
import { Bloco } from "./Bloco";
import { enviarJson, hasValidAutomaticStructure, relatarFalha } from "./util";

const PRECOS = [
  ["valorPix", "PIX"],
  ["valorBoleto", "Boleto"],
  ["valorDebito", "Débito"],
  ["valorAVista", "Crédito à vista"],
] as const;

interface Props {
  config: IPaymentConfig;
  ocupacao: IAutomaticLotOccupancy | null;
  ocupacaoCarregando: boolean;
  aoSalvar: () => Promise<void>;
}

export function LotesAutomaticos({ config, ocupacao, ocupacaoCarregando, aoSalvar }: Props) {
  const { avisar } = useAvisos();
  const [codigoEmEdicao, setCodigoEmEdicao] = useState<number | null>(null);
  const [lote, setLote] = useState<ILoteAutomatico | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const lotes = config.configuracaoLotesAutomaticos?.lotes;
  const estruturaValida = hasValidAutomaticStructure(lotes);

  const iniciar = (l: ILoteAutomatico) => { setCodigoEmEdicao(l.codigo); setLote(structuredClone(l)); setTentou(false); };
  const cancelar = () => { setCodigoEmEdicao(null); setLote(null); setTentou(false); };

  const mudarPreco = (campo: (typeof PRECOS)[number][0], valor: string) =>
    setLote((a) => (a ? { ...a, precos: { ...a.precos, [campo]: Number(valor) } } : a));

  const mudarParcela = (i: number, campo: "totalParcelas" | "valorCadaParcela", valor: string) =>
    setLote((a) => {
      if (!a) return a;
      const parcelamentos = [...a.precos.parcelamentos];
      parcelamentos[i] = { ...parcelamentos[i], [campo]: Number(valor) };
      return { ...a, precos: { ...a.precos, parcelamentos } };
    });

  const adicionarParcela = () =>
    setLote((a) => {
      if (!a) return a;
      const codigo = a.precos.parcelamentos.reduce((m, p) => Math.max(m, p.codigo), -1) + 1;
      return { ...a, precos: { ...a.precos, parcelamentos: [...a.precos.parcelamentos, { codigo, totalParcelas: 2, valorCadaParcela: 0 }] } };
    });

  const removerParcela = (codigo: number) =>
    setLote((a) => (a ? { ...a, precos: { ...a.precos, parcelamentos: a.precos.parcelamentos.filter((p) => p.codigo !== codigo) } } : a));

  // Erros ligados ao campo, só depois da primeira tentativa de salvar.
  const erroNome = lote && !lote.nome.trim() ? "Informe o nome do lote." : undefined;
  const erroLimite = lote && !(Number.isInteger(lote.limiteVagas) && lote.limiteVagas > 0) ? "Use um número inteiro maior que zero." : undefined;
  const parcelaInvalida = (p: { totalParcelas: number }) => !(Number.isInteger(p.totalParcelas) && p.totalParcelas > 0);

  async function salvar() {
    if (!lote || codigoEmEdicao === null) return;
    setTentou(true);
    if (erroNome || erroLimite || lote.precos.parcelamentos.some(parcelaInvalida)) return;
    setSalvando(true);
    try {
      const r = await enviarJson("/api/put/pagamentos/configuracaoLoteAutomatico", "PUT", {
        configId: config._id,
        loteCodigo: codigoEmEdicao,
        lote: { nome: lote.nome, limiteVagas: lote.limiteVagas, precos: lote.precos },
      }, "Falha ao salvar o lote.");
      if (relatarFalha(avisar, r, "Lote não salvo")) return;
      await aoSalvar();
      cancelar();
      avisar("ok", "Lote atualizado", "A alteração vale para novas sessões de pagamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Bloco
      titulo="Lotes usados pelo checkout"
      descricao="Cada lote tem preços próprios. Salvar um lote altera somente aquele lote."
    >
      <Aviso tom="alerta">
        Sessões de pagamento já criadas mantêm o lote e os valores originais. As alterações abaixo valem apenas para novas sessões.
      </Aviso>

      {!estruturaValida ? (
        <Aviso tom="erro" titulo="Estrutura automática inválida">
          Nenhum lote será criado ou preenchido a partir dos valores legados. Corrija a estrutura da configuração antes de editar preços.
        </Aviso>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lotes!.map((l) => {
            const editando = codigoEmEdicao === l.codigo && lote;
            const disponibilidade = ocupacao?.lotes.find((o) => o.codigo === l.codigo && o.limiteVagas === l.limiteVagas);
            return (
              <article key={l.codigo} className="grid content-start gap-3 rounded-xl bg-recuo/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sutil">Lote #{l.codigo}</p>
                    <h4 className="titulo text-lg">{l.nome}</h4>
                  </div>
                  {!editando && (
                    <Botao estilo="contorno" tamanho="pequeno" disabled={codigoEmEdicao !== null} onClick={() => iniciar(l)}>
                      <Edit3 className="size-4" aria-hidden="true" />Editar lote
                    </Botao>
                  )}
                </div>

                {editando ? (
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo rotulo="Nome" value={lote.nome} erro={tentou ? erroNome : undefined} onChange={(e) => setLote((a) => (a ? { ...a, nome: e.target.value } : a))} />
                      <Campo rotulo="Limite de vagas" type="number" min="1" step="1" value={lote.limiteVagas} erro={tentou ? erroLimite : undefined} onChange={(e) => setLote((a) => (a ? { ...a, limiteVagas: Number(e.target.value) } : a))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PRECOS.map(([campo, rotulo]) => (
                        <Campo key={campo} rotulo={`${rotulo} (R$)`} type="number" min="0" step="0.01" value={lote.precos[campo]} onChange={(e) => mudarPreco(campo, e.target.value)} />
                      ))}
                    </div>

                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-sm font-semibold">Parcelamentos do lote</h5>
                        <Botao estilo="contorno" tamanho="pequeno" onClick={adicionarParcela}><Plus className="size-4" aria-hidden="true" />Adicionar opção</Botao>
                      </div>
                      {lote.precos.parcelamentos.length === 0 ? (
                        <p className="text-sm text-sutil">Nenhuma opção de parcelamento cadastrada.</p>
                      ) : lote.precos.parcelamentos.map((p, i) => (
                        <div key={p.codigo} className="grid items-end gap-2 rounded-lg border border-linha bg-cartao p-3 sm:grid-cols-[auto_1fr_1fr_auto]">
                          <span className="text-xs font-semibold text-sutil sm:pb-3">Código {p.codigo}</span>
                          <Campo rotulo="Parcelas" type="number" min="1" step="1" value={p.totalParcelas} erro={tentou && parcelaInvalida(p) ? "Inteiro maior que zero." : undefined} onChange={(e) => mudarParcela(i, "totalParcelas", e.target.value)} />
                          <Campo rotulo="Valor por parcela (R$)" type="number" min="0" step="0.01" value={p.valorCadaParcela} onChange={(e) => mudarParcela(i, "valorCadaParcela", e.target.value)} />
                          <Botao estilo="perigo" tamanho="pequeno" aria-label={`Remover parcelamento ${p.codigo}`} onClick={() => removerParcela(p.codigo)}>
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Botao>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Botao carregando={salvando} onClick={() => void salvar()}><Save className="size-4" aria-hidden="true" />Salvar este lote</Botao>
                      <Botao estilo="contorno" disabled={salvando} onClick={cancelar}><X className="size-4" aria-hidden="true" />Cancelar</Botao>
                    </div>
                  </div>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                      <div className="col-span-2 sm:col-span-3">
                        <dt className="text-xs text-sutil">Limite</dt>
                        <dd className="font-semibold">{formatarNumero(l.limiteVagas)} vagas</dd>
                        <dd className="text-xs text-sutil">
                          {disponibilidade
                            ? disponibilidade.restantes === 1 ? "Resta 1 vaga" : `Restam ${formatarNumero(disponibilidade.restantes)} vagas`
                            : ocupacaoCarregando ? "Calculando disponibilidade…" : "Disponibilidade indisponível"}
                        </dd>
                      </div>
                      {PRECOS.map(([campo, rotulo]) => (
                        <div key={campo}><dt className="text-xs text-sutil">{rotulo}</dt><dd className="num font-semibold">{formatarMoeda(l.precos[campo])}</dd></div>
                      ))}
                    </dl>
                    <div className="text-sm">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-sutil">Parcelamentos</h5>
                      {l.precos.parcelamentos.length === 0 ? (
                        <p className="text-sutil">Nenhuma opção cadastrada</p>
                      ) : (
                        <ul>
                          {l.precos.parcelamentos.map((p) => (
                            <li key={p.codigo}>Código {p.codigo}: <span className="num">{p.totalParcelas}x de {formatarMoeda(p.valorCadaParcela)}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Bloco>
  );
}
