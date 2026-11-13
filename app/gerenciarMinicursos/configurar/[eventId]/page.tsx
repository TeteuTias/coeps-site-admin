"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CreateCourseModal from "@/app/components/CreateCourseModal";
import { Cabecalho, BotaoLink, Cartao, Pagina } from "@/app/components/ui";
import { Estado } from "@/app/components/Estado";
import { ICourse } from "@/app/lib/types/events/event.t";

type CourseResponse = {
    data?: ICourse;
    message?: string;
};

const VOLTAR = { href: "/gerenciarMinicursos/", rotulo: "Voltar às atividades" };

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
            const response = await fetchData.json().catch(() => ({})) as CourseResponse;

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
            <Pagina largura="estreita">
                <Cabecalho etiqueta="Atividades" titulo="Configurar atividade" voltar={VOLTAR} />
                {error && !loading ? (
                    <Estado
                        tipo="erro"
                        titulo="Não foi possível abrir a configuração"
                        texto={error}
                        aoTentar={() => void hydrateData()}
                        acao={<BotaoLink href={VOLTAR.href} estilo="contorno">Voltar</BotaoLink>}
                    />
                ) : (
                    <Estado tipo="carregando" titulo="Carregando os dados da atividade…" linhas={2} />
                )}
            </Pagina>
        );
    }

    return (
        <Pagina largura="estreita">
            <Cabecalho etiqueta="Atividades" titulo="Configurar atividade" sub={dataCourse.name} voltar={VOLTAR} />
            <Cartao>
                <p className="text-sm text-sutil">As alterações só valem depois de salvar no formulário de edição.</p>
            </Cartao>

            <CreateCourseModal
                apiMethod="PUT"
                apiUrl="/api/put/minicursos/alterarInformacoes/"
                buttonText="Atualizar atividade"
                initialForms={{
                    ...dataCourse,
                    // datetime-local mostra "AAAA-MM-DDTHH:mm": tira segundos e fuso salvos
                    dateOpen: dataCourse.dateOpen.slice(0, 16),
                    timeline: dataCourse.timeline.map((time) => ({
                        ...time,
                        date_init: time.date_init.slice(0, 16),
                        date_end: time.date_end.slice(0, 16),
                    })),
                }}
                isOpen
                onClose={() => {
                    router.push("/gerenciarMinicursos/");
                }}
                // a lista recarrega ao ser aberta de novo, então não há o que atualizar aqui
                onSuccess={() => { }}
                title={dataCourse.name}
            />
        </Pagina>
    );
}
