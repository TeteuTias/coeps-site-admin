'use client'
import { useMemo, useState } from 'react';
import { Aviso, Botao, Metrica, Selo, TabelaRolavel, classeTd, classeTh } from '@/app/components/ui';
import { formatarNumero } from '@/app/lib/formatar';

// Três estados, porque o que fazer depois é diferente em cada um:
//  enviado   - o provedor confirmou.
//  recusado  - o provedor disse que não enviou (ou o lote nem chegou a sair): repetir é seguro.
//  pendente  - sem resposta confiável: o e-mail pode ter saído; conferir antes de repetir.
export type EstadoEnvio = 'enviado' | 'recusado' | 'pendente';

export interface ResultadoEnvio {
  trabalhoId: string;
  email: string;
  estado: EstadoEnvio;
  erro?: string;
}

export const chaveResultado = (r: Pick<ResultadoEnvio, 'trabalhoId' | 'email'>) => `${r.trabalhoId}:${r.email}`;

const plural = (n: number, singular: string, pluralForm: string) => `${formatarNumero(n)} ${n === 1 ? singular : pluralForm}`;

export function ResultadoEnvioPainel({ resultados, tituloDoTrabalho, ocupado, cotaRestante, aoReenviar }: {
  resultados: ResultadoEnvio[];
  tituloDoTrabalho: (id: string) => string;
  ocupado: boolean;
  cotaRestante: number | null;
  aoReenviar: (alvos: ResultadoEnvio[], pendentes: boolean) => void;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const { enviados, recusados, pendentes } = useMemo(() => ({
    enviados: resultados.filter(r => r.estado === 'enviado'),
    recusados: resultados.filter(r => r.estado === 'recusado'),
    pendentes: resultados.filter(r => r.estado === 'pendente'),
  }), [resultados]);

  const motivos = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const r of recusados) {
      const motivo = r.erro || 'Falha ao enviar.';
      contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
    }
    return Array.from(contagem);
  }, [recusados]);

  // Só vale marcação de quem ainda está pendente (após uma retentativa a lista muda).
  const pendentesMarcados = pendentes.filter(r => marcados.has(chaveResultado(r)));
  const todosMarcados = pendentes.length > 0 && pendentesMarcados.length === pendentes.length;

  const alternar = (chave: string) => setMarcados(anterior => {
    const proximo = new Set(anterior);
    if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
    return proximo;
  });

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Enviados" valor={formatarNumero(enviados.length)} detalhe="Confirmados pelo provedor de e-mail" />
        <Metrica rotulo="Recusados" valor={formatarNumero(recusados.length)} detalhe="Não saíram; é seguro tentar de novo" />
        <Metrica rotulo="Pendentes de confirmação" valor={formatarNumero(pendentes.length)} detalhe="Podem ter saído; confira antes de repetir" />
      </div>
      {cotaRestante !== null && <p className="text-sm text-sutil">Cota de envios restante hoje: <span className="num font-semibold text-tinta">{formatarNumero(cotaRestante)}</span>.</p>}

      {recusados.length > 0 && (
        <section aria-labelledby="res-recusados" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="res-recusados" className="titulo flex items-center gap-2 text-lg">Recusados <Selo tom="erro">{plural(recusados.length, 'destinatário', 'destinatários')}</Selo></h3>
            <Botao estilo="contorno" carregando={ocupado} onClick={() => aoReenviar(recusados, false)}>
              Tentar de novo os {plural(recusados.length, 'recusado', 'recusados')}
            </Botao>
          </div>
          <ul className="grid gap-1.5 text-sm" aria-label="Motivos das recusas">
            {motivos.map(([motivo, quantidade]) => (
              <li key={motivo} className="flex flex-wrap items-center gap-2">
                <Selo tom="neutro">{formatarNumero(quantidade)}</Selo>
                <span>{motivo}</span>
              </li>
            ))}
          </ul>
          <TabelaRolavel rotulo="Destinatários recusados" className="max-h-96 overflow-y-auto">
            <thead><tr><th className={classeTh}>Destinatário</th><th className={classeTh}>Trabalho</th><th className={classeTh}>Situação</th><th className={classeTh}>Motivo</th></tr></thead>
            <tbody>
              {recusados.map(r => (
                <tr key={chaveResultado(r)}>
                  <td className={`${classeTd} break-all`}>{r.email}</td>
                  <td className={classeTd}>{tituloDoTrabalho(r.trabalhoId)}</td>
                  <td className={classeTd}><Selo tom="erro">Recusado</Selo></td>
                  <td className={classeTd}>{r.erro || 'Falha ao enviar.'}</td>
                </tr>
              ))}
            </tbody>
          </TabelaRolavel>
        </section>
      )}

      {pendentes.length > 0 && (
        <section aria-labelledby="res-pendentes" className="grid gap-3">
          <h3 id="res-pendentes" className="titulo flex items-center gap-2 text-lg">Pendentes de confirmação <Selo tom="alerta">{plural(pendentes.length, 'destinatário', 'destinatários')}</Selo></h3>
          <Aviso tom="alerta" titulo="O provedor pode ter enviado estes e-mails.">
            Não houve resposta confiável. Confira a caixa de enviados da conta remetente antes de repetir: reenviar pode fazer a pessoa receber a mensagem duas vezes. A retentativa dos recusados não inclui estes.
          </Aviso>
          <TabelaRolavel rotulo="Destinatários pendentes de confirmação" className="max-h-96 overflow-y-auto">
            <thead>
              <tr>
                <th className={classeTh}>Reenviar</th><th className={classeTh}>Destinatário</th><th className={classeTh}>Trabalho</th><th className={classeTh}>Situação</th><th className={classeTh}>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map(r => (
                <tr key={chaveResultado(r)}>
                  <td className={classeTd}>
                    <input
                      type="checkbox"
                      className="size-5"
                      aria-label={`Reenviar para ${r.email}`}
                      checked={marcados.has(chaveResultado(r))}
                      onChange={() => alternar(chaveResultado(r))}
                    />
                  </td>
                  <td className={`${classeTd} break-all`}>{r.email}</td>
                  <td className={classeTd}>{tituloDoTrabalho(r.trabalhoId)}</td>
                  <td className={classeTd}><Selo tom="alerta">Pendente de confirmação</Selo></td>
                  <td className={classeTd}>{r.erro || 'Sem confirmação do provedor.'}</td>
                </tr>
              ))}
            </tbody>
          </TabelaRolavel>
          <div className="flex flex-wrap gap-2">
            <Botao estilo="contorno" tamanho="pequeno" onClick={() => setMarcados(todosMarcados ? new Set() : new Set(pendentes.map(chaveResultado)))}>
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </Botao>
            <Botao estilo="perigo" carregando={ocupado} disabled={pendentesMarcados.length === 0} onClick={() => aoReenviar(pendentesMarcados, true)}>
              Reenviar {plural(pendentesMarcados.length, 'marcado', 'marcados')}, já conferi
            </Botao>
          </div>
        </section>
      )}

      {enviados.length > 0 && (
        <details className="rounded-2xl bg-cartao px-4 py-3 ring-1 ring-linha/60">
          <summary className="cursor-pointer text-sm font-semibold">Ver os {plural(enviados.length, 'enviado', 'enviados')}</summary>
          <div className="mt-3">
            <TabelaRolavel rotulo="Destinatários com envio confirmado" className="max-h-96 overflow-y-auto">
              <thead><tr><th className={classeTh}>Destinatário</th><th className={classeTh}>Trabalho</th><th className={classeTh}>Situação</th></tr></thead>
              <tbody>
                {enviados.map(r => (
                  <tr key={chaveResultado(r)}>
                    <td className={`${classeTd} break-all`}>{r.email}</td>
                    <td className={classeTd}>{tituloDoTrabalho(r.trabalhoId)}</td>
                    <td className={classeTd}><Selo tom="ok">Enviado</Selo></td>
                  </tr>
                ))}
              </tbody>
            </TabelaRolavel>
          </div>
        </details>
      )}
    </div>
  );
}
