"use client"

import { useEffect, useId, useRef, useState } from "react";
import { ObjectId } from "bson";
import { Plus, Trash2, X } from "lucide-react";
import { Area, Aviso, Botao, Caixa, Campo } from "./ui";
import { useAvisos } from "./Avisos";
import { renderEmojiAsLucide } from "@/app/lib/utils/emojiToLucide";
import type { ICourse } from "../lib/types/events/event.t";

type DadosAtividade = Omit<ICourse, "_id" | "_nSerie" | "attendanceList" | "participants" | "participantsCount">;
type Etapa = DadosAtividade["timeline"][number];
// `_id` só existe ao editar; o resto do que vem do servidor é ignorado no envio.
type Formulario = DadosAtividade & { _id?: string };

interface CreateCourseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
    apiUrl?: string,
    apiMethod?: string,
    buttonText?: string,
    initialForms?: Formulario
    title?: string
}

const VAZIO: Formulario = {
    name: "", emoji: "", description: "", maxParticipants: 0, organization_name: "", dateOpen: "",
    isFree: true, value: 0, timeline: [], type: "", showToUser: false, isOpen: false,
};

type Erros = Record<string, string>;

// Registros antigos podem não ter algum campo: sem isto o campo vira "não controlado" e a validação quebra.
function normalizar(f: Formulario): Formulario {
    return {
        ...f,
        name: f.name ?? "", emoji: f.emoji ?? "", description: f.description ?? "", organization_name: f.organization_name ?? "",
        type: f.type ?? "", dateOpen: f.dateOpen ?? "", maxParticipants: f.maxParticipants ?? 0, value: f.value ?? 0,
        isFree: f.isFree ?? true, showToUser: f.showToUser ?? false, isOpen: f.isOpen ?? false,
        timeline: (f.timeline ?? []).map((t) => ({
            ...t,
            name: t.name ?? "", date_init: t.date_init ?? "", date_end: t.date_end ?? "", description: t.description ?? "",
            local: t.local ?? "", local_description: t.local_description ?? "",
        })),
    };
}

// As chaves são as mesmas que o servidor devolve em `field` (dateOpen, timeline.N.date_init...).
function validar(f: Formulario): [string, string][] {
    const e: [string, string][] = [];
    if (!f.name.trim()) e.push(["name", "Informe o nome da atividade."]);
    if (!f.emoji.trim()) e.push(["emoji", "Informe um emoji ou ícone."]);
    if (!f.description.trim()) e.push(["description", "Escreva a descrição da atividade."]);
    if (!f.organization_name.trim()) e.push(["organization_name", "Informe a organização."]);
    if (!f.type.trim()) e.push(["type", "Informe o tipo da atividade."]);
    if (!f.dateOpen) e.push(["dateOpen", "Informe a data de abertura."]);
    if (!f.isFree && !(f.value > 0)) e.push(["value", "Uma atividade paga precisa ter valor maior que zero."]);

    f.timeline.forEach((t, i) => {
        const k = (campo: string) => `timeline.${i}.${campo}`;
        if (!t.date_init) e.push([k("date_init"), "Informe a data de início."]);
        if (!t.date_end) e.push([k("date_end"), "Informe a data de fim."]);
        else if (t.date_init && new Date(t.date_init).getTime() > new Date(t.date_end).getTime()) e.push([k("date_end"), "O fim não pode ser antes do início."]);
        if (!t.description.trim()) e.push([k("description"), "Escreva a descrição da etapa."]);
        if (!t.local.trim()) e.push([k("local"), "Informe o local."]);
        if (!t.local_description.trim()) e.push([k("local_description"), "Informe a descrição do local."]);
    });

    // choque de horário entre etapas: a etapa que começa antes de a anterior terminar recebe o erro
    const comDatas = f.timeline.map((t, i) => ({ t, i })).filter(({ t }) => t.date_init && t.date_end)
        .sort((a, b) => new Date(a.t.date_init).getTime() - new Date(b.t.date_init).getTime());
    for (let n = 1; n < comDatas.length; n++) {
        const atual = comDatas[n], anterior = comDatas[n - 1];
        if (new Date(atual.t.date_init).getTime() < new Date(anterior.t.date_end).getTime()) {
            e.push([`timeline.${atual.i}.date_init`, `Começa antes do fim da etapa ${anterior.i + 1}. Ajuste os horários.`]);
        }
    }
    if (!f.timeline.length) e.push(["timeline", "Adicione ao menos uma etapa à programação."]);

    // na ordem em que os campos aparecem na tela, para o foco ir ao primeiro
    const posicao = (chave: string) => {
        const m = /^timeline\.(\d+)\.(\w+)$/.exec(chave);
        if (!m) return ["name", "emoji", "description", "organization_name", "type", "dateOpen", "value", "timeline"].indexOf(chave);
        return 100 + Number(m[1]) * 10 + ["name", "date_init", "date_end", "description", "local", "local_description"].indexOf(m[2]);
    };
    const vistos = new Set<string>();
    return e.sort((a, b) => posicao(a[0]) - posicao(b[0])).filter(([k]) => !vistos.has(k) && vistos.add(k));
}

