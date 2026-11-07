"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode, RefObject } from "react";
import { Download, X } from "lucide-react";
import { Botao, CampoBusca, Selo, TabelaRolavel, classeTd, classeTh } from "@/app/components/ui";
import { Estado } from "@/app/components/Estado";
import { Copiavel } from "@/app/components/Copiavel";
import { useAvisos } from "@/app/components/Avisos";
import { formatarHora } from "@/app/lib/formatar";
import { displayUserField, displayUserName } from "@/app/lib/users/admin-user-contract";
import type { AdminUserDetails, AdminUserSummary } from "@/app/lib/users/admin-user-contract";
import type { Leitura } from "./use-leitura-qr";
import type { Recente } from "./use-acoes-chamada";

// Peças que as duas chamadas (minicurso e palestra) dividem. A regra de cada atividade fica na própria página.

const consultaDesktop = "(min-width: 768px)";
/** Tabela no desktop, cartões no celular: renderiza só um dos dois (a lista pode ter centenas de pessoas). */
export function useDesktop() {
  return useSyncExternalStore(
    (aviso) => { const m = window.matchMedia(consultaDesktop); m.addEventListener("change", aviso); return () => m.removeEventListener("change", aviso); },
    () => window.matchMedia(consultaDesktop).matches,
    () => false,
  );
}

/** O campo de busca não repassa `ref`: o foco é devolvido por quem o envolve. */
export function useFocoBusca() {
  const ref = useRef<HTMLDivElement>(null);
  return { ref, focar: () => ref.current?.querySelector("input")?.focus({ preventScroll: true }) };
}

export function BuscaChamada({ valor, aoMudar, dica, foco }: { valor: string; aoMudar: (v: string) => void; dica: string; foco: RefObject<HTMLDivElement> }) {
  return (
    <div ref={foco} className="min-w-0 flex-1">
      <CampoBusca rotulo="Buscar pessoa na lista" placeholder={dica} value={valor} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  );
}

export type Filtro = "todos" | "ausentes" | "presentes";
export function FiltroPresenca({ valor, aoMudar, rotulos }: { valor: Filtro; aoMudar: (f: Filtro) => void; rotulos: Record<Filtro, string> }) {
  return (
    <div role="group" aria-label="Mostrar na lista" className="flex flex-wrap gap-2">
      {(["todos", "ausentes", "presentes"] as const).map((f) => (
        <Botao key={f} tamanho="pequeno" estilo={valor === f ? "principal" : "contorno"} aria-pressed={valor === f} onClick={() => aoMudar(f)}>
          {rotulos[f]}
        </Botao>
      ))}
    </div>
  );
}

const TOM = { ok: "bg-ok-fundo text-ok", alerta: "bg-alerta-fundo text-alerta", info: "bg-info-fundo text-info", neutro: "bg-recuo text-tinta" } as const;
export interface Observacao { tom: keyof typeof TOM; texto: string }

/** Avisos que a equipe precisa ler antes de dar presença: ingresso e cadastro. */
export function observacoesBase(u: AdminUserSummary): Observacao[] {
  const s = u.pagamento.situacao;
  const itens: Observacao[] = [];
  if (s === 2) itens.push({ tom: "alerta", texto: "O pagamento do ingresso do congresso está pendente." });
  else if (s === 0) itens.push({ tom: "alerta", texto: "O ingresso do congresso não foi pago." });
  else if (s !== 1) itens.push({ tom: "alerta", texto: "O pagamento do ingresso do congresso não está confirmado." });
  if (u.cadastroPendente) itens.push({ tom: "alerta", texto: "Cadastro pendente: faltam dados pessoais." });
  return itens;
}

export function ListaObservacoes({ itens }: { itens: Observacao[] }) {
  if (!itens.length) return null;
  return (
    <ul className="grid gap-1.5">
      {itens.map((o) => <li key={o.texto} className={`rounded-lg px-3 py-2 text-sm ${TOM[o.tom]}`}>{o.texto}</li>)}
    </ul>
  );
}

