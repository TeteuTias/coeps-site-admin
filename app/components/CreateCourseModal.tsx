"use client"

import { useState } from "react";
import { ICourse } from "../lib/types/events/event.t";
import LoadingModal from "./LoadingModal";
import { ObjectId } from "bson";
import { X, Plus, Trash } from "lucide-react";
import { renderEmojiAsLucide } from "@/app/lib/utils/emojiToLucide";
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

const CreateCourseModal: React.FC<CreateCourseModalProps> = ({ title = "Criar Novo Minicurso", buttonText = "Criar Minicurso", apiMethod = "POST", apiUrl = "/api/post/criarNovoMinicurso/", isOpen, onClose, onSuccess, initialForms = {
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
        //e.preventDefault();
        //
        if (!newFormData.name) {
            alert("Preencha o campo 'Nome do Minicurso' antes de continuar.");
            return; // Impede a submissão do formulário
        }

        if (!newFormData.emoji) {
            alert("Preencha o campo 'Emoji' antes de continuar.");
            return; // Impede a submissão do formulário
        }

        if (!newFormData.description) {
            alert("Preencha o campo 'Descrição' antes de continuar.");
            return; // Impede a submissão do formulário
        }

        if (!newFormData.organization_name) {
            alert("Preencha o campo 'Organização' antes de continuar.");
            return; // Impede a submissão do formulário
        }

        if (!newFormData.type) {
            alert("Preencha o campo 'Tipo' antes de continuar.");
            return; // Impede a submissão do formulário
        }

        if (!newFormData.dateOpen) {
            alert("Preencha o campo 'Data Abertura' antes de continuar.");
            return; // Impede a submissão do formulário
        }

        if (!newFormData.isFree && newFormData.value === 0) {
            alert("Você configurou o Minicurso como 'Pago'. Assim, é necessário colocar um valor maior que 0 antes de continuar.");
            return; // Impede a submissão do formulário
        }


        newFormData.timeline.forEach((timeline, index) => {
            if (!timeline.date_end) {
                alert(`Programação ${index + 1} - Preencha o campo 'Data de Fim' antes de continuar.`);
                return; // Impede a submissão do formulário
            }
            if (!timeline.date_init) {
                alert(`Programação ${index + 1} - Preencha o campo 'Data de Início' antes de continuar.`);
                return; // Impede a submissão do formulário
            }
            if (!timeline.description) {
                alert(`Programação ${index + 1} - Preencha o campo 'Descrição' antes de continuar.`);
                return; // Impede a submissão do formulário
            }
            if (!timeline.local) {
                alert(`Programação ${index + 1} - Preencha o campo 'Local' antes de continuar.`);
                return; // Impede a submissão do formulário
            }
            if (!timeline.local_description) {
                alert(`Programação ${index + 1} - Preencha o campo 'Descrição do Local' antes de continuar.`);
                return; // Impede a submissão do formulário
            }
        })


        // Antes de submeter, valida a timeline
        if (!validateTimeline(newFormData.timeline)) {
            alert("Há um choque de horários na 'Programação'. Por favor, ajuste as datas e horários.");
            return; // Impede a submissão do formulário
        }
        if (!newFormData.timeline.length) {
            alert("Preencha o campo programação antes de continuar.");
            return; // Impede a submissão do formulário
        }

        setLoading(true)
        // Se a validação passar, continua com a submissão
        const response = await fetch(apiUrl, {
            method: apiMethod,
            body: JSON.stringify(newFormData)
        })
        if (!response.ok) {
            const { message }: { message: string } = await response.json()
            alert(message)
            setLoading(false)
            return;
        }
        const { message }: { message: string } = await response.json()
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
        setLoading(false)
    };

    return (
        <>
            <LoadingModal isLoading={loading} />
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <header className="flex items-center justify-between p-6 border-b border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                        <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100"><X size={24} /></button>
                    </header>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {/* CAMPOS PRINCIPAIS */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nome do Minicurso</label>
                                <input type="text" id="name" name="name" value={newFormData.name} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                            </div>
                            <div>
                                <label htmlFor="emoji" className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                                <div className="flex items-center gap-3">
                                    <input type="text" id="emoji" name="emoji" value={newFormData.emoji} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                                    <div className="flex items-center justify-center w-12 h-12 rounded-md bg-gray-50 border border-gray-200">
                                        {renderEmojiAsLucide(newFormData.emoji, { size: 22, className: "text-indigo-600" })}
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea id="description" name="description" rows={3} value={newFormData.description} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                            </div>
                            <div>
                                <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-1">Máx. Participantes</label>
                                <input type="number" id="maxParticipants" name="maxParticipants" value={newFormData.maxParticipants} onChange={handleChange} min="0" className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                            </div>
                            <div>
                                <label htmlFor="organization_name" className="block text-sm font-medium text-gray-700 mb-1">Organização</label>
                                <input type="text" id="organization_name" name="organization_name" value={newFormData.organization_name} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                            </div>
                            <div>
                                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <input type="text" id="type" name="type" value={newFormData.type} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                            </div>
                            <div>
                                <label htmlFor="dateOpen" className="block text-sm font-medium text-gray-700 mb-1">Data de Abertura</label>
                                <input type="datetime-local" id="dateOpen" name="dateOpen" value={newFormData.dateOpen} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                                <div className="flex items-center">
                                    <input type="checkbox" id="isFree" name="isFree" checked={newFormData.isFree} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" required />
                                    <label htmlFor="isFree" className="ml-2 text-sm text-gray-900">Minicurso Gratuito?</label>
                                </div>
                                <div className="flex items-center">
                                    <input type="checkbox" id="showToUser" name="showToUser" checked={newFormData.showToUser} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" required />
                                    <label htmlFor="showToUser" className="ml-2 text-sm text-gray-900">Mostrar para o usuário?</label>
                                </div>
                                <div className="flex items-center">
                                    <input type="checkbox" id="isOpen" name="isOpen" checked={newFormData.isOpen} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" required />
                                    <label htmlFor="isOpen" className="ml-2 text-sm text-gray-900">Inscrições Abertas?</label>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                                <input type="number" id="value" name="value" value={newFormData.value} onChange={handleChange} disabled={newFormData.isFree} className={`w-full p-2 border border-gray-300 rounded-lg focus:outline-none ${newFormData.isFree ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-2 focus:ring-indigo-500'}`} required />
                            </div>
                        </div>

                        {/* TIMELINE DINÂMICA */}
                        <div className="w-full space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="text-xl font-bold text-gray-800">Programação</p>
                                <button
                                    type="button"
                                    onClick={handleAddTimelineItem}
                                    className="flex items-center text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg"
                                >
                                    <Plus size={18} className="mr-1" /> Adicionar Programação
                                </button>
                            </div>
                            {validationError && (
                                <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                                    {validationError}
                                </p>
                            )}
                            <div className="border border-gray-300 p-2 w-full rounded-lg space-y-4">
                                {
                                    newFormData.timeline.length === 0 ?
                                        <div className="w-full flex items-center justify-center p-4">
                                            <p className="text-gray-500 italic">Nenhuma programação adicionada.</p>
                                        </div>
                                        :
                                        newFormData.timeline.map((timelineItem, index) => (
                                            <div key={timelineItem._id} className="relative p-4 border border-gray-200 rounded-lg">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="font-bold text-lg">Programação {index + 1}</h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTimelineItem(index)}
                                                        className="p-1 text-red-500 hover:bg-gray-100 rounded-full"
                                                    >
                                                        <Trash size={20} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                                    <div className="md:col-span-2">
                                                        <label htmlFor={`timeline-name-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Nome da Etapa</label>
                                                        <input type="text" id={`timeline-name-${index}`} name="name" value={timelineItem.name} onChange={(e) => handleTimelineChange(index, e)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`timeline-date_init-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Data de Início</label>
                                                        <input type="datetime-local" id={`timeline-date_init-${index}`} name="date_init" value={timelineItem.date_init} onChange={(e) => handleTimelineChange(index, e)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`timeline-date_end-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Data de Fim</label>
                                                        <input type="datetime-local" id={`timeline-date_end-${index}`} name="date_end" value={timelineItem.date_end} onChange={(e) => handleTimelineChange(index, e)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label htmlFor={`timeline-description-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Descrição da Etapa</label>
                                                        <textarea id={`timeline-description-${index}`} name="description" rows={2} value={timelineItem.description} onChange={(e) => handleTimelineChange(index, e)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`timeline-local-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                                                        <input type="text" id={`timeline-local-${index}`} name="local" value={timelineItem.local} onChange={(e) => handleTimelineChange(index, e)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <label htmlFor={`timeline-local_description-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Descrição do Local</label>
                                                        <input type="text" id={`timeline-local_description-${index}`} name="local_description" value={timelineItem.local_description} onChange={(e) => handleTimelineChange(index, e)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                }
                            </div>
                        </div>
                    </form>

                    <footer className="flex justify-end p-6 border-t border-gray-200 gap-2">
                        <button
                            onClick={onClose}
                            type="button"
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => { handleSubmit() }}
                            form="create-course-form"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                        >
                            {buttonText}
                        </button>
                    </footer>
                </div>
            </div>
        </>
    );
};

export default CreateCourseModal