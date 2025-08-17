"use client"

import { useCallback, useEffect, useState } from "react"
import { ICourse } from "@/app/lib/types/events/event.t"
import LoadingModal from "@/app/components/LoadingModal"
import CreateCourseModal from "@/app/components/CreateCourseModal"
import { useRouter } from "next/navigation"
//
//
export default function Page({ params }: { params: { eventId: string } }) {
    const [dataCourse, setDataCourse] = useState<ICourse | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const router = useRouter()

    //
    //
    const hydrateData = useCallback(async () => {
        const fetchData = await fetch(`/api/get/minicursoProps/${params.eventId}`);
        if (!fetchData.ok) {
            const response = await fetchData.json();
            alert(response.message);
        }
        const { data } = await fetchData.json();
        setDataCourse(data);
        setLoading(false);
    }, [params.eventId]);

    useEffect(() => {
        hydrateData()

    }, [hydrateData])
    //



    if (!dataCourse) {
        return (
            <>
            </>
        )
    }

    //
    //
    return (
        <div>
            <LoadingModal isLoading={loading} />
            <div className="w-full flex flex-col">
                <CreateCourseModal title={dataCourse.name} buttonText="Atualizar Minicurso" apiMethod="PUT" apiUrl="/api/put/minicursos/alterarInformacoes/" onClose={() => {
                    router.push("/gerenciarMinicursos/")
                }} onSuccess={() => { window.location.reload() }} isOpen initialForms={{
                    ...dataCourse,
                    dateOpen: dataCourse.dateOpen.slice(0, -6), // ele vai consertar no próprio componente e vai colocar o fuso
                    timeline: dataCourse.timeline.map((time) => ({
                        ...time,
                        date_init: time.date_init.slice(0, -6), // ele vai consertar no próprio componente e vai colocar o fuso
                        date_end: time.date_end.slice(0, -6) // ele vai consertar no próprio componente e vai colocar o fuso
                    })
                    )
                }} />
            </div>
        </div>
    )
}