'use client'
import dynamic from 'next/dynamic';
import Link from 'next/link';
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, FlaskConical, Mail, Search, Send, Users } from 'lucide-react';
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
import '../style.css';
import './style.css';

type Modo = 'todos' | 'escolher';

interface SendResult {
  trabalhoId: string;
  email: string;
  ok: boolean;
  erro?: string;
}

interface SendJob {
  trabalhoIds: string[];
  somenteEmails?: string[];
}

interface Envio {
  fase: 'parado' | 'enviando' | 'concluido';
  total: number;
  feitos: number;
  resultados: SendResult[];
  cotaRestante: number | null;
}

const ENVIO_INICIAL: Envio = { fase: 'parado', total: 0, feitos: 0, resultados: [], cotaRestante: null };
const TODOS_OS_EMAILS: WorkEmailAudience = { remetente: true, autores: true };
const STATUS_OPTIONS = ['Todos', 'Aceito', 'Recusado', 'Necessita de Alteração', 'Em Avaliação'];

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export default function EmailTrabalhosPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [works, setWorks] = useState<WorkEmailWork[]>([]);

  const [modo, setModo] = useState<Modo>('escolher');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [modalidadeFilter, setModalidadeFilter] = useState('Todas');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [publico, setPublico] = useState<WorkEmailAudience>({ remetente: true, autores: false });

  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');

  const [envio, setEnvio] = useState<Envio>(ENVIO_INICIAL);
  const [publicoEnviado, setPublicoEnviado] = useState<WorkEmailAudience>(TODOS_OS_EMAILS);
  const [formError, setFormError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/get/trabalhos-avaliacoes');
        if (!response.ok) throw new Error('Falha ao buscar dados');
        const { data, users } = await response.json() as { data: IAcademicWorks[]; users: IUser[] };
        const usersById = new Map(users.map(user => [`${user._id}`, user.informacoes_usuario]));
        const loaded = [...data].reverse().map((trabalho): WorkEmailWork => ({
          id: `${trabalho._id}`,
          titulo: trabalho.titulo,
          modalidade: trabalho.modalidade,
          status: trabalho.status,
          autores: trabalho.autores,
          remetente: usersById.get(`${trabalho.userId}`) ?? null,
        }));
        if (!cancelled) setWorks(loaded);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        if (!cancelled) setLoadError('Não foi possível carregar os trabalhos.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const worksById = useMemo(() => new Map(works.map(work => [work.id, work])), [works]);

  const modalidades = useMemo(
    () => Array.from(new Set(works.map(work => `${work.modalidade ?? ''}`).filter(Boolean))).sort(),
    [works],
  );

  const filteredWorks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return works.filter(work => {
      if (statusFilter !== 'Todos' && work.status !== statusFilter) return false;
      if (modalidadeFilter !== 'Todas' && work.modalidade !== modalidadeFilter) return false;
      if (!query) return true;
      const people = resolveWorkRecipients(work, TODOS_OS_EMAILS);
      return `${work.titulo ?? ''}`.toLowerCase().includes(query)
        || people.some(person => person.nome.toLowerCase().includes(query) || person.email.includes(query));
    });
  }, [works, searchQuery, statusFilter, modalidadeFilter]);

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
    anteriores: SendResult[],
  ) => {
    const falhasDoJob = (job: SendJob, erro: string): SendResult[] => job.trabalhoIds.flatMap(id => {
      const work = worksById.get(id);
      if (!work) return [];
      return resolveWorkRecipients(work, audience, job.somenteEmails)
        .map(recipient => ({ trabalhoId: id, email: recipient.email, ok: false, erro }));
    });

    const resultados = [...anteriores];
    let cotaRestante: number | null = null;
    let interrompido: string | null = null;
    setEnvio({ fase: 'enviando', total: jobs.length, feitos: 0, resultados, cotaRestante });

    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      if (interrompido) {
        resultados.push(...falhasDoJob(job, 'Não enviado: o envio foi interrompido.'));
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
          interrompido = payload?.message || 'Não foi possível concluir o envio.';
          resultados.push(...falhasDoJob(job, `${interrompido}`));
        } else {
          resultados.push(...payload.data.resultados as SendResult[]);
          if (typeof payload.data.cotaRestante === 'number') cotaRestante = payload.data.cotaRestante;
        }
      } catch {
        interrompido = 'Falha de conexão durante o envio.';
        resultados.push(...falhasDoJob(job, interrompido));
      }
      setEnvio({ fase: 'enviando', total: jobs.length, feitos: index + 1, resultados: [...resultados], cotaRestante });
    }

    setEnvio({ fase: 'concluido', total: jobs.length, feitos: jobs.length, resultados, cotaRestante });
  }, [assunto, corpo, worksById]);

  const handleEnviar = async () => {
    const erro = validarMensagem()
      || (destinatarios.length === 0 ? 'Nenhum destinatário com e-mail válido foi selecionado.' : null);
    setFormError(erro);
    if (erro) return;

    const confirmado = window.confirm(
      `Enviar "${assunto.trim()}" para ${plural(destinatarios.length, 'destinatário', 'destinatários')} `
      + `de ${plural(worksAtivos.length, 'trabalho', 'trabalhos')}?`,
    );
    if (!confirmado) return;

    setTestStatus(null);
    setPublicoEnviado(publicoAtivo);
    const jobs = chunkWorkIds(worksAtivos.map(work => work.id)).map(trabalhoIds => ({ trabalhoIds }));
    await executarEnvio(jobs, publicoAtivo, []);
  };

  const handleReenviarFalhas = async () => {
    const erro = validarMensagem();
    setFormError(erro);
    if (erro) return;

    const falhasPorTrabalho = new Map<string, string[]>();
    for (const resultado of envio.resultados) {
      if (resultado.ok) continue;
      falhasPorTrabalho.set(resultado.trabalhoId, [
        ...(falhasPorTrabalho.get(resultado.trabalhoId) ?? []),
        resultado.email,
      ]);
    }
    const jobs = Array.from(falhasPorTrabalho, ([id, somenteEmails]) => ({ trabalhoIds: [id], somenteEmails }));
    await executarEnvio(jobs, publicoEnviado, envio.resultados.filter(resultado => resultado.ok));
  };

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
      const resultado = payload?.data?.resultados?.[0] as SendResult | undefined;
      if (response.ok && resultado?.ok) {
        setTestStatus({ ok: true, text: `Teste enviado para ${resultado.email}.` });
      } else {
        setTestStatus({ ok: false, text: resultado?.erro || payload?.message || 'Não foi possível enviar o teste.' });
      }
    } catch {
      setTestStatus({ ok: false, text: 'Falha de conexão ao enviar o teste.' });
    } finally {
      setIsTesting(false);
    }
  };

  const enviando = envio.fase === 'enviando';
  const falhas = envio.resultados.filter(resultado => !resultado.ok);
  const enviados = envio.resultados.length - falhas.length;

  return (
    <div className="trabalhos-main-container">
      <div className="trabalhos-content-wrapper">
        <header className="trabalhos-header">
          <span className="main-eyebrow">CIEPS / Trabalhos / E-mail</span>
          <h1 className="trabalhos-title">Enviar E-mails</h1>
          <p className="trabalhos-subtitle">Escreva uma mensagem para quem submeteu trabalhos.</p>
          <Link href="/trabalhos" className="trabalhos-email-back">
            <ArrowLeft size={16} />
            Voltar para o painel de avaliação
          </Link>
        </header>

        {isLoading && <div className="trabalhos-results-info">Carregando trabalhos...</div>}
        {loadError && <div className="trabalhos-message error">{loadError}</div>}

        {!isLoading && !loadError && (
          <>
            {/* Destinatários */}
            <section className="trabalhos-filters-container">
              <h2 className="trabalhos-filters-title">
                <Users className="inline-block mr-2" />
                Destinatários
              </h2>

              <div className="trabalhos-email-modes" role="radiogroup" aria-label="Modo de seleção">
                <button
                  type="button"
                  role="radio"
                  aria-checked={modo === 'todos'}
                  className={`trabalhos-email-mode ${modo === 'todos' ? 'active' : ''}`}
                  onClick={() => setModo('todos')}
                  disabled={enviando}
                >
                  <strong>Todos os e-mails</strong>
                  <span>Todos os trabalhos: conta que submeteu e todos os autores.</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={modo === 'escolher'}
                  className={`trabalhos-email-mode ${modo === 'escolher' ? 'active' : ''}`}
                  onClick={() => setModo('escolher')}
                  disabled={enviando}
                >
                  <strong>Escolher</strong>
                  <span>Filtre e marque os trabalhos e quem recebe em cada um.</span>
                </button>
              </div>

              {modo === 'escolher' && (
                <>
                  <div className="trabalhos-email-audience">
                    <label>
                      <input
                        type="checkbox"
                        checked={publico.remetente}
                        onChange={event => setPublico({ ...publico, remetente: event.target.checked })}
                        disabled={enviando}
                      />
                      Conta que submeteu
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={publico.autores}
                        onChange={event => setPublico({ ...publico, autores: event.target.checked })}
                        disabled={enviando}
                      />
                      Autores do trabalho
                    </label>
                  </div>

                  <div className="trabalhos-email-filters">
                    <div className="trabalhos-search-container">
                      <Search className="trabalhos-search-icon" />
                      <input
                        type="text"
                        placeholder="Pesquisar por título, nome ou e-mail..."
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        className="trabalhos-search-input"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={event => setStatusFilter(event.target.value)}
                      className="trabalhos-select"
                      aria-label="Filtrar por status"
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option} value={option}>{option === 'Todos' ? 'Status (Todos)' : option}</option>
                      ))}
                    </select>
                    <select
                      value={modalidadeFilter}
                      onChange={event => setModalidadeFilter(event.target.value)}
                      className="trabalhos-select"
                      aria-label="Filtrar por modalidade"
                    >
                      <option value="Todas">Modalidade (Todas)</option>
                      {modalidades.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>

                  <label className="trabalhos-email-select-all">
                    <input
                      type="checkbox"
                      checked={todosFiltradosMarcados}
                      onChange={toggleFiltrados}
                      disabled={enviando || filteredWorks.length === 0}
                    />
                    Marcar os {plural(filteredWorks.length, 'trabalho filtrado', 'trabalhos filtrados')}
                  </label>

                  <ul className="trabalhos-email-list">
                    {filteredWorks.length === 0 && (
                      <li className="trabalhos-email-list-empty">Nenhum trabalho encontrado com os filtros atuais.</li>
                    )}
                    {filteredWorks.map(work => {
                      const quantidade = resolveWorkRecipients(work, publico).length;
                      return (
                        <li key={work.id}>
                          <label className="trabalhos-email-item">
                            <input
                              type="checkbox"
                              checked={selecionados.has(work.id)}
                              onChange={() => toggleWork(work.id)}
                              disabled={enviando}
                            />
                            <span className="trabalhos-email-item-body">
                              <span className="trabalhos-email-item-title">{`${work.titulo ?? 'Sem título'}`}</span>
                              <span className="trabalhos-email-item-meta">
                                {`${work.modalidade ?? ''}`} · {`${work.status ?? ''}`} · Enviado por{' '}
                                {`${work.remetente?.nome || 'usuário desconhecido'}`}
                              </span>
                            </span>
                            <span className={`trabalhos-email-item-count ${quantidade === 0 ? 'empty' : ''}`}>
                              {plural(quantidade, 'e-mail', 'e-mails')}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <div className="trabalhos-email-summary">
                <strong>{plural(worksAtivos.length, 'trabalho', 'trabalhos')}</strong>
                {' · '}
                <strong>{plural(destinatarios.length, 'mensagem', 'mensagens')}</strong>
                {' para '}
                {plural(countUniqueEmails(destinatarios), 'endereço único', 'endereços únicos')}
                {semDestinatario > 0 && (
                  <span className="trabalhos-email-summary-warning">
                    {' '}· {plural(semDestinatario, 'trabalho', 'trabalhos')} sem e-mail válido para este público
                  </span>
                )}
              </div>
            </section>

            {/* Mensagem */}
            <section className="trabalhos-filters-container">
              <h2 className="trabalhos-filters-title">
                <Mail className="inline-block mr-2" />
                Mensagem
              </h2>

              <label className="trabalhos-editor-label" htmlFor="trabalhos-email-assunto">Assunto</label>
              <input
                id="trabalhos-email-assunto"
                type="text"
                value={assunto}
                maxLength={WORK_EMAIL_LIMITS.subjectLength}
                onChange={event => setAssunto(event.target.value)}
                placeholder="Ex.: Resultado da avaliação do seu trabalho"
                className="trabalhos-email-subject"
                disabled={enviando}
              />

              <label className="trabalhos-editor-label">Corpo do e-mail</label>
              <div className="trabalhos-editor">
                <ReactQuill
                  theme="snow"
                  value={corpo}
                  onChange={setCorpo}
                  readOnly={enviando}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, false] }],
                      ['bold', 'italic', 'underline'],
                      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                      ['link'],
                      ['clean']
                    ]
                  }}
                  placeholder="Escreva a mensagem aqui..."
                />
              </div>
              <p className="trabalhos-email-hint">
                Variáveis substituídas em cada e-mail (assunto e corpo):{' '}
                {WORK_EMAIL_VARIABLES.map(variable => <code key={variable}>{`{{${variable}}}`}</code>)}
              </p>
            </section>

            {/* Pré-visualização */}
            <section className="trabalhos-filters-container">
              <h2 className="trabalhos-filters-title">
                <Eye className="inline-block mr-2" />
                Pré-visualização
              </h2>
              {preview ? (
                <div className="trabalhos-email-preview">
                  <div className="trabalhos-email-preview-meta">
                    <div><strong>Para:</strong> {preview.para}</div>
                    <div><strong>Assunto:</strong> {preview.assunto || '(sem assunto)'}</div>
                  </div>
                  <div
                    className="trabalhos-email-preview-body"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.corpoHtml) }}
                  />
                </div>
              ) : (
                <p className="trabalhos-email-hint">Selecione ao menos um trabalho com e-mail válido para ver o exemplo.</p>
              )}
            </section>

            {/* Envio */}
            <section className="trabalhos-filters-container">
              <h2 className="trabalhos-filters-title">
                <Send className="inline-block mr-2" />
                Envio
              </h2>

              {formError && <div className="trabalhos-message error">{formError}</div>}
              {testStatus && (
                <div className={`trabalhos-message ${testStatus.ok ? 'success' : 'error'}`}>{testStatus.text}</div>
              )}

              <div className="trabalhos-email-actions">
                <button
                  type="button"
                  className="trabalhos-email-btn-secondary"
                  onClick={handleTeste}
                  disabled={enviando || isTesting}
                >
                  <FlaskConical size={16} />
                  {isTesting ? 'Enviando teste...' : 'Enviar teste para mim'}
                </button>
                <button
                  type="button"
                  className="trabalhos-submit-btn"
                  onClick={handleEnviar}
                  disabled={enviando || isTesting}
                >
                  <Send size={16} />
                  {enviando ? 'Enviando...' : `Enviar para ${plural(destinatarios.length, 'destinatário', 'destinatários')}`}
                </button>
              </div>

              {envio.fase !== 'parado' && (
                <div className="trabalhos-email-progress" aria-live="polite">
                  <progress value={envio.feitos} max={Math.max(envio.total, 1)} />
                  <div className="trabalhos-email-progress-text">
                    {enviando
                      ? `Enviando lote ${Math.min(envio.feitos + 1, envio.total)} de ${envio.total}...`
                      : `Envio concluído: ${plural(enviados, 'enviado', 'enviados')}, ${plural(falhas.length, 'falha', 'falhas')}.`}
                    {envio.cotaRestante !== null && ` Cota restante hoje: ${envio.cotaRestante}.`}
                  </div>
                </div>
              )}

              {envio.fase === 'concluido' && falhas.length > 0 && (
                <div className="trabalhos-email-failures">
                  <ul>
                    {falhas.map(falha => (
                      <li key={`${falha.trabalhoId}:${falha.email}`}>
                        <strong>{falha.email}</strong>
                        {' — '}
                        {`${worksById.get(falha.trabalhoId)?.titulo ?? falha.trabalhoId}`}
                        <span>{falha.erro || 'Falha ao enviar.'}</span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="trabalhos-email-btn-secondary" onClick={handleReenviarFalhas}>
                    Tentar novamente as {plural(falhas.length, 'falha', 'falhas')}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