/** Selos ao lado do nome, para o que a pessoa da porta precisa notar sem abrir nada. */
export function MarcasPessoa({ u, extra }: { u: AdminUserSummary; extra?: ReactNode }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {u.pagamento.situacao !== 1 && <Selo tom="alerta">Ingresso não confirmado</Selo>}
      {u.cadastroPendente && <Selo tom="alerta">Cadastro pendente</Selo>}
      {extra}
    </span>
  );
}

export interface ColunaChamada { titulo: string; render: (u: AdminUserSummary) => ReactNode }

export function ListaChamada({ rotulo, pessoas, colunas, extraNome, acoes, classeTabela = "" }: {
  rotulo: string;
  pessoas: AdminUserSummary[];
  colunas: ColunaChamada[];
  extraNome?: (u: AdminUserSummary) => ReactNode;
  acoes?: (u: AdminUserSummary) => ReactNode;
  /** Classe literal (o Tailwind não lê classe montada), ex.: "[&_table]:min-w-[60rem]". */
  classeTabela?: string;
}) {
  const desktop = useDesktop();

  if (desktop) {
    return (
      <TabelaRolavel rotulo={rotulo} className={classeTabela}>
        <caption className="sr-only">{rotulo}</caption>
        <thead>
          <tr>
            <th scope="col" className={classeTh}>Nome</th>
            <th scope="col" className={classeTh}>E-mail</th>
            {colunas.map((c) => <th key={c.titulo} scope="col" className={classeTh}>{c.titulo}</th>)}
            {acoes && <th scope="col" className={`${classeTh} text-right`}>Ação</th>}
          </tr>
        </thead>
        <tbody>
          {pessoas.map((u) => (
            <tr key={u._id}>
              <th scope="row" className={`${classeTd} max-w-72 text-left font-medium`}>
                <span className="block break-words">{displayUserName(u)}</span>
                {extraNome?.(u)}
              </th>
              <td className={`${classeTd} max-w-64 break-all text-sutil`}>{displayUserField(u.informacoes_usuario.email)}</td>
              {colunas.map((c) => <td key={c.titulo} className={classeTd}>{c.render(u)}</td>)}
              {acoes && <td className={`${classeTd} whitespace-nowrap text-right`}><div className="flex justify-end gap-2">{acoes(u)}</div></td>}
            </tr>
          ))}
        </tbody>
      </TabelaRolavel>
    );
  }

  return (
    <ul aria-label={rotulo} className="grid gap-3">
      {pessoas.map((u) => (
        <li key={u._id} className="grid gap-3 rounded-2xl bg-cartao p-4 ring-1 ring-linha/60">
          <div className="min-w-0">
            <p className="break-words font-semibold">{displayUserName(u)}</p>
            <p className="break-all text-sm text-sutil">{displayUserField(u.informacoes_usuario.email)}</p>
            {extraNome && <div className="mt-1.5">{extraNome(u)}</div>}
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {colunas.map((c) => (
              <div key={c.titulo}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-sutil">{c.titulo}</dt>
                <dd className="mt-0.5">{c.render(u)}</dd>
              </div>
            ))}
          </dl>
          {acoes && <div className="flex flex-wrap gap-2 [&>button]:flex-1">{acoes(u)}</div>}
        </li>
      ))}
    </ul>
  );
}

