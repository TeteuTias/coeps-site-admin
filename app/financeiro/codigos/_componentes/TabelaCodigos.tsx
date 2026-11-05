"use client";

import { Fragment, useId, useState } from "react";
import { Ban, CheckCircle2, ChevronDown, Trash2 } from "lucide-react";
import { Botao, Caixa, Campo, Selo, TabelaRolavel, classeTd, classeTh } from "@/app/components/ui";
import { Copiavel } from "@/app/components/Copiavel";
import { formatarCentavos, formatarDataHora, formatarNumero } from "@/app/lib/formatar";
import {
  LIMITE_USOS_MAX,
  canDeleteCode,
  canToggleCode,
  descreverBeneficio,
  selosDoCodigo,
  usageCount,
  type CodeItem,
  type CodeTab,
} from "./tipos";

interface Props {
  itens: CodeItem[];
  aba: CodeTab;
  edicaoAtiva: boolean;
  organizerPriceCents: number | null;
  selecionados: string[];
  /** Há uma operação em andamento: trava as ações, sem tirar a lista da tela. */
  ocupado: boolean;
  /** Ação em andamento neste momento, no formato "alternar:<id>", "excluir:<id>" ou "limite:<id>". */
  acaoAtiva: string | null;
  aoAlternarSelecao: (id: string) => void;
  aoAlternarPagina: (ids: string[]) => void;
  aoAlternarStatus: (item: CodeItem) => void;
  aoExcluir: (item: CodeItem) => void;
  /** Devolve true quando salvou, para limpar o rascunho do campo. */
  aoSalvarLimite: (item: CodeItem, limite: number) => Promise<boolean>;
}

const chaveDe = (item: CodeItem) => `${item.tipo}-${item.codigoNormalizado}`;

function Selos({ item }: { item: CodeItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      {selosDoCodigo(item).map((s) => (
        <span key={s.texto} title={s.dica}><Selo tom={s.tom}>{s.texto}</Selo></span>
      ))}
    </span>
  );
}

function usos(item: CodeItem) {
  if (item.limiteUsos !== undefined) return { valor: formatarNumero(item.usosRealizados ?? 0), sub: `de ${formatarNumero(item.limiteUsos)}` };
  const n = usageCount(item);
  return { valor: formatarNumero(n), sub: `${formatarNumero(item.metrics.confirmadas)} confirmada(s) · ${formatarNumero(item.metrics.pendentes)} pendente(s)` };
}

function limite(item: CodeItem) {
  if (item.limiteUsos !== undefined) return formatarNumero(item.limiteUsos);
  return item.tipo === "RASTREIO" ? "Sem limite" : "1 uso";
}

