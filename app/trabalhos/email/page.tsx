'use client'
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Send } from 'lucide-react';
import { Aviso, Botao, Caixa, Campo, CampoBusca, Escolha, Metrica, Pagina, Cabecalho, Secao, Selo } from '@/app/components/ui';
import { Estado } from '@/app/components/Estado';
import { useAvisos } from '@/app/components/Avisos';
import { formatarDataHora, formatarNumero } from '@/app/lib/formatar';
import { IAcademicWorks } from '@/app/lib/types/academicWorks/academicWorks.t';
import { IUser } from '@/app/lib/types/user/user.t';
import {
  WORK_EMAIL_LIMITS,
  WORK_EMAIL_VARIABLES,
  buildWorkEmailMessage,
  chunkWorkIds,
  countUniqueEmails,
  htmlToPlainText,
  resolveWorkRecipients,
  type WorkEmailAudience,
  type WorkEmailWork,
} from '@/app/lib/trabalhos/work-email';
import { ResultadoEnvioPainel, chaveResultado, type EstadoEnvio, type ResultadoEnvio } from './_componentes/ResultadoEnvio';

type Modo = 'todos' | 'escolher';

// Registros legados podem não ter data de submissão.
type PageWork = WorkEmailWork & { submetidoEm: number | null };

interface SendJob {
  trabalhoIds: string[];
  somenteEmails?: string[];
}

interface Envio {
  fase: 'parado' | 'enviando' | 'concluido';
  total: number;
  feitos: number;
  resultados: ResultadoEnvio[];
  cotaRestante: number | null;
}

const ENVIO_INICIAL: Envio = { fase: 'parado', total: 0, feitos: 0, resultados: [], cotaRestante: null };
const TODOS_OS_EMAILS: WorkEmailAudience = { remetente: true, autores: true };
const STATUS_OPTIONS = ['Todos', 'Aceito', 'Recusado', 'Necessita de Alteração', 'Em Avaliação'];
const ENVIO_COLETIVO = 10;
const CONFERIR = 'O provedor pode ter enviado: confira a caixa de enviados antes de repetir.';

// Fora do componente: o Quill reinicia o editor se o objeto de módulos mudar a cada render.
const MODULOS_EDITOR = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const plural = (count: number, singular: string, pluralForm: string) =>
  `${formatarNumero(count)} ${count === 1 ? singular : pluralForm}`;

// A API não devolve um campo próprio para "pendente". Pelo que ela faz hoje: falha de rede, resposta
// malformada, erro 5xx (inclusive tempo esgotado) e o 424 "confira a caixa de enviados" são ambíguos;
// o resto (validação, 409 sem configuração, recusa do script) garante que nada saiu.
function classificarFalhaDoLote(status: number | null, mensagem: string): { estado: EstadoEnvio; erro: string } {
  if (status === null) return { estado: 'pendente', erro: `Sem resposta do servidor durante o envio. ${CONFERIR}` };
  if (status === 424 && /caixa de enviados/i.test(mensagem)) return { estado: 'pendente', erro: `${mensagem} ${CONFERIR}` };
  if (status >= 500) return { estado: 'pendente', erro: `O servidor não respondeu corretamente. ${CONFERIR}` };
  return { estado: 'recusado', erro: mensagem };
}

// O Quill gera h1/h2; na pré-visualização viram parágrafos para não criar títulos extras na página.
const semTitulosDaPagina = (html: string) => html
  .replace(/<h1(\s|>)/g, '<p class="text-xl font-bold"$1')
  .replace(/<h2(\s|>)/g, '<p class="text-lg font-bold"$1')
  .replace(/<\/h[12]>/g, '</p>');

