"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CalendarClock, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Botao, BotaoLink, CampoBusca, Escolha, Selo } from "./ui";
import type { EstiloBotao } from "./ui";
import { Atualizando, Estado } from "./Estado";
import { Copiavel } from "./Copiavel";
import { useAvisos } from "./Avisos";
import { formatarData, formatarDataHora, formatarHora, formatarMoeda, formatarNumero } from "@/app/lib/formatar";
import { parseDataArrayPayload } from "@/app/lib/api-data-contract";
import type { ICourse, ILecture } from "@/app/lib/types/events/event.t";

// Catálogo compartilhado de atividades (Presença, Listas e Gestão de atividades): carga, busca, filtros e cartão.
// Cada tela diz o que se pode fazer com o cartão (editar, tirar presença, imprimir) pela lista de ações.

export interface ItemCatalogo {
  id: string;
  nome: string;
  tipo: string;
  natureza: "minicurso" | "palestra";
  inscritos?: number;
  vagas?: number;
  presentes?: number;
  periodo?: string;
  local?: string;
  nota?: string;
  visivel?: boolean;
  abertas?: boolean;
  gratuita?: boolean;
  valor?: number;
}

export interface AcaoCartao {
  rotulo: string;
  icone?: LucideIcon;
  href?: string;
  novaAba?: boolean;
  onClick?: () => void;
  estilo?: EstiloBotao;
  carregando?: boolean;
}

export interface FiltroExtra {
  chave: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  casa: (item: ItemCatalogo, valor: string) => boolean;
}

type Etapa = { date_init?: unknown; date_end?: unknown; local?: unknown };

function resumoEtapas(timeline: unknown): Pick<ItemCatalogo, "periodo" | "local"> {
  const etapas = (Array.isArray(timeline) ? timeline : []) as Etapa[];
  const inicios = etapas.map((e) => e?.date_init).filter((v): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)));
  const fins = etapas.map((e) => e?.date_end).filter((v): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)));
  const locais = [...new Set(etapas.map((e) => (typeof e?.local === "string" ? e.local.trim() : "")).filter(Boolean))];
  const ordenar = (l: string[]) => [...l].sort((a, b) => Date.parse(a) - Date.parse(b));
  const ini = ordenar(inicios)[0];
  const fim = ordenar(fins).at(-1);
  let periodo: string | undefined;
  if (ini) {
    periodo = formatarDataHora(ini);
    if (fim && fim !== ini) periodo += ` até ${formatarData(ini) === formatarData(fim) ? formatarHora(fim) : formatarDataHora(fim)}`;
    if (etapas.length > 1) periodo += ` · ${etapas.length} etapas`;
  }
  return { periodo, local: locais.join(" · ") || undefined };
}

export function deMinicurso(c: ICourse): ItemCatalogo {
  return {
    id: c._id, nome: c.name, tipo: c.type, natureza: "minicurso",
    inscritos: c.participants.length, vagas: c.maxParticipants,
    presentes: Array.isArray(c.attendanceList) ? c.attendanceList.length : undefined,
    visivel: c.showToUser === true, abertas: c.isOpen === true, gratuita: c.isFree === true, valor: c.value,
    ...resumoEtapas(c.timeline),
  };
}

export function dePalestra(l: ILecture): ItemCatalogo {
  return { id: l._id, nome: l.name, tipo: l.type, natureza: "palestra", ...resumoEtapas(l.timeline) };
}

const ehRegistro = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ehMinicurso = (v: unknown): v is ICourse =>
  ehRegistro(v) && typeof v._id === "string" && typeof v.name === "string" && typeof v.type === "string"
  && typeof v.maxParticipants === "number" && Number.isFinite(v.maxParticipants)
  && Array.isArray(v.participants) && v.participants.every((id) => typeof id === "string");
const ehPalestra = (v: unknown): v is ILecture =>
  ehRegistro(v) && typeof v._id === "string" && typeof v.name === "string" && typeof v.type === "string";

