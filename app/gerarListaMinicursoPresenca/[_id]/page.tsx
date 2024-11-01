'use client'
import { useEffect, useState } from 'react';

interface Usuario {
    _id: string,
    informacoes_usuario: {
        cpf: string;
        data_criacao: string;
        email: string;
        nome: string;
        numero_telefone: string;
        titulo_honorario: string;
    };
}

const MyComponent = ({ params }: { params: { _id: string } }) => {
    const [data, setData] = useState<string[]>([]);
    const [errorBolean, setErrorBolean] = useState<boolean>(false);
    const [data2, setData2] = useState<Usuario[]>([]);
    const [dataPresentes, setDataPresente] = useState<string[]>([])

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [loadingContent, setLoadingContent] = useState<boolean>(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log(params._id);

                // Função auxiliar para obter dados de participantes e lista de presença
                const fetchParticipantAndAttendanceData = async () => {
                    const [participantsResponse, attendanceResponse] = await Promise.all([
                        fetch(`/api/get/participantesMinicursos/${params._id}`),
                        fetch(`/api/get/listaDePresenca/${params._id}`)
                    ]);

                    if (!participantsResponse.ok || !attendanceResponse.ok) {
                        throw new Error("Erro ao buscar dados de participantes ou lista de presença");
                    }

                    const participantsResult: { data: string[] } = await participantsResponse.json();
                    const attendanceResult: { data: string[] } = await attendanceResponse.json();

                    setData(participantsResult.data);
                    setDataPresente(attendanceResult.data);

                    return participantsResult.data; // Retorna a lista de participantes para uso no fetchUserInfo
                };

                // Função auxiliar para buscar informações detalhadas dos usuários
                const fetchUserInfo = async (userIds: string[]) => {
                    const response = await fetch("/api/post/informacoesVariosUsuarios", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(userIds),
                    });

                    if (!response.ok) {
                        throw new Error("Erro na resposta da API de informações de usuários");
                    }

                    const result: { data: Usuario[] } = await response.json();
                    setData2(result.data);
                };

                // Chamada das funções auxiliares
                const participantIds = await fetchParticipantAndAttendanceData(); // Obtém a lista de participantes
                await fetchUserInfo(participantIds); // Passa a lista para buscar informações detalhadas

            } catch (error) {
                setErrorBolean(true)
                setError("OCORREU ALGO ERRADO. RECARREGUE");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [params._id]);



    if (loading) {
        return <div className="text-center">Carregando...</div>;
    }

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    return (
        <div className="min-h-screen flex flex-col items-center">
            <LoadingModal isLoading={loadingContent} />
            <div className="overflow-auto w-full lg:w-2/3">
                <table className="min-w-full table-auto border-collapse border border-gray-200">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-4 border border-gray-300 w-1/3">Lista de Presença</th>
                            <th className="p-4 border border-gray-300 w-1/3">{new Date().toDateString()}</th>
                            <th className="p-4 border border-gray-300 w-1/3">{new Date().toTimeString()}</th>
                        </tr>
                    </thead>
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-4 border border-gray-300 w-1/3">Nome</th>
                            <th className="p-4 border border-gray-300 w-1/3">Email</th>
                            <th className="p-4 border border-gray-300 w-1/3">Presença/Falta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data2.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-100">
                                <td className="p-4 border border-gray-300 text-black text-center">
                                    {index + 1}. {item.informacoes_usuario.nome}
                                </td>
                                <td className="p-4 border border-gray-300 text-black text-center">
                                    {item.informacoes_usuario.email}
                                </td>
                                <td className="p-4 border border-gray-300 text-black text-center">
                                    <p className=" p-2 w-full">{dataPresentes.includes(item._id) ? "PRESENTE" : "AUSÊNTE"}</p>
                                    <button className="bg-red-400 p-2 w-1/2"
                                        onClick={async () => {
                                            setLoadingContent(true)
                                            try {

                                                if (dataPresentes.includes(item._id)) {
                                                    // retirar a presença
                                                    const response = await fetch(`/api/post/retirarPresenca`, {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                        },
                                                        body: JSON.stringify({
                                                            eventId: params._id,
                                                            userId: item._id,
                                                        }),
                                                    });
                                                    if (response.ok) {
                                                        setDataPresente(prev => prev.filter(id => id !== item._id));
                                                    }
                                                    return;

                                                }
                                                // dar presença;
                                                const response = await fetch(`/api/post/darPresenca`, {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        eventId: params._id,
                                                        userId: item._id,
                                                    }),
                                                });
                                                if (response.ok) {
                                                    setDataPresente(prev => [...prev, item._id])
                                                }
                                            }
                                            catch {
                                                setErrorBolean(true)
                                            }
                                            finally {
                                                setLoadingContent(false)
                                            }
                                        }}
                                    >{dataPresentes.includes(item._id) ? "RETIRAR PRESENÇA" : "DAR PRESENÇA"}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface LoadingModalProps {
    isLoading: boolean;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ isLoading }) => {
    return (
        <>
            {isLoading && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50">
                    <span className="text-white text-2xl font-semibold">Carregando...</span>
                </div>
            )}
        </>
    );
};

const ErrorModal: React.FC<LoadingModalProps> = ({ isLoading }) => {
    return (
        <>
            {isLoading && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50">
                    <span className="text-white text-2xl font-semibold">Ocorreu Algum Erro. Recarregue a página.</span>
                </div>
            )}
        </>
    );
};


export default MyComponent;
