"use client"

import { useEffect, useId, useRef, useState } from "react";
import { ICourse } from "../lib/types/events/event.t";
import LoadingModal from "./LoadingModal";
import { ObjectId } from "bson";
import { X, Plus, Trash } from "lucide-react";
import { renderEmojiAsLucide } from "@/app/lib/utils/emojiToLucide";
import styles from "./CiepsAdmin.module.css";
//
// Props do componente, mantendo a sua estrutura
interface CreateCourseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    apiUrl?: string,
    apiMethod?: string,
    buttonText?: string,
    initialForms?: Omit<ICourse, "_id" | "_nSerie" | "attendanceList" | "participants" | "participantsCount">
    title?: string
}

const CreateCourseModal: React.FC<CreateCourseModalProps> = ({ title = "Criar nova atividade", buttonText = "Criar atividade", apiMethod = "POST", apiUrl = "/api/post/criarNovoMinicurso/", isOpen, onClose, onSuccess, initialForms = {
    "name": "",
    "emoji": "",
    "description": "",
    "maxParticipants": 0,
    "organization_name": "",
    "dateOpen": "",
    "isFree": true,
    "value": 0,
    "timeline": [],
    "type": "",
    "showToUser": false,
    "isOpen": false,
} }) => {

    const [loading, setLoading] = useState<boolean>(false)
    const [newFormData, setNewFormData] = useState<Omit<ICourse, "_id" | "_nSerie" | "attendanceList" | "participants" | "participantsCount">>(initialForms);

    const [validationError, setValidationError] = useState<string | null>(null);
    const titleId = useId();
    const introId = useId();
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previouslyFocusedElement = document.activeElement as HTMLElement | null;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleEscape);
        closeButtonRef.current?.focus();

        return () => {
            window.removeEventListener("keydown", handleEscape);
            previouslyFocusedElement?.focus();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Função para lidar com a mudança nos inputs principais
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const target = e.target as HTMLInputElement;

        setValidationError(null); // Limpa o erro de validação ao começar a digitar

        setNewFormData(prevData => ({
            ...prevData,
            [name]: type === "checkbox" ? target.checked :
                type === "number" ? Number(value) :
                    value
        }));
    };

    // Função para adicionar um novo item à timeline
    const handleAddTimelineItem = () => {
        setValidationError(null);
        const newItem = {
            _id: new ObjectId().toString() as ICourse["timeline"][0]["_id"],
            name: "",
            date_init: "",
            date_end: "",
            description: "",
            speakers: [] as unknown as ICourse["timeline"][0]["speakers"],
            presence_list: [] as unknown as ICourse["timeline"][0]["presence_list"],
            local_description: "",
            local: "",
        };

        setNewFormData(prevData => ({
            ...prevData,
            timeline: [...prevData.timeline, newItem]
        }));
    };

    // Função para remover um item da timeline
    const handleRemoveTimelineItem = (index: number) => {
        setValidationError(null);
        setNewFormData(prevData => ({
            ...prevData,
            timeline: prevData.timeline.filter((_, i) => i !== index)
        }));
    };

    // Função para lidar com a mudança nos inputs de um item específico da timeline
    const handleTimelineChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValidationError(null);
        const { name, value } = e.target;
        const updatedTimeline = newFormData.timeline.map((item, i) => {
            if (i === index) {
                return { ...item, [name]: value };
            }
            return item;
        });

        setNewFormData(prevData => ({
            ...prevData,
            timeline: updatedTimeline
        }));
    };

    // Função de validação de choque de horários
    /*
    const validateTimeline = (timeline: typeof newFormData.timeline) => {
        // Filtra itens com datas válidas
        const validItems = timeline.filter(item => item.date_init && item.date_end);

        if (validItems.length < 2) return true;

        // Ordena a timeline por data de início para facilitar a checagem
        const sortedTimeline = [...validItems].sort((a, b) =>
            new Date(a.date_init).getTime() - new Date(b.date_init).getTime()
        );

        for (let i = 1; i < sortedTimeline.length; i++) {
            const currentItem = sortedTimeline[i];
            const previousItem = sortedTimeline[i - 1];

            const currentStart = new Date(currentItem.date_init).getTime();
            const previousEnd = new Date(previousItem.date_end).getTime();

            // Checa se o horário de início da programação atual é antes do final da anterior
            if (currentStart < previousEnd) {
                return false; // Existe um choque de horário
            }
        }

        return true; // Sem choques de horário
    };
    */

    const validateTimeline = (timeline: typeof newFormData.timeline) => {
        // 1. Verifica se a data de início de cada item é anterior à data de fim
        for (const item of timeline) {
            if (item.date_init && item.date_end) {
                const start = new Date(item.date_init).getTime();
                const end = new Date(item.date_end).getTime();

                if (start > end) {
                    // Existe um erro em um item: início depois do fim
                    return false;
                }
            }
        }

        // 2. Continua com a verificação de choque de horários entre os itens
        const validItems = timeline.filter(item => item.date_init && item.date_end);

        if (validItems.length < 2) return true;

        const sortedTimeline = [...validItems].sort((a, b) =>
            new Date(a.date_init).getTime() - new Date(b.date_init).getTime()
        );

        for (let i = 1; i < sortedTimeline.length; i++) {
            const currentItem = sortedTimeline[i];
            const previousItem = sortedTimeline[i - 1];

            const currentStart = new Date(currentItem.date_init).getTime();
            const previousEnd = new Date(previousItem.date_end).getTime();

            if (currentStart < previousEnd) {
                return false; // Existe um choque de horário entre itens
            }
        }

        return true; // Sem choques de horário
    };

    // Função para lidar com a submissão do formulário
    const handleSubmit = async () => {
        setValidationError(null);

        if (!newFormData.name) {
            setValidationError("Preencha o nome da atividade antes de continuar.");
            return;
        }

        if (!newFormData.emoji) {
            setValidationError("Preencha o emoji ou ícone antes de continuar.");
            return;
        }

        if (!newFormData.description) {
            setValidationError("Preencha a descrição antes de continuar.");
            return;
        }

        if (!newFormData.organization_name) {
            setValidationError("Preencha a organização antes de continuar.");
            return;
        }

        if (!newFormData.type) {
            setValidationError("Preencha o tipo da atividade antes de continuar.");
            return;
        }

        if (!newFormData.dateOpen) {
            setValidationError("Preencha a data de abertura antes de continuar.");
            return;
        }

        if (!newFormData.isFree && newFormData.value === 0) {
            setValidationError("A atividade paga precisa ter um valor maior que zero.");
            return;
        }

        for (const [index, timeline] of newFormData.timeline.entries()) {
            if (!timeline.date_end) {
                setValidationError(`Programação ${index + 1}: preencha a data de fim.`);
                return;
            }
            if (!timeline.date_init) {
                setValidationError(`Programação ${index + 1}: preencha a data de início.`);
                return;
            }
            if (!timeline.description) {
                setValidationError(`Programação ${index + 1}: preencha a descrição.`);
                return;
            }
            if (!timeline.local) {
                setValidationError(`Programação ${index + 1}: preencha o local.`);
                return;
            }
            if (!timeline.local_description) {
                setValidationError(`Programação ${index + 1}: preencha a descrição do local.`);
                return;
            }
        }

        if (!validateTimeline(newFormData.timeline)) {
            setValidationError("Há um conflito de horários na programação. Ajuste as datas antes de continuar.");
            return;
        }
        if (!newFormData.timeline.length) {
            setValidationError("Adicione ao menos uma etapa à programação.");
            return;
        }

        setLoading(true)

        try {
            const response = await fetch(apiUrl, {
                method: apiMethod,
                body: JSON.stringify(newFormData)
            })
            const { message }: { message: string } = await response.json()

            if (!response.ok) {
                setValidationError(message || "Não foi possível salvar a atividade.");
                return;
            }

            alert(message)
            await onSuccess();
            await onClose();
            setNewFormData({
                "name": "",
                "emoji": "",
                "description": "",
                "maxParticipants": 0,
                "organization_name": "",
                "dateOpen": "",
                "isFree": true,
                "value": 0,
                "timeline": [],
                "type": "",
                "showToUser": false,
                "isOpen": false,
            })
        } catch {
            setValidationError("Não foi possível salvar a atividade. Verifique sua conexão e tente novamente.");
        } finally {
            setLoading(false)
        }
    };

    return (
        <>
            <LoadingModal isLoading={loading} />
            <div className={styles.dialogViewport}>
                <div
                    aria-hidden="true"
                    className={styles.dialogBackdrop}
                    onClick={onClose}
                />

                <section
                    aria-busy={loading}
                    aria-describedby={introId}
                    aria-labelledby={titleId}
                    aria-modal="true"
                    className={`${styles.modalCard} ${styles.courseCard}`}
                    role="dialog"
                >
                    <header className={styles.modalHeader}>
                        <div className={styles.modalHeading}>
                            <span className={styles.eyebrow}>Configuração de atividade</span>
                            <h2 className={styles.modalTitle} id={titleId}>{title}</h2>
                        </div>
                        <button
                            aria-label="Fechar formulário de atividade"
                            className={styles.closeButton}
                            onClick={onClose}
                            ref={closeButtonRef}
                            type="button"
                        >
                            <X aria-hidden="true" size={22} />
                        </button>
                    </header>

                    <form
                        className={styles.courseForm}
                        id="create-course-form"
                        noValidate
                        onSubmit={(event) => {
                            event.preventDefault();
                            void handleSubmit();
                        }}
                    >
                        <p className={styles.formIntro} id={introId}>
                            Informe os dados de exibição, inscrição e programação da atividade. Os campos principais e ao menos uma etapa da programação são obrigatórios.
                        </p>

                        <div className={styles.formGrid}>
                            <div className={styles.field}>
                                <label htmlFor="name">Nome da atividade</label>
                                <input id="name" name="name" onChange={handleChange} required type="text" value={newFormData.name} />
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="emoji">Emoji ou ícone</label>
                                <div className={styles.emojiField}>
                                    <input id="emoji" name="emoji" onChange={handleChange} required type="text" value={newFormData.emoji} />
                                    <div aria-hidden="true" className={styles.emojiPreview}>
                                        {renderEmojiAsLucide(newFormData.emoji, { size: 22 })}
                                    </div>
                                </div>
                            </div>

                            <div className={`${styles.field} ${styles.fullField}`}>
                                <label htmlFor="description">Descrição</label>
                                <textarea id="description" name="description" onChange={handleChange} required rows={3} value={newFormData.description} />
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="maxParticipants">Máximo de participantes</label>
                                <input id="maxParticipants" min="0" name="maxParticipants" onChange={handleChange} required type="number" value={newFormData.maxParticipants} />
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="organization_name">Organização</label>
                                <input id="organization_name" name="organization_name" onChange={handleChange} required type="text" value={newFormData.organization_name} />
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="type">Tipo</label>
                                <input id="type" name="type" onChange={handleChange} required type="text" value={newFormData.type} />
                            </div>

                            <div className={styles.field}>
                                <label htmlFor="dateOpen">Data de abertura</label>
                                <input id="dateOpen" name="dateOpen" onChange={handleChange} required type="datetime-local" value={newFormData.dateOpen} />
                            </div>

                            <div className={styles.checkboxGrid}>
                                <label className={styles.checkboxCard} htmlFor="isFree">
                                    <input checked={newFormData.isFree} id="isFree" name="isFree" onChange={handleChange} type="checkbox" />
                                    <span>Atividade gratuita</span>
                                </label>
                                <label className={styles.checkboxCard} htmlFor="showToUser">
                                    <input checked={newFormData.showToUser} id="showToUser" name="showToUser" onChange={handleChange} type="checkbox" />
                                    <span>Mostrar para o usuário</span>
                                </label>
                                <label className={styles.checkboxCard} htmlFor="isOpen">
                                    <input checked={newFormData.isOpen} id="isOpen" name="isOpen" onChange={handleChange} type="checkbox" />
                                    <span>Inscrições abertas</span>
                                </label>
                            </div>

                            <div className={`${styles.field} ${styles.fullField}`}>
                                <label htmlFor="value">Valor (R$)</label>
                                <input disabled={newFormData.isFree} id="value" name="value" onChange={handleChange} required type="number" value={newFormData.value} />
                            </div>
                        </div>

                        <section aria-labelledby="timeline-title" className={styles.timelineSection}>
                            <div className={styles.timelineHeader}>
                                <h3 className={styles.timelineTitle} id="timeline-title">Programação</h3>
                                <button className={styles.addButton} onClick={handleAddTimelineItem} type="button">
                                    <Plus aria-hidden="true" size={18} />
                                    Adicionar programação
                                </button>
                            </div>

                            {validationError && (
                                <p aria-live="polite" className={styles.validationError} role="alert">
                                    {validationError}
                                </p>
                            )}

                            <div className={styles.timelineList}>
                                {newFormData.timeline.length === 0 ? (
                                    <div className={styles.timelineEmpty}>
                                        Nenhuma programação adicionada.
                                    </div>
                                ) : (
                                    newFormData.timeline.map((timelineItem, index) => (
                                        <article className={styles.timelineCard} key={timelineItem._id}>
                                            <div className={styles.timelineCardHeader}>
                                                <h4 className={styles.timelineCardTitle}>
                                                    <span className={styles.timelineNumber}>{index + 1}</span>
                                                    Etapa da programação
                                                </h4>
                                                <button
                                                    aria-label={`Remover programação ${index + 1}`}
                                                    className={`${styles.iconButton} ${styles.removeButton}`}
                                                    onClick={() => handleRemoveTimelineItem(index)}
                                                    type="button"
                                                >
                                                    <Trash aria-hidden="true" size={18} />
                                                </button>
                                            </div>

                                            <div className={styles.timelineGrid}>
                                                <div className={`${styles.field} ${styles.fullField}`}>
                                                    <label htmlFor={`timeline-name-${index}`}>Nome da etapa</label>
                                                    <input id={`timeline-name-${index}`} name="name" onChange={(event) => handleTimelineChange(index, event)} type="text" value={timelineItem.name} />
                                                </div>
                                                <div className={styles.field}>
                                                    <label htmlFor={`timeline-date_init-${index}`}>Data de início</label>
                                                    <input id={`timeline-date_init-${index}`} name="date_init" onChange={(event) => handleTimelineChange(index, event)} type="datetime-local" value={timelineItem.date_init} />
                                                </div>
                                                <div className={styles.field}>
                                                    <label htmlFor={`timeline-date_end-${index}`}>Data de fim</label>
                                                    <input id={`timeline-date_end-${index}`} name="date_end" onChange={(event) => handleTimelineChange(index, event)} type="datetime-local" value={timelineItem.date_end} />
                                                </div>
                                                <div className={`${styles.field} ${styles.fullField}`}>
                                                    <label htmlFor={`timeline-description-${index}`}>Descrição da etapa</label>
                                                    <textarea id={`timeline-description-${index}`} name="description" onChange={(event) => handleTimelineChange(index, event)} rows={2} value={timelineItem.description} />
                                                </div>
                                                <div className={styles.field}>
                                                    <label htmlFor={`timeline-local-${index}`}>Local</label>
                                                    <input id={`timeline-local-${index}`} name="local" onChange={(event) => handleTimelineChange(index, event)} type="text" value={timelineItem.local} />
                                                </div>
                                                <div className={styles.field}>
                                                    <label htmlFor={`timeline-local_description-${index}`}>Descrição do local</label>
                                                    <input id={`timeline-local_description-${index}`} name="local_description" onChange={(event) => handleTimelineChange(index, event)} type="text" value={timelineItem.local_description} />
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                )}
                            </div>
                        </section>
                    </form>

                    <footer className={styles.modalFooter}>
                        <button
                            className={styles.secondaryButton}
                            disabled={loading}
                            onClick={onClose}
                            type="button"
                        >
                            Cancelar
                        </button>
                        <button
                            className={styles.primaryButton}
                            disabled={loading}
                            form="create-course-form"
                            type="submit"
                        >
                            {buttonText}
                        </button>
                    </footer>
                </section>
            </div>
        </>
    );
};

export default CreateCourseModal
