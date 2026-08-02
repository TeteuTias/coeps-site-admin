"use client";

import React, { useEffect, useId, useRef } from "react";
import styles from "./CiepsAdmin.module.css";

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
 * Modal de confirmação genérico e reutilizável.
 */
const ConfirmationModal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    children,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
}) => {
    const titleId = useId();
    const descriptionId = useId();
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previouslyFocusedElement = document.activeElement as HTMLElement | null;
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleEsc);
        closeButtonRef.current?.focus();

        return () => {
            window.removeEventListener("keydown", handleEsc);
            previouslyFocusedElement?.focus();
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className={styles.dialogViewport}>
            <div
                aria-hidden="true"
                className={styles.dialogBackdrop}
                onClick={onClose}
            />

            <section
                aria-describedby={descriptionId}
                aria-labelledby={titleId}
                aria-modal="true"
                className={`${styles.modalCard} ${styles.confirmationCard}`}
                role="dialog"
            >
                <header className={styles.modalHeader}>
                    <div className={styles.modalHeading}>
                        <span className={styles.eyebrow}>Confirmação CIEPS</span>
                        <h2 className={styles.modalTitle} id={titleId}>
                            {title}
                        </h2>
                    </div>

                    <button
                        aria-label="Fechar modal"
                        className={styles.closeButton}
                        onClick={onClose}
                        ref={closeButtonRef}
                        type="button"
                    >
                        <svg
                            aria-hidden="true"
                            fill="currentColor"
                            focusable="false"
                            height="20"
                            viewBox="0 0 20 20"
                            width="20"
                        >
                            <path
                                clipRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                fillRule="evenodd"
                            />
                        </svg>
                    </button>
                </header>

                <div className={styles.modalBody} id={descriptionId}>
                    {children}
                </div>

                <footer className={styles.modalFooter}>
                    <button
                        className={styles.secondaryButton}
                        onClick={onClose}
                        type="button"
                    >
                        {cancelText}
                    </button>
                    <button
                        className={styles.primaryButton}
                        onClick={onConfirm}
                        type="button"
                    >
                        {confirmText}
                    </button>
                </footer>
            </section>
        </div>
    );
};

export default ConfirmationModal;
