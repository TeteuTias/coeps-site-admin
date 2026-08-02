"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Settings2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import CreateCourseModal from "@/app/components/CreateCourseModal";
import LoadingModal from "@/app/components/LoadingModal";
import styles from "@/app/components/CiepsAdmin.module.css";
import { ICourse } from "@/app/lib/types/events/event.t";

type CourseResponse = {
    data?: ICourse;
    message?: string;
};

export default function Page() {
    const { eventId } = useParams<{ eventId: string }>();
    const [dataCourse, setDataCourse] = useState<ICourse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const hydrateData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const fetchData = await fetch(`/api/get/minicursoProps/${eventId}`);
            const response = await fetchData.json() as CourseResponse;

            if (!fetchData.ok || !response.data) {
                throw new Error(response.message || "Não foi possível carregar os dados da atividade.");
            }

            setDataCourse(response.data);
        } catch (requestError) {
            const message = requestError instanceof Error
                ? requestError.message
                : "Não foi possível carregar os dados da atividade.";

            setDataCourse(null);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        void hydrateData();
    }, [hydrateData]);

    if (!dataCourse) {
        return (
            <main className={styles.configPage}>
                <LoadingModal isLoading={loading} />
                <section
                    aria-live="polite"
                    className={styles.configStateCard}
                    role={error ? "alert" : "status"}
                >
                    <span className={styles.eyebrow}>Administração CIEPS</span>
                    <div className={styles.configStateIcon}>
                        <Settings2 aria-hidden="true" size={34} />
                    </div>
                    <h1 className={styles.configStateTitle}>
                        {error ? "Não foi possível abrir a configuração" : "Carregando configuração"}
                    </h1>
                    <p className={styles.configStateText}>
                        {error || "Estamos buscando os dados mais recentes desta atividade."}
                    </p>

                    {error && (
                        <div className={styles.stateActions}>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => router.push("/gerenciarMinicursos/")}
                                type="button"
                            >
                                <ArrowLeft aria-hidden="true" size={18} />
                                Voltar
                            </button>
                            <button
                                className={styles.primaryButton}
                                onClick={() => void hydrateData()}
                                type="button"
                            >
                                <RefreshCw aria-hidden="true" size={18} />
                                Tentar novamente
                            </button>
                        </div>
                    )}
                </section>
            </main>
        );
    }

    return (
        <main className={styles.configPage}>
            <LoadingModal isLoading={loading} />
            <div aria-hidden="true" className={styles.configStateCard}>
                <span className={styles.eyebrow}>Administração CIEPS</span>
                <h1 className={styles.configStateTitle}>Configurar atividade</h1>
                <p className={styles.configStateText}>{dataCourse.name}</p>
            </div>

            <CreateCourseModal
                apiMethod="PUT"
                apiUrl="/api/put/minicursos/alterarInformacoes/"
                buttonText="Atualizar atividade"
                initialForms={{
                    ...dataCourse,
                    dateOpen: dataCourse.dateOpen.slice(0, -6),
                    timeline: dataCourse.timeline.map((time) => ({
                        ...time,
                        date_init: time.date_init.slice(0, -6),
                        date_end: time.date_end.slice(0, -6),
                    })),
                }}
                isOpen
                onClose={() => {
                    router.push("/gerenciarMinicursos/");
                }}
                onSuccess={() => {
                    window.location.reload();
                }}
                title={dataCourse.name}
            />
        </main>
    );
}