export function Recentes({ itens }: { itens: Recente[] }) {
  return (
    <div className="grid content-start gap-2">
      <h3 className="titulo text-lg">Acabaram de entrar</h3>
      {itens.length === 0
        ? <p className="text-sm text-sutil">Ninguém registrado nesta tela ainda. Quem for registrado aparece aqui, do mais novo para o mais antigo.</p>
        : (
          <ol className="grid gap-1.5">
            {itens.map((r) => (
              <li key={r.id} className="flex items-baseline gap-3 rounded-xl bg-recuo/60 px-3 py-2 text-sm">
                <span className="num shrink-0 font-semibold">{formatarHora(r.quando)}</span>
                <span className="min-w-0"><span className="block break-words font-medium">{r.nome}</span><span className="text-xs text-sutil">{r.detalhe}</span></span>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}

/** Moldura do resultado de uma leitura de QR. O conteúdo da pessoa (avisos e botões) vem da página. */
export function ResultadoLeitura({ leitura, aoFechar, children }: {
  leitura: Leitura;
  aoFechar: () => void;
  children?: (pessoa: AdminUserDetails) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pronto = leitura.estado === "ok";
  // o botão principal da página leva `data-principal`: quem acabou de ler só precisa confirmar
  useEffect(() => {
    if (pronto) ref.current?.querySelector<HTMLElement>("[data-principal]")?.focus();
  }, [pronto, leitura.lido]);

  return (
    <div ref={ref} role="region" aria-label="Resultado da leitura" aria-live="polite" className="grid gap-3 rounded-2xl bg-cartao p-4 ring-2 ring-tinta/15">
      {leitura.estado === "buscando" && <Estado tipo="carregando" titulo="Consultando a credencial…" linhas={1} />}
      {leitura.estado === "invalida" && (
        <>
          <p className="rounded-xl bg-erro-fundo px-4 py-3 text-sm text-erro">
            <span className="font-semibold">Leitura inválida.</span> {leitura.mensagem} A lista não foi alterada e a câmera continua ligada.
          </p>
          <div><Botao estilo="fantasma" tamanho="pequeno" onClick={aoFechar}><X className="size-4" aria-hidden="true" />Dispensar</Botao></div>
        </>
      )}
      {leitura.estado === "ok" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-sutil">Credencial lida</p>
              <p className="titulo break-words text-xl leading-snug">{displayUserName(leitura.pessoa)}</p>
              <p className="break-all text-sm text-sutil">{displayUserField(leitura.pessoa.informacoes_usuario.email)}</p>
            </div>
            <Botao estilo="fantasma" tamanho="pequeno" onClick={aoFechar} aria-label="Fechar resultado da leitura"><X className="size-4" aria-hidden="true" /></Botao>
          </div>
          {children?.(leitura.pessoa)}
          <details className="text-sm">
            <summary className="cursor-pointer text-sutil">Mais dados e código da credencial</summary>
            <dl className="mt-2 grid gap-1.5">
              <div><dt className="inline text-sutil">CPF: </dt><dd className="inline">{displayUserField(leitura.pessoa.informacoes_usuario.cpf)}</dd></div>
              <div><dt className="inline text-sutil">Telefone: </dt><dd className="inline">{displayUserField(leitura.pessoa.informacoes_usuario.numero_telefone)}</dd></div>
              <div><dt className="inline text-sutil">Código: </dt><dd className="inline"><Copiavel texto={leitura.pessoa._id} rotulo="código da credencial" /></dd></div>
            </dl>
          </details>
        </>
      )}
    </div>
  );
}

/** Exporta com a contagem no botão. O arquivo é montado só quando se clica (a biblioteca é pesada). */
export function BotaoExportar({ rotulo, gerar, desabilitado }: { rotulo: string; gerar: () => Promise<void>; desabilitado?: boolean }) {
  const { avisar } = useAvisos();
  const [gerando, setGerando] = useState(false);
  return (
    <Botao
      estilo="contorno"
      carregando={gerando}
      disabled={desabilitado}
      onClick={async () => {
        setGerando(true);
        try { await gerar(); } catch { avisar("erro", "Não foi possível gerar a planilha", "Tente de novo. Se persistir, recarregue a página."); }
        finally { setGerando(false); }
      }}
    >
      <Download className="size-4" aria-hidden="true" />{rotulo}
    </Botao>
  );
}
