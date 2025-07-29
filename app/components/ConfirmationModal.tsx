import React, { useEffect } from 'react';

// 1. Definindo a interface para as propriedades do componente
export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: React.ReactNode;
    confirmText?: string;
    cancelText?: string; 
}

/**
 * Um componente de modal de confirmação genérico e reutilizável em TypeScript.
 */
const ConfirmationModal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    children,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
}) => {
    // Se não estiver aberto, não renderiza nada
    // Efeito para fechar o modal com a tecla "Escape"
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);

        // Limpa o event listener quando o componente é desmontado
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);
    if (!isOpen) {
        return null;
    }


    return (
        // Contêiner principal do modal (overlay)
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[5000] flex items-center justify-center p-4"
        >
            {/* Fundo semi-transparente */}
            <div
                className="absolute inset-0 bg-black bg-opacity-60"
                onClick={onClose}
            ></div>

            {/* Conteúdo do Modal */}
            <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
                {/* Cabeçalho */}
                <div className="flex items-start justify-between border-b border-gray-200 p-5">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button
                        type="button"
                        className="ml-auto inline-flex items-center rounded-lg p-1.5 text-sm text-gray-400 hover:text-gray-900"
                        onClick={onClose}
                        aria-label="Fechar modal"
                    >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                            ></path>
                        </svg>
                    </button>
                </div>

                {/* Corpo do Modal */}
                <div className="p-6 text-gray-600">{children}</div>

                {/* Rodapé com os botões */}
                <div className="flex items-center justify-end space-x-4 border-t border-gray-200 p-5">
                    <button
                        type="button"
                        className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-200"
                        onClick={onClose}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className="rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;