export function TabelaCodigos(props: Props) {
  const { itens, aba, edicaoAtiva, selecionados, ocupado, aoAlternarPagina } = props;
  const [expandido, setExpandido] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const idPagina = useId();

  const idsDaPagina = itens.filter((i) => canDeleteCode(i, edicaoAtiva)).map((i) => i.id as string);
  const paginaMarcada = idsDaPagina.length > 0 && idsDaPagina.every((id) => selecionados.includes(id));
  const alternar = (item: CodeItem) => setExpandido((atual) => (atual === chaveDe(item) ? null : chaveDe(item)));
  const rotuloBeneficio = aba === "RASTREIO" ? "Responsável" : "Benefício";

  const detalhes = (item: CodeItem) => (
    <DetalhesCodigo
      item={item}
      edicaoAtiva={edicaoAtiva}
      ocupado={ocupado}
      salvando={props.acaoAtiva === `limite:${item.id}`}
      rascunho={item.id ? rascunhos[item.id] : undefined}
      aoEditar={(valor) => item.id && setRascunhos((r) => ({ ...r, [item.id as string]: valor }))}
      aoSalvar={async (n) => {
        if (await props.aoSalvarLimite(item, n) && item.id) setRascunhos((r) => { const proximo = { ...r }; delete proximo[item.id as string]; return proximo; });
      }}
    />
  );

  return (
    <>
      {/* Computador: colunas essenciais; o resto fica na expansão da linha. */}
      <div className="hidden md:block">
        <TabelaRolavel rotulo="Códigos da edição">
          <thead>
            <tr>
              <th className={`${classeTh} w-12`}>
                <input
                  type="checkbox"
                  className="size-4"
                  aria-label="Selecionar os códigos excluíveis desta página"
                  disabled={idsDaPagina.length === 0 || ocupado}
                  checked={paginaMarcada}
                  onChange={() => aoAlternarPagina(idsDaPagina)}
                />
              </th>
              <th className={classeTh}>Código</th>
              <th className={classeTh}>{rotuloBeneficio}</th>
              <th className={classeTh}>Estado</th>
              <th className={classeTh}>Usos</th>
              <th className={classeTh}>Limite</th>
              <th className={classeTh}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const aberto = expandido === chaveDe(item);
              const b = descreverBeneficio(item, props.organizerPriceCents ? formatarCentavos(props.organizerPriceCents) : "Preço da edição indisponível");
              const u = usos(item);
              const idDetalhe = `${idPagina}-${item.codigoNormalizado}`;
              return (
                <Fragment key={chaveDe(item)}>
                  <tr>
                    <td className={classeTd}>
                      <input
                        type="checkbox"
                        className="size-4"
                        aria-label={`Selecionar ${item.codigo} para exclusão`}
                        disabled={!canDeleteCode(item, edicaoAtiva) || ocupado}
                        checked={Boolean(item.id && selecionados.includes(item.id))}
                        onChange={() => item.id && props.aoAlternarSelecao(item.id)}
                      />
                    </td>
                    <td className={classeTd}><Copiavel texto={item.codigo} rotulo={`código ${item.codigo}`} /></td>
                    <td className={classeTd}>
                      <span className="block max-w-56 truncate font-medium" title={b.titulo}>{b.titulo}</span>
                      <span className="block max-w-56 truncate text-xs text-sutil" title={b.sub}>{b.sub}</span>
                    </td>
                    <td className={classeTd}><Selos item={item} /></td>
                    <td className={`${classeTd} num`}>
                      <span className="font-semibold">{u.valor}</span>
                      <span className="block text-xs text-sutil">{u.sub}</span>
                    </td>
                    <td className={`${classeTd} num`}>{limite(item)}</td>
                    <td className={classeTd}>
                      <div className="flex flex-wrap gap-2">
                        <Botao estilo="fantasma" aria-expanded={aberto} aria-controls={idDetalhe} aria-label={`${aberto ? "Ocultar" : "Ver"} detalhes de ${item.codigo}`} onClick={() => alternar(item)}>
                          Detalhes <ChevronDown className={`size-4 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
                        </Botao>
                        <AcoesCodigo item={item} {...props} />
                      </div>
                    </td>
                  </tr>
                  {aberto && (
                    <tr id={idDetalhe}>
                      <td colSpan={7} className="bg-recuo/40 px-4 py-4">{detalhes(item)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </TabelaRolavel>
      </div>

      {/* Celular: cartão com código, estado e usos; o resto aparece ao tocar em "Detalhes". */}
      <div className="grid gap-3 md:hidden">
        <Caixa
          rotulo="Selecionar os excluíveis desta página"
          disabled={idsDaPagina.length === 0 || ocupado}
          checked={paginaMarcada}
          onChange={() => aoAlternarPagina(idsDaPagina)}
        />
        <ul className="grid gap-3">
          {itens.map((item) => {
            const aberto = expandido === chaveDe(item);
            const b = descreverBeneficio(item, props.organizerPriceCents ? formatarCentavos(props.organizerPriceCents) : "Preço da edição indisponível");
            const u = usos(item);
            const idDetalhe = `${idPagina}-m-${item.codigoNormalizado}`;
            return (
              <li key={chaveDe(item)} className="grid gap-3 rounded-2xl bg-cartao p-4 ring-1 ring-linha/60">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0"
                    aria-label={`Selecionar ${item.codigo} para exclusão`}
                    disabled={!canDeleteCode(item, edicaoAtiva) || ocupado}
                    checked={Boolean(item.id && selecionados.includes(item.id))}
                    onChange={() => item.id && props.aoAlternarSelecao(item.id)}
                  />
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Copiavel texto={item.codigo} rotulo={`código ${item.codigo}`} />
                    <Selos item={item} />
                    <p className="num text-sm"><span className="font-semibold">{u.valor}</span> <span className="text-sutil">uso(s) {u.sub}</span></p>
                  </div>
                </div>
                <Botao estilo="contorno" aria-expanded={aberto} aria-controls={idDetalhe} aria-label={`${aberto ? "Ocultar" : "Ver"} detalhes de ${item.codigo}`} onClick={() => alternar(item)}>
                  {aberto ? "Ocultar detalhes" : "Ver detalhes"} <ChevronDown className={`size-4 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
                </Botao>
                {aberto && (
                  <div id={idDetalhe} className="grid gap-4 border-t border-linha pt-3">
                    <p className="text-sm"><span className="font-medium">{b.titulo}</span><span className="block text-xs text-sutil">{b.sub} · Limite: {limite(item)}</span></p>
                    {detalhes(item)}
                    <div className="flex flex-wrap gap-2"><AcoesCodigo item={item} {...props} /></div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function AcoesCodigo({ item, edicaoAtiva, ocupado, acaoAtiva, aoAlternarStatus, aoExcluir }: Props & { item: CodeItem }) {
  const podeAlternar = canToggleCode(item, edicaoAtiva);
  const podeExcluir = canDeleteCode(item, edicaoAtiva);
  const ativo = item.status === "ATIVO";
  return (
    <>
      <Botao
        estilo="contorno"
        aria-label={`${ativo ? "Desativar" : "Ativar"} código ${item.codigo}`}
        title={podeAlternar ? undefined : "Só códigos da edição ativa, sem uso (rastreios sempre), podem ser alterados."}
        disabled={!podeAlternar || (ocupado && acaoAtiva !== `alternar:${item.id}`)}
        carregando={acaoAtiva === `alternar:${item.id}`}
        onClick={() => aoAlternarStatus(item)}
      >
        {ativo ? <Ban className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
        {ativo ? "Desativar" : "Ativar"}
      </Botao>
      <Botao
        estilo="perigo"
        aria-label={`Excluir código ${item.codigo}`}
        title={podeExcluir ? undefined : "Só códigos sem uso da edição ativa; rastreios precisam estar desativados."}
        disabled={!podeExcluir || (ocupado && acaoAtiva !== `excluir:${item.id}`)}
        carregando={acaoAtiva === `excluir:${item.id}`}
        onClick={() => aoExcluir(item)}
      >
        <Trash2 className="size-4" aria-hidden="true" />Excluir
      </Botao>
    </>
  );
}

function DetalhesCodigo({ item, edicaoAtiva, ocupado, salvando, rascunho, aoEditar, aoSalvar }: {
  item: CodeItem; edicaoAtiva: boolean; ocupado: boolean; salvando: boolean; rascunho?: string;
  aoEditar: (valor: string) => void; aoSalvar: (limite: number) => Promise<void>;
}) {
  const m = item.metrics;
  const linhas: [string, string][] = [
    ["Vendas confirmadas (brutas)", formatarNumero(m.confirmadasBrutas)],
    ["Pagamentos pendentes", formatarNumero(m.pendentes)],
    ["Em revisão financeira", formatarNumero(m.emRevisaoFinanceira)],
    ["Estornadas", formatarNumero(m.estornadas)],
    ["Canceladas ou expiradas", formatarNumero(m.canceladasOuExpiradas)],
    ["Valor bruto confirmado", formatarCentavos(m.valorBrutoConfirmadoCentavos)],
    ["Estornos concluídos", formatarCentavos(m.valorEstornadoDoneCentavos)],
    ["Valor em risco", formatarCentavos(m.valorEmRiscoCentavos)],
    ["Valor líquido", formatarCentavos(m.valorLiquidoCentavos)],
  ];
  const editaLimite = item.id && item.limiteUsos !== undefined && edicaoAtiva;
  const minimo = Math.max(1, item.usosRealizados ?? 0);
  const texto = rascunho ?? String(item.limiteUsos ?? "");
  const numero = Number(texto);
  const erro = !editaLimite ? undefined
    : texto.trim() === "" || !Number.isInteger(numero) ? "Informe um número inteiro."
    : numero < minimo ? `Não pode ser menor que ${minimo}, os usos já feitos.`
    : numero > LIMITE_USOS_MAX ? `O máximo é ${formatarNumero(LIMITE_USOS_MAX)}.`
    : undefined;

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-3">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}><dt className="text-xs text-sutil">{rotulo}</dt><dd className="num font-semibold">{valor}</dd></div>
        ))}
        <div><dt className="text-xs text-sutil">Criado em</dt><dd className="num font-semibold">{formatarDataHora(item.createdAt)}</dd></div>
      </dl>
      {item.id && <p className="text-xs text-sutil">Identificador para o suporte: <Copiavel texto={item.id} rotulo={`identificador de ${item.codigo}`} /></p>}
      {editaLimite && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); if (!erro && !ocupado) void aoSalvar(numero); }}
        >
          <Campo
            rotulo={`Limite de usos de ${item.codigo}`}
            type="number" min={minimo} max={LIMITE_USOS_MAX} step={1}
            value={texto}
            onChange={(e) => aoEditar(e.target.value)}
            erro={erro}
            ajuda={`${item.usosRealizados ?? 0} já usados. Igualar o limite aos usos fecha o código.`}
            className="w-full sm:w-72"
          />
          <Botao type="submit" carregando={salvando} disabled={ocupado || Boolean(erro) || numero === item.limiteUsos}>Salvar limite</Botao>
        </form>
      )}
    </div>
  );
}