function FormularioAtividade({ idTitulo, titulo, rotuloSalvar, apiUrl, apiMethod, inicial, onClose, onSuccess, registrarFechar }: {
    idTitulo: string; titulo: string; rotuloSalvar: string; apiUrl: string; apiMethod: string; inicial: Formulario;
    onClose: () => void; onSuccess: () => void | Promise<void>; registrarFechar: (fn: () => void) => void;
}) {
    const { avisar, confirmar } = useAvisos();
    const [form, setForm] = useState<Formulario>(() => normalizar(inicial));
    const [erros, setErros] = useState<Erros>({});
    const [geral, setGeral] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [salvo, setSalvo] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const botaoAdicionar = useRef<HTMLButtonElement>(null);
    const focarEtapa = useRef<number | null>(null);
    const original = useRef(JSON.stringify(form));
    const sujo = !salvo && JSON.stringify(form) !== original.current;

    // aviso do navegador ao recarregar ou fechar a aba com edição pendente
    useEffect(() => {
        if (!sujo) return;
        const aviso = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ""; };
        window.addEventListener("beforeunload", aviso);
        return () => window.removeEventListener("beforeunload", aviso);
    }, [sujo]);

    useEffect(() => {
        if (focarEtapa.current === null) return;
        focar(`timeline.${focarEtapa.current}.name`);
        focarEtapa.current = null;
    }, [form.timeline.length]);

    async function pedirFechar() {
        if (salvando) return;
        if (sujo && !(await confirmar({
            titulo: "Descartar as alterações?",
            descricao: "Você mudou a atividade e ainda não salvou. Se fechar agora, essas mudanças serão perdidas.",
            perigo: true,
            rotuloConfirmar: "Descartar alterações",
            rotuloCancelar: "Continuar editando",
        }))) return;
        onClose();
    }
    useEffect(() => { registrarFechar(() => void pedirFechar()); });

    function focar(chave: string) {
        const el = formRef.current?.elements.namedItem(chave);
        if (el instanceof HTMLElement) el.focus();
    }

    function limparErro(chave: string) {
        setGeral(null);
        setErros((atual) => {
            if (!atual[chave]) return atual;
            const copia = { ...atual };
            delete copia[chave];
            return copia;
        });
    }

    function alterar<K extends keyof Formulario>(chave: K, valor: Formulario[K]) {
        limparErro(String(chave));
        setForm((f) => ({ ...f, [chave]: valor }));
    }
    function alterarEtapa(indice: number, campo: keyof Etapa, valor: string) {
        limparErro(`timeline.${indice}.${String(campo)}`);
        // conflito de horário depende de duas etapas: qualquer mudança de data libera os avisos de data
        if (campo === "date_init" || campo === "date_end") limparErro("timeline");
        setForm((f) => ({ ...f, timeline: f.timeline.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)) }));
    }

    function adicionarEtapa() {
        limparErro("timeline");
        const nova: Etapa = {
            _id: new ObjectId().toString() as Etapa["_id"],
            name: "", date_init: "", date_end: "", description: "",
            speakers: [] as unknown as Etapa["speakers"],
            presence_list: [] as unknown as Etapa["presence_list"],
            local_description: "", local: "",
        };
        focarEtapa.current = form.timeline.length;
        setForm((f) => ({ ...f, timeline: [...f.timeline, nova] }));
    }

    async function removerEtapa(indice: number) {
        const t = form.timeline[indice];
        const temConteudo = [t.name, t.date_init, t.date_end, t.description, t.local, t.local_description].some(Boolean);
        if (temConteudo && !(await confirmar({
            titulo: `Remover a etapa ${indice + 1}?`,
            descricao: t.name ? `Os dados preenchidos de "${t.name}" serão perdidos.` : "Os dados preenchidos nesta etapa serão perdidos.",
            perigo: true,
            rotuloConfirmar: "Remover etapa",
        }))) return;
        setErros({});
        setForm((f) => ({ ...f, timeline: f.timeline.filter((_, i) => i !== indice) }));
        botaoAdicionar.current?.focus();
    }

    async function enviar() {
        const encontrados = validar(form);
        if (encontrados.length) {
            setErros(Object.fromEntries(encontrados));
            setGeral(`Corrija ${encontrados.length === 1 ? "1 campo destacado" : `${encontrados.length} campos destacados`} antes de salvar.`);
            if (formRef.current?.elements.namedItem(encontrados[0][0])) focar(encontrados[0][0]);
            else botaoAdicionar.current?.focus();
            return;
        }
        setErros({});
        setGeral(null);
        setSalvando(true);
        // só o que o servidor aceita: inscritos, presenças e contador nunca saem daqui
        const corpo = {
            ...(form._id ? { _id: form._id } : {}),
            name: form.name, emoji: form.emoji, description: form.description, maxParticipants: form.maxParticipants,
            organization_name: form.organization_name, dateOpen: form.dateOpen, isFree: form.isFree, value: form.value,
            type: form.type, showToUser: form.showToUser, isOpen: form.isOpen, timeline: form.timeline,
        };
        try {
            const resposta = await fetch(apiUrl, { method: apiMethod, body: JSON.stringify(corpo) });
            const retorno = await resposta.json().catch(() => null) as { message?: string; field?: string } | null;
            if (!resposta.ok) {
                const mensagem = retorno?.message || "Não foi possível salvar a atividade.";
                if (retorno?.field && formRef.current?.elements.namedItem(retorno.field)) {
                    setErros({ [retorno.field]: mensagem });
                    setGeral("Corrija o campo destacado antes de salvar.");
                    focar(retorno.field);
                } else {
                    setGeral(mensagem);
                }
                return;
            }
            avisar("ok", retorno?.message || "Atividade salva.");
            setSalvo(true);
            try { await onSuccess(); } catch { /* quem chama avisa se não conseguir recarregar */ }
            onClose();
        } catch {
            setGeral("Sem resposta do servidor. Confira a lista de atividades antes de tentar de novo, para não duplicar a atividade.");
        } finally {
            setSalvando(false);
        }
    }

    const e = (chave: string) => erros[chave];

    return (
        <form
            ref={formRef}
            noValidate
            aria-busy={salvando || undefined}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}
        >
            <header className="flex items-start justify-between gap-4 border-b border-linha px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-acao">Atividade</p>
                    <h2 id={idTitulo} className="titulo break-words text-xl leading-snug">{titulo}</h2>
                </div>
                <button type="button" onClick={() => void pedirFechar()} disabled={salvando} aria-label="Fechar formulário de atividade" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-recuo disabled:opacity-50">
                    <X className="size-5" aria-hidden="true" />
                </button>
            </header>

            <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-5 py-5 sm:px-6">
                <p className="text-sm text-sutil">Informe os dados de exibição, inscrição e programação. Todos os campos são obrigatórios, exceto o nome de cada etapa, e é preciso ao menos uma etapa.</p>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo className="sm:col-span-2" rotulo="Nome da atividade" name="name" data-foco-inicial="" autoComplete="off" value={form.name} erro={e("name")} onChange={(ev) => alterar("name", ev.target.value)} />
                    <div className="flex items-start gap-3">
                        <Campo className="min-w-0 flex-1" rotulo="Emoji ou ícone" name="emoji" autoComplete="off" value={form.emoji} erro={e("emoji")} onChange={(ev) => alterar("emoji", ev.target.value)} />
                        <div aria-hidden="true" className="mt-[26px] grid size-[46px] shrink-0 place-items-center rounded-xl bg-recuo">{renderEmojiAsLucide(form.emoji, { size: 22 })}</div>
                    </div>
                    <Campo rotulo="Máximo de participantes" name="maxParticipants" type="number" min={0} inputMode="numeric" value={form.maxParticipants} onChange={(ev) => alterar("maxParticipants", Number(ev.target.value))} />
                    <Area className="sm:col-span-2" rotulo="Descrição" name="description" rows={3} value={form.description} erro={e("description")} onChange={(ev) => alterar("description", ev.target.value)} />
                    <Campo rotulo="Organização" name="organization_name" autoComplete="off" value={form.organization_name} erro={e("organization_name")} onChange={(ev) => alterar("organization_name", ev.target.value)} />
                    <Campo rotulo="Tipo" name="type" autoComplete="off" value={form.type} erro={e("type")} onChange={(ev) => alterar("type", ev.target.value)} />
                    <Campo rotulo="Data de abertura" name="dateOpen" type="datetime-local" value={form.dateOpen} erro={e("dateOpen")} onChange={(ev) => alterar("dateOpen", ev.target.value)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid content-start gap-2">
                        <Caixa rotulo="Atividade gratuita" ajuda="Desmarque para informar o valor." name="isFree" checked={form.isFree} onChange={(ev) => alterar("isFree", ev.target.checked)} />
                        <Caixa rotulo="Mostrar para o usuário" name="showToUser" checked={form.showToUser} onChange={(ev) => alterar("showToUser", ev.target.checked)} />
                        <Caixa rotulo="Inscrições abertas" name="isOpen" checked={form.isOpen} onChange={(ev) => alterar("isOpen", ev.target.checked)} />
                    </div>
                    <Campo rotulo="Valor (R$)" name="value" type="number" min={0} step="0.01" inputMode="decimal" disabled={form.isFree} ajuda={form.isFree ? "Atividade gratuita: sem valor a cobrar." : undefined} value={form.value} erro={e("value")} onChange={(ev) => alterar("value", Number(ev.target.value))} />
                </div>

                <section aria-labelledby={`${idTitulo}-programacao`} className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 id={`${idTitulo}-programacao`} className="titulo text-lg">Programação</h3>
                        <button ref={botaoAdicionar} type="button" onClick={adicionarEtapa} aria-describedby={e("timeline") ? `${idTitulo}-erro-timeline` : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-linha bg-cartao px-5 text-sm font-semibold hover:border-tinta/40">
                            <Plus className="size-4" aria-hidden="true" />Adicionar etapa
                        </button>
                    </div>
                    {e("timeline") && <p id={`${idTitulo}-erro-timeline`} className="text-sm text-erro">{e("timeline")}</p>}

                    {form.timeline.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-linha px-4 py-6 text-center text-sm text-sutil">Nenhuma etapa adicionada ainda.</p>
                    ) : (
                        <ol className="grid gap-4">
                            {form.timeline.map((t, i) => (
                                <li key={t._id} className="grid gap-4 rounded-2xl border border-linha bg-recuo/40 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <h4 className="titulo min-w-0 break-words text-base">Etapa {i + 1}{t.name ? ` · ${t.name}` : ""}</h4>
                                        <Botao estilo="perigo" aria-label={`Remover etapa ${i + 1}`} onClick={() => void removerEtapa(i)}>
                                            <Trash2 className="size-4" aria-hidden="true" />Remover
                                        </Botao>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Campo className="sm:col-span-2" rotulo="Nome da etapa (opcional)" name={`timeline.${i}.name`} autoComplete="off" value={t.name} onChange={(ev) => alterarEtapa(i, "name", ev.target.value)} />
                                        <Campo rotulo="Data de início" name={`timeline.${i}.date_init`} type="datetime-local" value={t.date_init} erro={e(`timeline.${i}.date_init`)} onChange={(ev) => alterarEtapa(i, "date_init", ev.target.value)} />
                                        <Campo rotulo="Data de fim" name={`timeline.${i}.date_end`} type="datetime-local" value={t.date_end} erro={e(`timeline.${i}.date_end`)} onChange={(ev) => alterarEtapa(i, "date_end", ev.target.value)} />
                                        <Area className="sm:col-span-2" rotulo="Descrição da etapa" name={`timeline.${i}.description`} rows={2} value={t.description} erro={e(`timeline.${i}.description`)} onChange={(ev) => alterarEtapa(i, "description", ev.target.value)} />
                                        <Campo rotulo="Local" name={`timeline.${i}.local`} autoComplete="off" value={t.local} erro={e(`timeline.${i}.local`)} onChange={(ev) => alterarEtapa(i, "local", ev.target.value)} />
                                        <Campo rotulo="Descrição do local" name={`timeline.${i}.local_description`} autoComplete="off" value={t.local_description} erro={e(`timeline.${i}.local_description`)} onChange={(ev) => alterarEtapa(i, "local_description", ev.target.value)} />
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </div>

            <footer className="grid gap-3 border-t border-linha px-5 py-4 sm:px-6">
                {geral && <Aviso tom="erro">{geral}</Aviso>}
                <div className="flex flex-wrap justify-end gap-2">
                    <Botao estilo="contorno" disabled={salvando} onClick={() => void pedirFechar()}>Cancelar</Botao>
                    <Botao type="submit" carregando={salvando}>{rotuloSalvar}</Botao>
                </div>
            </footer>
        </form>
    );
}

/**
 * Formulário de atividade sobre <dialog>.showModal(), no mesmo padrão de Dialogo: fundo inerte, Escape e foco de volta
 * a quem abriu vêm do navegador. O formulário só existe com o diálogo aberto, então cada abertura começa do zero.
 */
const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
    title = "Criar nova atividade", buttonText = "Criar atividade", apiMethod = "POST", apiUrl = "/api/post/criarNovoMinicurso/",
    isOpen, onClose, onSuccess, initialForms = VAZIO,
}) => {
    const ref = useRef<HTMLDialogElement>(null);
    const idTitulo = useId();
    const pedirFechar = useRef<() => void>(() => { });

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (isOpen && !d.open) {
            d.showModal();
            d.querySelector<HTMLElement>("[data-foco-inicial]")?.focus();
        } else if (!isOpen && d.open) {
            d.close();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const anterior = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        return () => { document.documentElement.style.overflow = anterior; };
    }, [isOpen]);

    return (
        <dialog
            ref={ref}
            aria-labelledby={idTitulo}
            className="dialogo m-auto max-h-[92dvh] w-[min(96vw,56rem)] flex-col overflow-hidden rounded-2xl border-0 bg-cartao p-0 text-tinta shadow-2xl open:flex"
            onCancel={(ev) => { ev.preventDefault(); pedirFechar.current(); }}
        >
            {isOpen && (
                <FormularioAtividade
                    idTitulo={idTitulo}
                    titulo={title}
                    rotuloSalvar={buttonText}
                    apiUrl={apiUrl}
                    apiMethod={apiMethod}
                    inicial={initialForms}
                    onClose={onClose}
                    onSuccess={onSuccess}
                    registrarFechar={(fn) => { pedirFechar.current = fn; }}
                />
            )}
        </dialog>
    );
};

export default CreateCourseModal