/** Carrega minicursos (e, se pedido, palestras) em paralelo. Atualização que falha mantém a última lista válida e avisa. */
export function useCatalogo({ palestras }: { palestras: boolean }) {
  const { avisar } = useAvisos();
  const [cursos, setCursos] = useState<ICourse[] | null>(null);
  const [lista, setLista] = useState<ILecture[]>([]);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const temDados = useRef(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [rc, rp] = await Promise.all([fetch("/api/get/listaMinicursos"), palestras ? fetch("/api/get/listaPalestras") : null]);
      if (!rc.ok || (rp && !rp.ok)) throw new Error("resposta com erro");
      const [pc, pp] = await Promise.all([rc.json().catch(() => null), rp ? rp.json().catch(() => null) : Promise.resolve({ data: [] })]);
      const c = parseDataArrayPayload(pc, ehMinicurso);
      const p = parseDataArrayPayload(pp, ehPalestra);
      if (!c || !p) throw new Error("formato inesperado");
      setCursos(c);
      setLista(p);
      setErro(false);
      temDados.current = true;
    } catch {
      if (temDados.current) avisar("erro", "Não foi possível atualizar a lista", "Estamos mostrando a última lista carregada. Tente de novo em instantes.");
      else setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [palestras, avisar]);

  useEffect(() => { void carregar(); }, [carregar]);

  const estado: "carregando" | "erro" | "ok" = cursos ? "ok" : erro ? "erro" : "carregando";
  return { cursos: cursos ?? [], palestras: lista, estado, atualizando: carregando && !!cursos, recarregar: carregar };
}

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function CartaoAtividade({ item, acoes, mostrarSituacao, mostrarPresentes }: {
  item: ItemCatalogo; acoes: AcaoCartao[]; mostrarSituacao?: boolean; mostrarPresentes?: boolean;
}) {
  const vagas = item.vagas ?? 0;
  const inscritos = item.inscritos ?? 0;
  const pct = vagas > 0 ? Math.min(100, Math.round((inscritos / vagas) * 100)) : 0;
  return (
    <li className="grid content-start gap-3 rounded-2xl bg-cartao p-5 shadow-[0_1px_0_var(--linha)] ring-1 ring-linha/60">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo>{item.tipo || "Sem tipo"}</Selo>
        {mostrarSituacao && item.natureza === "minicurso" && (
          <>
            <Selo tom={item.visivel ? "ok" : "neutro"}>{item.visivel ? "Visível ao usuário" : "Oculta ao usuário"}</Selo>
            <Selo tom={item.abertas ? "info" : "neutro"}>{item.abertas ? "Inscrições abertas" : "Inscrições encerradas"}</Selo>
            <Selo tom={item.gratuita ? "ok" : "alerta"}>{item.gratuita ? "Gratuita" : `Paga · ${formatarMoeda(item.valor)}`}</Selo>
          </>
        )}
        {vagas > 0 && inscritos > vagas && <Selo tom="alerta">Acima do limite de vagas</Selo>}
      </div>

      <h2 className="titulo break-words text-lg leading-snug">{item.nome}</h2>

      {(item.periodo || item.local) && (
        <ul className="grid gap-1 text-sm text-sutil">
          {item.periodo && <li className="flex items-start gap-2"><CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="num">{item.periodo}</span></li>}
          {item.local && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="break-words">{item.local}</span></li>}
        </ul>
      )}

      {item.natureza === "minicurso" ? (
        <div>
          <p className="num text-sm">
            <strong>{formatarNumero(inscritos)}</strong> inscritos{vagas > 0 ? ` de ${formatarNumero(vagas)} vagas · ${formatarNumero(Math.max(0, vagas - inscritos))} restantes` : " · limite de vagas não definido"}
            {mostrarPresentes && item.presentes !== undefined && <> · <strong>{formatarNumero(item.presentes)}</strong> com presença</>}
          </p>
          {vagas > 0 && (
            <div role="progressbar" aria-label="Vagas preenchidas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-recuo">
              <div className="h-full rounded-full bg-tinta" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-sutil">Aberta a todos os congressistas com inscrição confirmada.</p>
      )}

      {item.nota && <p className="rounded-xl bg-info-fundo px-3 py-2 text-sm text-info">{item.nota}</p>}

      <p className="flex flex-wrap items-center gap-1.5 text-xs text-sutil">Código <Copiavel texto={item.id} rotulo={`código de ${item.nome}`} /></p>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {acoes.map((a) => {
          const Icone = a.icone;
          const rotuloAria = `${a.rotulo}: ${item.nome}`;
          const conteudo = <>{Icone && <Icone className="size-4" aria-hidden="true" />}{a.rotulo}{a.novaAba && <span className="sr-only"> (abre em nova aba)</span>}</>;
          return a.href ? (
            <BotaoLink key={a.rotulo} href={a.href} prefetch={false} target={a.novaAba ? "_blank" : undefined} rel={a.novaAba ? "noopener" : undefined} estilo={a.estilo ?? "contorno"} aria-label={rotuloAria}>{conteudo}</BotaoLink>
          ) : (
            <Botao key={a.rotulo} estilo={a.estilo ?? "contorno"} onClick={a.onClick} carregando={a.carregando} aria-label={rotuloAria}>{conteudo}</Botao>
          );
        })}
      </div>
    </li>
  );
}

export function CatalogoAtividades({ itens, estado, atualizando, aoTentar, acoes, filtros = [], mostrarSituacao, mostrarPresentes, acaoVazio, textoVazio }: {
  itens: ItemCatalogo[];
  estado: "carregando" | "erro" | "ok";
  atualizando?: boolean;
  aoTentar: () => void;
  acoes: (item: ItemCatalogo) => AcaoCartao[];
  filtros?: FiltroExtra[];
  mostrarSituacao?: boolean;
  mostrarPresentes?: boolean;
  acaoVazio?: ReactNode;
  textoVazio?: string;
}) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [natureza, setNatureza] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});

  const tipos = useMemo(() => [...new Set(itens.map((i) => i.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [itens]);
  const temAmbas = itens.some((i) => i.natureza === "minicurso") && itens.some((i) => i.natureza === "palestra");

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return itens.filter((i) =>
      (!termo || semAcento(i.nome).includes(termo) || i.id.toLowerCase().includes(termo))
      && (!tipo || i.tipo === tipo)
      && (!natureza || i.natureza === natureza)
      && filtros.every((f) => !extras[f.chave] || f.casa(i, extras[f.chave])));
  }, [itens, busca, tipo, natureza, extras, filtros]);

  const filtrando = !!(busca || tipo || natureza || Object.values(extras).some(Boolean));
  const limpar = () => { setBusca(""); setTipo(""); setNatureza(""); setExtras({}); };

  if (estado === "carregando") return <Estado tipo="carregando" titulo="Carregando atividades…" />;
  if (estado === "erro") return <Estado tipo="erro" titulo="Não foi possível carregar as atividades" texto="Verifique sua conexão e tente de novo." aoTentar={aoTentar} />;
  if (itens.length === 0) return <Estado tipo="vazio" titulo="Nenhuma atividade cadastrada" texto={textoVazio} acao={acaoVazio} />;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CampoBusca rotulo="Buscar atividade por nome ou código" placeholder="Buscar por nome ou código…" value={busca} onChange={(e) => setBusca(e.target.value)} className="sm:col-span-2 lg:col-span-4" />
        {temAmbas && (
          <Escolha rotulo="Modalidade" value={natureza} onChange={(e) => setNatureza(e.target.value)}>
            <option value="">Todas</option>
            <option value="minicurso">Minicursos</option>
            <option value="palestra">Palestras</option>
          </Escolha>
        )}
        <Escolha rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </Escolha>
        {filtros.map((f) => (
          <Escolha key={f.chave} rotulo={f.rotulo} value={extras[f.chave] ?? ""} onChange={(e) => setExtras((a) => ({ ...a, [f.chave]: e.target.value }))}>
            <option value="">Todas</option>
            {f.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </Escolha>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" aria-live="polite" className="text-sm text-sutil">
          {visiveis.length === itens.length ? `${formatarNumero(itens.length)} atividades` : `${formatarNumero(visiveis.length)} de ${formatarNumero(itens.length)} atividades`}
        </p>
        <div className="flex items-center gap-3">
          <Atualizando ativo={!!atualizando} />
          {filtrando && <Botao estilo="fantasma" tamanho="pequeno" onClick={limpar}>Limpar filtros</Botao>}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <Estado tipo="semResultado" acao={<Botao estilo="contorno" onClick={limpar}>Limpar filtros</Botao>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((item) => (
            <CartaoAtividade key={`${item.natureza}-${item.id}`} item={item} acoes={acoes(item)} mostrarSituacao={mostrarSituacao} mostrarPresentes={mostrarPresentes} />
          ))}
        </ul>
      )}
    </div>
  );
}
