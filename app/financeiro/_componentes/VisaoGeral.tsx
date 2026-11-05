"use client";

import { Aviso, Botao, Metrica, Secao, Selo, TabelaRolavel, classeTd, classeTh } from "@/app/components/ui";
import { Atualizando, Estado } from "@/app/components/Estado";
import { Copiavel } from "@/app/components/Copiavel";
import { formatarHora, formatarNumero } from "@/app/lib/formatar";
import type { IAutomaticLotOccupancy, IPaymentConfig } from "@/app/lib/types/payments/payment.t";
import { RefreshCw } from "lucide-react";
import { hasValidAutomaticStructure } from "./util";

const MODO = { automatico: "Automático", manual: "Manual" } as const;

interface Props {
  config: IPaymentConfig;
  /** null = a lista ainda não foi lida (ou a leitura falhou): o total aparece como indisponível, nunca 0. */
  totalInscritos: number | null;
  ocupacao: IAutomaticLotOccupancy | null;
  ocupacaoCarregando: boolean;
  ocupacaoErro: string | null;
  aoAtualizarOcupacao: () => void;
}

export function VisaoGeral({ config, totalInscritos, ocupacao, ocupacaoCarregando, ocupacaoErro, aoAtualizarOcupacao }: Props) {
  const automatico = config.modo === "automatico";
  const lotes = hasValidAutomaticStructure(config.configuracaoLotesAutomaticos?.lotes) ? config.configuracaoLotesAutomaticos!.lotes : null;
  const edicaoDivergente = ocupacao && config.edicaoId && ocupacao.edicaoId !== config.edicaoId.trim().toUpperCase();
  const saldo = ocupacao ? Math.max(0, ocupacao.capacidadeTotal - ocupacao.ocupadasEfetivas) : null;

  return (
    <Secao
      id="visao-geral"
      className="scroll-mt-4"
      titulo="Visão geral e ocupação"
      descricao="Resumo da configuração em uso e das vagas dos lotes."
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-sutil">Edição em uso</dt><dd className="mt-0.5 font-semibold">{config.edicaoId ?? "Não configurada"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-sutil">Nome da configuração</dt><dd className="mt-0.5">{config.nome}</dd></div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-sutil">Modo de venda</dt>
          <dd className="mt-0.5"><Selo tom={automatico ? "ok" : "neutro"}>{config.modo ? MODO[config.modo] : "Legado"}</Selo></dd>
        </div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-sutil">Documento da configuração</dt><dd className="mt-0.5"><Copiavel texto={config._id} rotulo="identificador da configuração" /></dd></div>
      </dl>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          rotulo="Pessoas inscritas"
          valor={totalInscritos === null ? null : formatarNumero(totalInscritos)}
          detalhe="Pessoas com inscrição confirmada, não transações"
        />
        <Metrica rotulo="Formas de pagamento aceitas" valor={formatarNumero(config.pagamentosAceitos?.length ?? 0)} />
        <Metrica
          rotulo={automatico ? "Lotes automáticos" : "Parcelamentos legados"}
          valor={automatico ? (lotes ? formatarNumero(lotes.length) : null) : formatarNumero(config.parcelamentos?.length ?? 0)}
        />
      </div>

      {!automatico ? (
        <Aviso tom="info">A ocupação por lote só existe no modo automático. Esta configuração não usa lotes automáticos.</Aviso>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Ocupação dos lotes</h3>
            <div className="flex items-center gap-3">
              <Atualizando ativo={ocupacaoCarregando && !!ocupacao} />
              <Botao estilo="contorno" tamanho="pequeno" carregando={ocupacaoCarregando} onClick={aoAtualizarOcupacao}>
                <RefreshCw className="size-4" aria-hidden="true" />Atualizar números
              </Botao>
            </div>
          </div>

          {ocupacaoErro && (
            <Aviso tom="erro" titulo="Não foi possível atualizar a ocupação">
              {ocupacaoErro}{ocupacao ? " Os últimos números calculados continuam na tela." : ""}
            </Aviso>
          )}

          {!ocupacao && ocupacaoCarregando && <Estado tipo="carregando" titulo="Calculando vendas e vagas disponíveis…" linhas={1} />}
          {!ocupacao && !ocupacaoCarregando && ocupacaoErro && <Estado tipo="erro" titulo="Ocupação indisponível" texto="Tente atualizar os números." aoTentar={aoAtualizarOcupacao} />}

          {ocupacao && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metrica rotulo="Vendas confirmadas" valor={formatarNumero(ocupacao.confirmadas.total)} detalhe={`${formatarNumero(ocupacao.confirmadas.legadas)} em registro antigo · ${formatarNumero(ocupacao.confirmadas.modernas)} em registro atual`} />
                <Metrica rotulo="Reservas em pagamento" valor={formatarNumero(ocupacao.reservasAtivas)} detalhe="Vagas seguradas por quem ainda está pagando" />
                <Metrica rotulo="Vagas ocupadas" valor={formatarNumero(ocupacao.ocupadasEfetivas)} detalhe="Vendas confirmadas + reservas" />
                <Metrica rotulo="Saldo de vagas" valor={formatarNumero(saldo)} detalhe={`Capacidade total: ${formatarNumero(ocupacao.capacidadeTotal)}`} />
              </div>
              <p className="text-xs text-sutil">
                Números da edição <strong>{ocupacao.edicaoId}</strong>, calculados às {formatarHora(ocupacao.calculadoEm)}. Só ingresso ocupa vaga:
                apresentação remota, organizador e profissional da saúde ficam fora da capacidade.
              </p>
              {edicaoDivergente && (
                <Aviso tom="alerta" titulo="Edição dos números diferente da configuração">
                  A configuração mostra {config.edicaoId}, mas a ocupação foi calculada para {ocupacao.edicaoId}. Atualize os números antes de decidir.
                </Aviso>
              )}
              {ocupacao.excedente > 0 && (
                <Aviso tom="alerta" titulo="Ocupação acima da capacidade">
                  A ocupação excede a capacidade configurada em {formatarNumero(ocupacao.excedente)} {ocupacao.excedente === 1 ? "vaga" : "vagas"}.
                </Aviso>
              )}
              <TabelaRolavel rotulo="Ocupação por lote">
                <thead>
                  <tr><th className={classeTh}>Lote</th><th className={`${classeTh} text-right`}>Limite</th><th className={`${classeTh} text-right`}>Ocupadas</th><th className={`${classeTh} text-right`}>Restantes</th></tr>
                </thead>
                <tbody>
                  {ocupacao.lotes.map((item) => {
                    const nome = lotes?.find((l) => l.codigo === item.codigo)?.nome;
                    return (
                      <tr key={item.codigo}>
                        <td className={classeTd}>{nome ?? "Lote"} <span className="text-sutil">(#{item.codigo})</span></td>
                        <td className={`${classeTd} num text-right`}>{formatarNumero(item.limiteVagas)}</td>
                        <td className={`${classeTd} num text-right`}>{formatarNumero(item.ocupadasEfetivas)}</td>
                        <td className={`${classeTd} num text-right font-semibold`}>{formatarNumero(item.restantes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </TabelaRolavel>
            </>
          )}
        </div>
      )}
    </Secao>
  );
}