export default function EmailTrabalhosPage() {
  const { avisar, confirmar } = useAvisos();

  const [carga, setCarga] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [works, setWorks] = useState<PageWork[]>([]);

  const [modo, setModo] = useState<Modo>('escolher');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [modalidadeFilter, setModalidadeFilter] = useState('Todas');
  const [submetidosDesde, setSubmetidosDesde] = useState('');
  const [submetidosAte, setSubmetidosAte] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [publico, setPublico] = useState<WorkEmailAudience>({ remetente: true, autores: false });

  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');

  const [envio, setEnvio] = useState<Envio>(ENVIO_INICIAL);
  const [publicoEnviado, setPublicoEnviado] = useState<WorkEmailAudience>(TODOS_OS_EMAILS);
  const [formError, setFormError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ tom: 'ok' | 'erro' | 'alerta'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  // Trava síncrona: dois cliques rápidos não podem abrir dois envios reais.
  const ocupadoRef = useRef(false);

  // null = estado ainda desconhecido (carregando ou script indisponível)
  const [autoAtivo, setAutoAtivo] = useState<boolean | null>(null);
  const [autoErro, setAutoErro] = useState<string | null>(null);
  const [autoSalvando, setAutoSalvando] = useState(true);

  const sincronizarAuto = useCallback(async (ativo?: boolean) => {
    setAutoSalvando(true);
    setAutoErro(null);
    try {
      const response = await fetch('/api/post/trabalhos/email/confirmacao-automatica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ativo === undefined ? {} : { ativo }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && typeof payload?.data?.ativo === 'boolean') {
        setAutoAtivo(payload.data.ativo);
        if (ativo !== undefined) avisar('ok', payload.data.ativo ? 'Confirmação automática ativada' : 'Confirmação automática desativada');
      } else {
        setAutoErro(payload?.message || 'Não foi possível consultar a confirmação automática.');
      }
    } catch {
      setAutoErro(
        ativo === undefined
          ? 'Sem resposta ao consultar a confirmação automática. Tente de novo.'
          : 'Sem resposta ao salvar a confirmação automática. Consulte o estado atual antes de repetir.',
      );
    } finally {
      setAutoSalvando(false);
    }
  }, [avisar]);

  useEffect(() => {
    void sincronizarAuto();
  }, [sincronizarAuto]);

  const handleToggleAuto = async () => {
    if (autoAtivo === null) return;
    const novo = !autoAtivo;
    const confirmado = await confirmar(novo
      ? {
        titulo: 'Ativar a confirmação automática?',
        descricao: 'Cada novo trabalho submetido passará a gerar um e-mail de confirmação de recebimento para quem submeteu e para os autores.',
        rotuloConfirmar: 'Ativar',
      }
      : {
        titulo: 'Desativar a confirmação automática?',
        descricao: 'Novas submissões deixarão de receber o e-mail de confirmação.',
        rotuloConfirmar: 'Desativar',
      });
    if (confirmado) void sincronizarAuto(novo);
  };

  const carregarTrabalhos = useCallback(async () => {
    setCarga('carregando');
    try {
      const response = await fetch('/api/get/trabalhos-avaliacoes');
      if (!response.ok) throw new Error('Falha ao buscar dados');
      const { data, users } = await response.json() as { data: IAcademicWorks[]; users: IUser[] };
      const usersById = new Map(users.map(user => [`${user._id}`, user.informacoes_usuario]));
      setWorks([...data].reverse().map((trabalho): PageWork => ({
        id: `${trabalho._id}`,
        titulo: trabalho.titulo,
        modalidade: trabalho.modalidade,
        status: trabalho.status,
        autores: trabalho.autores,
        remetente: usersById.get(`${trabalho.userId}`) ?? null,
        submetidoEm: Date.parse(`${trabalho.dataSubmissao}`) || null,
      })));
      setCarga('ok');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setCarga('erro');
    }
  }, []);

  useEffect(() => {
    void carregarTrabalhos();
  }, [carregarTrabalhos]);

  const worksById = useMemo(() => new Map(works.map(work => [work.id, work])), [works]);
  const tituloDoTrabalho = useCallback((id: string) => `${worksById.get(id)?.titulo ?? id}`, [worksById]);

  const modalidades = useMemo(
    () => Array.from(new Set(works.map(work => `${work.modalidade ?? ''}`).filter(Boolean))).sort(),
    [works],
  );

  const filteredWorks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const desde = submetidosDesde ? new Date(submetidosDesde).getTime() : null;
    // O campo tem precisão de minuto: "até 14:30" inclui tudo que chegou até 14:30:59.
    const ate = submetidosAte ? new Date(submetidosAte).getTime() + 60_000 : null;
    return works.filter(work => {
      if (statusFilter !== 'Todos' && work.status !== statusFilter) return false;
      if (modalidadeFilter !== 'Todas' && work.modalidade !== modalidadeFilter) return false;
      if (desde !== null && (work.submetidoEm === null || work.submetidoEm < desde)) return false;
      if (ate !== null && (work.submetidoEm === null || work.submetidoEm >= ate)) return false;
      if (!query) return true;
      const people = resolveWorkRecipients(work, TODOS_OS_EMAILS);
      return `${work.titulo ?? ''}`.toLowerCase().includes(query)
        || people.some(person => person.nome.toLowerCase().includes(query) || person.email.includes(query));
    });
  }, [works, searchQuery, statusFilter, modalidadeFilter, submetidosDesde, submetidosAte]);

  const publicoAtivo = modo === 'todos' ? TODOS_OS_EMAILS : publico;
  const worksAtivos = useMemo(
    () => (modo === 'todos' ? works : works.filter(work => selecionados.has(work.id))),
    [modo, works, selecionados],
  );
  const destinatarios = useMemo(
    () => worksAtivos.flatMap(work => resolveWorkRecipients(work, publicoAtivo)),
    [worksAtivos, publicoAtivo],
  );
  const semDestinatario = useMemo(
    () => worksAtivos.filter(work => resolveWorkRecipients(work, publicoAtivo).length === 0).length,
    [worksAtivos, publicoAtivo],
  );

  const preview = useMemo(() => {
    const work = worksAtivos.find(item => resolveWorkRecipients(item, publicoAtivo).length > 0);
    if (!work) return null;
    const [recipient] = resolveWorkRecipients(work, publicoAtivo);
    return buildWorkEmailMessage(work, recipient, assunto, corpo);
  }, [worksAtivos, publicoAtivo, assunto, corpo]);

  const todosFiltradosMarcados = filteredWorks.length > 0 && filteredWorks.every(work => selecionados.has(work.id));

  const toggleWork = (id: string) => {
    setSelecionados(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFiltrados = () => {
    setSelecionados(previous => {
      const next = new Set(previous);
      for (const work of filteredWorks) {
        if (todosFiltradosMarcados) next.delete(work.id); else next.add(work.id);
      }
      return next;
    });
  };

  const validarMensagem = () => {
    if (!assunto.trim()) return 'Informe o assunto do e-mail.';
    if (!htmlToPlainText(corpo)) return 'Escreva a mensagem do e-mail.';
    return null;
  };

  const executarEnvio = useCallback(async (
    jobs: SendJob[],
    audience: WorkEmailAudience,
    anteriores: ResultadoEnvio[],
  ) => {
    // Lotes que não chegaram a sair: nada foi enviado, então repetir é seguro.
    const naoEnviados = (job: SendJob): ResultadoEnvio[] => job.trabalhoIds.flatMap(id => {
      const work = worksById.get(id);
      if (!work) return [];
      return resolveWorkRecipients(work, audience, job.somenteEmails).map((recipient): ResultadoEnvio => ({
        trabalhoId: id,
        email: recipient.email,
        estado: 'recusado',
        erro: 'Não enviado: o envio parou antes deste lote.',
      }));
    });
    const doLote = (job: SendJob, falha: { estado: EstadoEnvio; erro: string }): ResultadoEnvio[] =>
      naoEnviados(job).map(item => ({ ...item, ...falha }));

    const resultados = [...anteriores];
    let cotaRestante: number | null = null;
    let interrompido = false;
    setEnvio({ fase: 'enviando', total: jobs.length, feitos: 0, resultados, cotaRestante });

    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      if (interrompido) {
        resultados.push(...naoEnviados(job));
        continue;
      }
      try {
        const response = await fetch('/api/post/trabalhos/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assunto, corpoHtml: corpo, destinatarios: audience, ...job }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload?.data?.resultados)) {
          interrompido = true;
          const status = response.ok ? 502 : response.status;
          resultados.push(...doLote(job, classificarFalhaDoLote(status, payload?.message || 'Não foi possível concluir o envio.')));
        } else {
          for (const item of payload.data.resultados as { trabalhoId: string; email: string; ok: boolean; erro?: string }[]) {
            resultados.push({
              trabalhoId: item.trabalhoId,
              email: item.email,
              estado: item.ok ? 'enviado' : 'recusado',
              erro: item.ok ? undefined : item.erro || 'Falha ao enviar.',
            });
          }
          if (typeof payload.data.cotaRestante === 'number') cotaRestante = payload.data.cotaRestante;
        }
      } catch {
        interrompido = true;
        resultados.push(...doLote(job, classificarFalhaDoLote(null, '')));
      }
      setEnvio({ fase: 'enviando', total: jobs.length, feitos: index + 1, resultados: [...resultados], cotaRestante });
    }

    setEnvio({ fase: 'concluido', total: jobs.length, feitos: jobs.length, resultados, cotaRestante });
    const pendentes = resultados.filter(r => r.estado === 'pendente').length;
    const recusados = resultados.filter(r => r.estado === 'recusado').length;
    if (pendentes > 0) avisar('alerta', 'Envio concluído com pendências', `${plural(pendentes, 'e-mail pode', 'e-mails podem')} ter sido enviado sem confirmação. Confira antes de repetir.`);
    else if (recusados > 0) avisar('alerta', 'Envio concluído com recusas', `${plural(recusados, 'e-mail foi recusado', 'e-mails foram recusados')}. Veja os motivos abaixo.`);
    else avisar('ok', 'Envio concluído', `${plural(resultados.length, 'e-mail enviado', 'e-mails enviados')}.`);
  }, [assunto, corpo, worksById, avisar]);

  // Um único ponto de entrada para envio real: a trava impede duplo clique, mesmo durante a confirmação.
  const comTrava = async (acao: () => Promise<void>) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    try {
      await acao();
    } finally {
      ocupadoRef.current = false;
    }
  };

  const handleEnviar = () => comTrava(async () => {
    const erro = validarMensagem()
      || (destinatarios.length === 0 ? 'Nenhum destinatário com e-mail válido foi selecionado.' : null);
    setFormError(erro);
    if (erro) return;

    const confirmado = await confirmar({
      titulo: 'Enviar os e-mails agora?',
      descricao: `"${assunto.trim()}" será enviado para ${plural(destinatarios.length, 'destinatário', 'destinatários')} de ${plural(worksAtivos.length, 'trabalho', 'trabalhos')}. Depois de enviado, não dá para desfazer.`,
      rotuloConfirmar: 'Enviar e-mails',
      digitar: destinatarios.length > ENVIO_COLETIVO ? 'ENVIAR' : undefined,
    });
    if (!confirmado) return;

    setTestStatus(null);
    setPublicoEnviado(publicoAtivo);
    const jobs = chunkWorkIds(worksAtivos.map(work => work.id)).map(trabalhoIds => ({ trabalhoIds }));
    await executarEnvio(jobs, publicoAtivo, []);
  });

  // Recusados: seguro repetir. Pendentes: o provedor pode ter enviado, então exige confirmação explícita.
  const handleReenviar = (alvos: ResultadoEnvio[], pendentes: boolean) => comTrava(async () => {
    const erro = validarMensagem();
    setFormError(erro);
    if (erro) {
      avisar('erro', 'Revise a mensagem', `${erro} A retentativa usa o assunto e o texto que estão no editor agora.`);
      return;
    }
    if (pendentes) {
      const confirmado = await confirmar({
        titulo: 'Reenviar sem confirmação do provedor?',
        descricao: `O provedor pode já ter enviado ${alvos.length === 1 ? 'este e-mail' : `estes ${formatarNumero(alvos.length)} e-mails`}. Se você repetir sem conferir a caixa de enviados, as pessoas podem receber a mensagem duas vezes.`,
        perigo: true,
        rotuloConfirmar: 'Reenviar mesmo assim',
      });
      if (!confirmado) return;
    }

    const chaves = new Set(alvos.map(chaveResultado));
    const porTrabalho = new Map<string, string[]>();
    for (const alvo of alvos) porTrabalho.set(alvo.trabalhoId, [...(porTrabalho.get(alvo.trabalhoId) ?? []), alvo.email]);
    const jobs = Array.from(porTrabalho, ([id, somenteEmails]) => ({ trabalhoIds: [id], somenteEmails }));
    await executarEnvio(jobs, publicoEnviado, envio.resultados.filter(r => !chaves.has(chaveResultado(r))));
  });

  const handleTeste = async () => {
    const erro = validarMensagem()
      || (worksAtivos.length === 0 ? 'Selecione ao menos um trabalho para usar como exemplo no teste.' : null);
    setFormError(erro);
    if (erro) return;

    setIsTesting(true);
    setTestStatus(null);
    try {
      const response = await fetch('/api/post/trabalhos/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assunto, corpoHtml: corpo, trabalhoIds: [worksAtivos[0].id], teste: true }),
      });
      const payload = await response.json().catch(() => null);
      const resultado = payload?.data?.resultados?.[0] as { ok?: boolean; email?: string; erro?: string } | undefined;
      if (response.ok && resultado?.ok) {
        setTestStatus({ tom: 'ok', text: `Teste enviado para ${resultado.email}.` });
      } else if (response.status >= 500 || (response.status === 424 && /caixa de enviados/i.test(payload?.message ?? ''))) {
        setTestStatus({ tom: 'alerta', text: 'Sem confirmação do envio de teste. Confira a sua caixa de entrada antes de repetir.' });
      } else {
        setTestStatus({ tom: 'erro', text: resultado?.erro || payload?.message || 'Não foi possível enviar o teste.' });
      }
    } catch {
      setTestStatus({ tom: 'alerta', text: 'Sem resposta ao enviar o teste. Confira a sua caixa de entrada antes de repetir.' });
    } finally {
      setIsTesting(false);
    }
  };

  const enviando = envio.fase === 'enviando';

  // Sair no meio do envio deixaria lotes sem resposta conhecida.
  useEffect(() => {
    if (!enviando) return;
    const avisarSaida = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', avisarSaida);
    return () => window.removeEventListener('beforeunload', avisarSaida);
  }, [enviando]);

  const prontoParaEnviar = carga === 'ok';
  const rotuloAuto = autoSalvando ? 'Consultando…' : autoAtivo === null ? 'Indisponível' : autoAtivo ? 'Ativada' : 'Desativada';

  return (
    <Pagina>
      <Cabecalho
        etiqueta="Trabalhos científicos"
        titulo="Enviar e-mails"
        sub="Escreva uma mensagem para quem submeteu trabalhos, em quatro etapas: quem recebe, mensagem, teste e envio."
        voltar={{ href: '/trabalhos', rotulo: 'Voltar para o painel de avaliação' }}
      >
        {carga === 'ok' && works.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
            <Metrica rotulo="Trabalhos" valor={formatarNumero(worksAtivos.length)} />
            <Metrica
              rotulo="Destinatários"
              valor={formatarNumero(destinatarios.length)}
              detalhe={`${plural(countUniqueEmails(destinatarios), 'endereço único', 'endereços únicos')}; um endereço em vários trabalhos recebe uma mensagem por trabalho`}
            />
            <Metrica
              rotulo="Trabalhos sem e-mail"
              valor={formatarNumero(semDestinatario)}
              detalhe={semDestinatario > 0 ? 'Não têm e-mail válido para este público e não receberão' : 'Todos têm ao menos um e-mail válido'}
            />
          </div>
        )}
      </Cabecalho>

      <Secao
        titulo="Confirmação automática de recebimento"
        descricao="Quando ativada, cada novo trabalho submetido no site gera na hora um e-mail de confirmação para quem submeteu e para os autores. Trabalhos submetidos antes da ativação não recebem; use o filtro de data da etapa 1 para enviar a eles manualmente."
      >
        {autoErro && (
          <Aviso tom="erro" titulo="Confirmação automática">
            {autoErro}{' '}
            <button type="button" onClick={() => void sincronizarAuto()} className="font-semibold underline">Consultar de novo</button>
          </Aviso>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={autoAtivo === true}
            onClick={() => void handleToggleAuto()}
            disabled={autoSalvando || autoAtivo === null}
            className="inline-flex min-h-11 items-center gap-3 rounded-full border border-linha bg-cartao px-4 text-sm font-semibold disabled:opacity-60"
          >
            <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition-colors ${autoAtivo ? 'bg-ok' : 'bg-linha'}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${autoAtivo ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
            Confirmação automática: {rotuloAuto}
          </button>
        </div>
      </Secao>

      <Secao titulo="1. Quem recebe" descricao="Escolha o público e os trabalhos. A contagem no topo da página mostra quantas mensagens serão enviadas antes de você enviar.">
        <fieldset className="grid gap-2 sm:grid-cols-2" disabled={enviando}>
          <legend className="sr-only">Modo de seleção</legend>
          {([
            ['todos', 'Todos os e-mails', 'Todos os trabalhos: conta que submeteu e todos os autores.'],
            ['escolher', 'Escolher', 'Filtre e marque os trabalhos e quem recebe em cada um.'],
          ] as const).map(([valor, titulo, texto]) => (
            <label key={valor} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-linha bg-cartao px-3.5 py-3 text-sm has-[:checked]:border-tinta has-[:checked]:bg-recuo">
              <input type="radio" name="modo-envio" className="mt-1 size-4" checked={modo === valor} onChange={() => setModo(valor)} />
              <span><span className="block font-semibold">{titulo}</span><span className="block text-sutil">{texto}</span></span>
            </label>
          ))}
        </fieldset>

        {carga === 'carregando' && <Estado tipo="carregando" titulo="Carregando trabalhos…" linhas={2} />}
        {carga === 'erro' && <Estado tipo="erro" titulo="Não foi possível carregar os trabalhos" aoTentar={() => void carregarTrabalhos()} />}
        {carga === 'ok' && works.length === 0 && <Estado tipo="vazio" titulo="Nenhum trabalho submetido ainda" />}

        {carga === 'ok' && works.length > 0 && modo === 'escolher' && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Caixa
                rotulo="Conta que submeteu"
                checked={publico.remetente}
                onChange={event => setPublico({ ...publico, remetente: event.target.checked })}
                disabled={enviando}
              />
              <Caixa
                rotulo="Autores do trabalho"
                checked={publico.autores}
                onChange={event => setPublico({ ...publico, autores: event.target.checked })}
                disabled={enviando}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <CampoBusca
                rotulo="Pesquisar por título, nome ou e-mail"
                placeholder="Pesquisar por título, nome ou e-mail…"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
              />
              <Escolha rotulo="Situação do trabalho" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option === 'Todos' ? 'Todas as situações' : option}</option>)}
              </Escolha>
              <Escolha rotulo="Modalidade" value={modalidadeFilter} onChange={event => setModalidadeFilter(event.target.value)}>
                <option value="Todas">Todas as modalidades</option>
                {modalidades.map(option => <option key={option} value={option}>{option}</option>)}
              </Escolha>
            </div>

            <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Campo
                rotulo="Submetidos de"
                type="datetime-local"
                value={submetidosDesde}
                max={submetidosAte || undefined}
                onChange={event => setSubmetidosDesde(event.target.value)}
              />
              <Campo
                rotulo="Submetidos até"
                type="datetime-local"
                value={submetidosAte}
                min={submetidosDesde || undefined}
                onChange={event => setSubmetidosAte(event.target.value)}
                ajuda="Inclui tudo o que chegou até o minuto informado."
              />
              {(submetidosDesde || submetidosAte) && (
                <Botao estilo="fantasma" onClick={() => { setSubmetidosDesde(''); setSubmetidosAte(''); }}>Limpar datas</Botao>
              )}
            </div>

            <Caixa
              rotulo={`Marcar os ${plural(filteredWorks.length, 'trabalho filtrado', 'trabalhos filtrados')}`}
              checked={todosFiltradosMarcados}
              onChange={toggleFiltrados}
              disabled={enviando || filteredWorks.length === 0}
            />

            {filteredWorks.length === 0 ? (
              <Estado tipo="semResultado" texto="Nenhum trabalho corresponde aos filtros atuais. Ajuste-os ou limpe as datas." />
            ) : (
              <ul className="grid max-h-[28rem] gap-2 overflow-y-auto rounded-xl border border-linha p-2" aria-label="Trabalhos filtrados">
                {filteredWorks.map(work => {
                  const quantidade = resolveWorkRecipients(work, publico).length;
                  return (
                    <li key={work.id}>
                      <Caixa
                        rotulo={`${work.titulo ?? 'Sem título'}`}
                        ajuda={`${work.modalidade ?? ''} · ${work.status ?? ''} · Enviado por ${work.remetente?.nome || 'usuário desconhecido'}${work.submetidoEm !== null ? ` em ${formatarDataHora(work.submetidoEm)}` : ''} · ${quantidade === 0 ? 'sem e-mail válido para este público' : plural(quantidade, 'e-mail', 'e-mails')}`}
                        checked={selecionados.has(work.id)}
                        onChange={() => toggleWork(work.id)}
                        disabled={enviando}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Secao>

      <Secao titulo="2. Mensagem" descricao="O assunto e o texto são os mesmos para todos; as variáveis mudam em cada e-mail.">
        <Campo
          rotulo="Assunto"
          value={assunto}
          maxLength={WORK_EMAIL_LIMITS.subjectLength}
          onChange={event => setAssunto(event.target.value)}
          placeholder="Ex.: Resultado da avaliação do seu trabalho"
          disabled={enviando}
        />
        <div role="group" aria-labelledby="rotulo-corpo">
          <p id="rotulo-corpo" className="text-sm font-medium">Corpo do e-mail</p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-linha bg-cartao [&_.ql-container]:border-0 [&_.ql-container]:font-[inherit] [&_.ql-editor]:min-h-48 [&_.ql-editor]:text-[15px] [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-linha">
            <ReactQuill
              theme="snow"
              value={corpo}
              onChange={setCorpo}
              readOnly={enviando}
              modules={MODULOS_EDITOR}
              placeholder="Escreva a mensagem aqui…"
            />
          </div>
        </div>
        <p className="text-sm text-sutil">
          Variáveis substituídas em cada e-mail (assunto e corpo):{' '}
          {WORK_EMAIL_VARIABLES.map(variable => <code key={variable} className="mr-1.5 rounded bg-recuo px-1.5 py-0.5 text-xs">{`{{${variable}}}`}</code>)}
        </p>
      </Secao>

      <Secao titulo="3. Teste e pré-visualização" descricao="Veja como o e-mail fica para o primeiro destinatário e envie um teste para a sua própria conta antes do envio real.">
        {preview ? (
          <div className="rounded-xl border border-linha bg-papel p-4">
            <dl className="grid gap-1 border-b border-linha pb-3 text-sm">
              <div className="flex flex-wrap gap-1.5"><dt className="font-semibold">Para:</dt><dd className="break-all">{preview.para}</dd></div>
              <div className="flex flex-wrap gap-1.5"><dt className="font-semibold">Assunto:</dt><dd>{preview.assunto || '(sem assunto)'}</dd></div>
            </dl>
            <div
              className="mt-3 text-[15px] [&_a]:text-info [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: semTitulosDaPagina(DOMPurify.sanitize(preview.corpoHtml)) }}
            />
          </div>
        ) : (
          <p className="text-sm text-sutil">Selecione ao menos um trabalho com e-mail válido na etapa 1 para ver o exemplo.</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Botao estilo="contorno" onClick={() => void handleTeste()} carregando={isTesting} disabled={enviando || !prontoParaEnviar}>
            <FlaskConical className="size-4" aria-hidden="true" />Enviar teste para mim
          </Botao>
          <span className="text-sm text-sutil">O teste vai só para o e-mail da sua conta, com o assunto marcado como [TESTE].</span>
        </div>
        {testStatus && <Aviso tom={testStatus.tom}>{testStatus.text}</Aviso>}
      </Secao>

      <Secao titulo="4. Envio e resultado" descricao="Os e-mails saem em lotes de até 10 trabalhos. O resultado de cada destinatário fica nesta tela.">
        {formError && <Aviso tom="erro">{formError}</Aviso>}

        <div className="flex flex-wrap items-center gap-3">
          <Botao onClick={() => void handleEnviar()} carregando={enviando} disabled={isTesting || !prontoParaEnviar}>
            <Send className="size-4" aria-hidden="true" />
            {enviando ? 'Enviando…' : `Enviar para ${plural(destinatarios.length, 'destinatário', 'destinatários')}`}
          </Botao>
          {destinatarios.length > ENVIO_COLETIVO && <span className="text-sm text-sutil">Por ser um envio grande, será pedido que você digite ENVIAR para confirmar.</span>}
        </div>

        <div aria-live="polite" className="grid gap-3">
          {envio.fase !== 'parado' && (
            <div className="grid gap-1.5">
              <progress className="h-2 w-full" aria-label="Andamento do envio" value={envio.feitos} max={Math.max(envio.total, 1)} />
              <p className="text-sm">
                {enviando
                  ? `Enviando lote ${Math.min(envio.feitos + 1, envio.total)} de ${envio.total}. Não feche esta página.`
                  : <>Envio concluído <Selo tom={envio.resultados.every(r => r.estado === 'enviado') ? 'ok' : 'alerta'}>{envio.resultados.every(r => r.estado === 'enviado') ? 'sem falhas' : 'com pendências ou recusas'}</Selo></>}
              </p>
            </div>
          )}
        </div>

        {envio.resultados.length > 0 && (
          <ResultadoEnvioPainel
            resultados={envio.resultados}
            tituloDoTrabalho={tituloDoTrabalho}
            ocupado={enviando}
            cotaRestante={envio.cotaRestante}
            aoReenviar={(alvos, pendentes) => void handleReenviar(alvos, pendentes)}
          />
        )}
      </Secao>
    </Pagina>
  );
}
