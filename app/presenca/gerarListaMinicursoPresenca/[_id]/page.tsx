'use client'
import { IUser } from '@/app/lib/types/user/user.t';
import { useEffect, useState } from 'react';
import { Html5Qrcode, CameraDevice, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import LoadingModal from '@/app/components/LoadingModal';
import { useRef } from 'react';
import { ICourse } from '@/app/lib/types/events/event.t';
import ConfirmationModal, { ModalProps } from '@/app/components/ConfirmationModal';
//
//
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
    const [allUsers, setAllUsers] = useState<IUser[]>([])
    const [errorBolean, setErrorBolean] = useState<boolean>(false);
    const [data2, setData2] = useState<Usuario[]>([]);
    const [dataPresentes, setDataPresente] = useState<string[]>([])
    const [courseData, setCourseData] = useState<ICourse | null>(null)
    const [isModalProps, setIsModalProps] = useState<ModalProps>({
        isOpen: false,
        onClose: () => {
            setIsModalProps((prev) => ({ ...prev, isOpen: false }))
        },
        onConfirm: () => { },
        title: "Atenção!",
        children: (
            <>
                <p className='text-black'></p>
            </>
        ), // Tipo para qualquer elemento React válido
        confirmText: "Continuar",
        cancelText: "Fechar",
    })
    const [isOpenAllUsers, setIsOpenAllUsers] = useState<boolean>(false)


    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [loadingContent, setLoadingContent] = useState<boolean>(false)
    const hydrateData = async () => {
        try {
            // Função auxiliar para obter dados de participantes e lista de presença
            const fetchParticipantAndAttendanceData = async () => {
                const [participantsResponse, attendanceResponse, courseResponse, allUsersResponse] = await Promise.all([
                    fetch(`/api/get/participantesMinicursos/${params._id}`),
                    fetch(`/api/get/listaDePresenca/${params._id}`),
                    fetch(`/api/get/minicursoProps/${params._id}`),
                    fetch(`/api/get/todosCongressistas/`),
                ]);

                if (!participantsResponse.ok || !attendanceResponse.ok || !courseResponse.ok || !allUsersResponse.ok) {
                    throw new Error("Erro ao buscar dados de participantes ou lista de presença");
                }

                const participantsResult: { data: string[] } = await participantsResponse.json();
                const attendanceResult: { data: string[] } = await attendanceResponse.json();
                const courseResult: { data: ICourse } = await courseResponse.json()
                const allUsersResult: { data: IUser[] } = await allUsersResponse.json()

                setData(participantsResult.data);
                setDataPresente(attendanceResult.data);
                setCourseData(courseResult.data)
                setAllUsers(allUsersResult.data)

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

    //
    //
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Função auxiliar para obter dados de participantes e lista de presença
                const fetchParticipantAndAttendanceData = async () => {
                    const [participantsResponse, attendanceResponse, courseResponse, allUsersResponse] = await Promise.all([
                        fetch(`/api/get/participantesMinicursos/${params._id}`),
                        fetch(`/api/get/listaDePresenca/${params._id}`),
                        fetch(`/api/get/minicursoProps/${params._id}`),
                        fetch(`/api/get/todosCongressistas/`),
                    ]);

                    if (!participantsResponse.ok || !attendanceResponse.ok || !courseResponse.ok || !allUsersResponse.ok) {
                        throw new Error("Erro ao buscar dados de participantes ou lista de presença");
                    }

                    const participantsResult: { data: string[] } = await participantsResponse.json();
                    const attendanceResult: { data: string[] } = await attendanceResponse.json();
                    const courseResult: { data: ICourse } = await courseResponse.json()
                    const allUsersResult: { data: IUser[] } = await allUsersResponse.json()

                    setData(participantsResult.data);
                    setDataPresente(attendanceResult.data);
                    setCourseData(courseResult.data)
                    setAllUsers(allUsersResult.data)

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
        return <div className="w-full h-screen flex items-center content-center justify-center text-center">
            <p>
                CARREGANDO
            </p>
        </div>;
    }

    if (error || !courseData) {
        return <div className="text-red-500">{error}</div>;
    }

    return (
        <div className="min-h-screen flex flex-col items-center py-5 space-y-5">
            <h1>{courseData.name}</h1>{/* Título */}
            <QRCodeScanner courseData={courseData} hydrateData={hydrateData} />
            <LoadingModal isLoading={loadingContent} />
            <ConfirmationModal {...isModalProps} />
            {
                isOpenAllUsers &&
                <AllUsersModal courseData={courseData} isOpen={true} onClose={() => { setIsOpenAllUsers(false) }} onUserSelect={async (userId: string) => {
                    //
                    setLoadingContent(true)
                    // dar presença;
                    const response = await fetch(`/api/post/darPresenca`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            eventId: params._id,
                            userId: userId,
                        }),
                    });
                    if (response.ok) {
                        setDataPresente(prev => [...prev, userId])
                    } else {
                        alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                        setLoadingContent(false)
                        return;
                    }
                    await hydrateData()
                    setIsOpenAllUsers(false)
                    setLoadingContent(false)
                }} usersData={allUsers} />
            }
            <button
                onClick={() => {
                    setIsOpenAllUsers(true)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
                Adicionar Usuário
            </button>

            <div className="overflow-auto w-full lg:w-[80%]">
                <table className="min-w-full table-auto border-collapse border border-gray-200">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-4 border border-gray-300 w-1/3">Lista de Presença</th>
                            <th className="p-4 border border-gray-300 w-1/3">{new Date().toDateString()}</th>
                            <th className="p-4 border border-gray-300 w-1/3">{new Date().toTimeString()}</th>
                            <th className="p-4 border border-gray-300 w-1/3">-</th>
                        </tr>
                    </thead>
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-4 border border-gray-300 w-1/3">Nome</th>
                            <th className="p-4 border border-gray-300 w-1/3">Email</th>
                            <th className="p-4 border border-gray-300 w-1/3">Presença/Falta</th>
                            <th className="p-4 border border-gray-300 w-1/3">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data2.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-100">
                                <td className="p-4 border border-gray-300 text-black text-center space-x-2">
                                    <button className='bg-red-500 w-fit w-[25px] h-[25px] flex items-center content-center justify-center rounded-full font-extrabold text-white'
                                        onClick={() => {
                                            setIsModalProps(() => ({
                                                isOpen: true,
                                                onClose: () => {
                                                    setIsModalProps((prev) => ({ ...prev, isOpen: false }))
                                                },
                                                onConfirm: async () => {
                                                    setLoading(true)
                                                    const response = await fetch("/api/delete/removerInscricaoMinicurso/", {
                                                        method: "DELETE",
                                                        body: JSON.stringify({
                                                            eventId: params._id,
                                                            userId: item._id,
                                                        }),
                                                    })
                                                    if (!response.ok) {
                                                        alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                                                    }
                                                    await hydrateData()
                                                    setLoading(false)
                                                    setIsModalProps((prev) => ({ ...prev, isOpen: false }))

                                                },
                                                title: "Atenção!",
                                                children: (
                                                    <>
                                                        <p className='text-black'>Você está prestes a retirar a inscrição do usuário do minicurso. Essa opção <span className='font-extrabold text-red-500'>NÃO</span> estornará o valor ao congressista. Deseja mesmo continuar?</p>
                                                    </>
                                                ), // Tipo para qualquer elemento React válido
                                                confirmText: "Continuar", // Propriedade opcional
                                                cancelText: "Fechar",  // Propriedade opcional
                                            }))
                                        }}
                                    >
                                        x
                                    </button>
                                    <p>
                                        {index + 1}. {item.informacoes_usuario.nome}
                                    </p>
                                </td>
                                <td className="p-4 border border-gray-300 text-black text-center">
                                    {item.informacoes_usuario.email}
                                </td>
                                <td className="p-4 border border-gray-300 text-black text-center">
                                    <p className=" p-2 w-full">{dataPresentes.includes(item._id) ? "PRESENTE" : "AUSENTE"}</p>
                                </td>
                                <td className='w-full'>
                                    <button className="bg-red-400 p-2 mx-1"
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
        </div >
    );
};






//
//
//
const QRCodeScanner: React.FC<{ courseData: ICourse, hydrateData: () => Promise<void> }> = ({ courseData, hydrateData }) => {
    // Estado para controlar a visibilidade do scanner
    const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
    // Estado para armazenar a lista de câmeras disponíveis
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    // Estado para armazenar o ID da câmera selecionada
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    // Estado para armazenar o resultado do QR Code lido
    const [qrCodeResult, setQrCodeResult] = useState<string | null>(null);

    // Referência para a instância do leitor de QR Code para podermos controlá-la
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const readerId = "qr-code-reader"; // ID do elemento div onde o vídeo da câmera será renderizado

    // Hook para buscar as câmeras disponíveis quando o scanner for aberto
    useEffect(() => {
        const fetchCameras = async () => {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    setCameras(devices);
                    // Seleciona a primeira câmera da lista como padrão
                    if (!selectedCameraId) {
                        setSelectedCameraId(devices[0].id);
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar câmeras:', error);
            }
        };

        if (isScannerOpen) {
            fetchCameras();
        }
    }, [isScannerOpen, selectedCameraId]);

    // Hook para iniciar e parar o scanner
    useEffect(() => {
        // Inicia o scanner apenas se estiver aberto e uma câmera for selecionada
        if (isScannerOpen && selectedCameraId) {
            // Cria uma nova instância do leitor de QR code
            const html5QrCode = new Html5Qrcode(readerId);
            html5QrCodeRef.current = html5QrCode;

            // Função de callback para quando um QR Code for lido com sucesso
            const qrCodeSuccessCallback = (decodedText: string) => {
                setQrCodeResult(decodedText);
                closeScanner(); // Fecha o scanner automaticamente após a leitura
            };

            // Configurações do scanner
            const config: Html5QrcodeCameraScanConfig = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                // aspectRatio: 1.0,
            };

            // Inicia o scanner
            html5QrCode.start(
                selectedCameraId,
                config,
                qrCodeSuccessCallback,
                (errorMessage) => {
                    // issaqui dá erro toda hora, e os erros não alteram a funcionalidade. então deixa isso pra lá, não compensa mostrar o erro na tela;
                }
            ).catch((err) => {
                console.error(`Não foi possível iniciar o scanner: ${err}`);
            });
        }

        // Função de limpeza: para o scanner quando o componente é desmontado
        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(err => {
                    console.error("Falha ao parar o scanner.", err);
                });
            }
        };
    }, [isScannerOpen, selectedCameraId]);

    const openScanner = () => {
        setIsScannerOpen(true);
    };

    const closeScanner = () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(err => {
                console.error("Falha ao parar o scanner.", err);
            });
        }
        setIsScannerOpen(false);
    };

    const closeModal = () => {
        setQrCodeResult(null);
    };

    return (
        <div className="flex flex-col items-center justify-center font-sans">
            {/* Botão para iniciar o processo */}
            <div className='space-y-2 flex flex-col'>
                {!isScannerOpen && !qrCodeResult && (
                    <button
                        onClick={openScanner}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
                    >
                        Presença por QrCode
                    </button>
                )}
            </div>
            {/* Seção do Scanner */}
            {isScannerOpen && (
                <div className="w-full max-w-lg mx-auto mt-4 p-6 border border-gray-200 rounded-xl shadow-lg bg-white">
                    <div className="flex justify-between items-center mb-4 gap-4">
                        <select
                            onChange={(e) => setSelectedCameraId(e.target.value)}
                            value={selectedCameraId}
                            className="flex-grow border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {cameras.map((camera) => (
                                <option key={camera.id} value={camera.id}>
                                    {camera.label || `Câmera ${camera.id}`}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={closeScanner}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-colors"
                        >
                            Fechar Câmera
                        </button>
                    </div>
                    {/* O quadrado da câmera será renderizado aqui */}
                    <div id={readerId} className="w-full rounded-lg overflow-hidden border-2 border-dashed border-gray-300"></div>
                </div>
            )}

            {/* Modal com o Resultado */}
            {qrCodeResult && (
                <ModalUserFound courseData={courseData} hydrateData={hydrateData} qrCodeResult={qrCodeResult} closeModal={closeModal} />
            )}
        </div>
    );
};

const ModalUserFound: React.FC<{ courseData: ICourse, qrCodeResult: string, closeModal: () => void, hydrateData: () => Promise<void> }> = ({ hydrateData, courseData, qrCodeResult, closeModal }) => {
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [user, setUser] = useState<IUser | null>(null)
    useEffect(() => {
        const fetchUser = async () => {
            const userFetch = await fetch(`/api/get/usuarioPorId/${qrCodeResult}`)
            const user: { data: IUser } = await userFetch.json()
            setUser(user.data)
            setIsLoading(false)
        }
        fetchUser()
    }, [qrCodeResult])

    /**
     * Tava sem ideia para nome de função, então coloquei esse kk
     * Mas a ideia é dar um panorama geral para o adm de que se há pendências antes de realizar a presença:
     * Exemplos:
     *  - Notificar o adm se o evento já estourou o limite máximo;
     *  - Notificar o adm se o usuário ainda não pagou sua inscrição;
     *  - Etc.;
     * Após perguntar, vamos verificar se o adm quer continuar com a inscrição.
     */
    const getFeedBack = (user: IUser, courseData: ICourse): string[] => {
        let listFeedBack: string[] = []
        console.log(user)
        if (user.pagamento.situacao == 2) {
            listFeedBack.push("O usuário está com o pagamento do ingresso do congresso pendente;")
        }
        if (user.pagamento.situacao == 0) {
            listFeedBack.push("O usuário não realizou o pagamento do ingresso do congresso;")
        }
        if (!courseData.participants.includes(`${user._id}`)) {
            listFeedBack.push("O usuário não realizou a inscrição para este minicurso;")
        }
        if (courseData.attendanceList.includes(`${user._id}`)) {
            listFeedBack.push("O usuário já está com a presença registrada;")
        }

        //
        //
        console.log(listFeedBack)
        return listFeedBack
    }

    return (
        <>
            <LoadingModal isLoading={isLoading} />
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                <div className="relative mx-auto p-6 border w-full max-w-2xl shadow-xl rounded-2xl bg-white">
                    <div className="mt-3 text-center space-y-5">
                        <h3 className="text-xl leading-6 font-bold text-gray-900">Usuário Identificado</h3>
                        <div className="mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-600">
                                ID de Usuário
                            </p>
                            <p className="text-md font-mono text-gray-800 break-all mt-1">
                                {qrCodeResult}
                            </p>
                        </div>
                        <div className="mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-600">
                                Informações Gerais
                            </p>
                            <p className="text-md font-mono text-gray-800 break-all mt-1">
                                NOME. {user?.informacoes_usuario?.nome}
                            </p>
                            <p className="text-md font-mono text-gray-800 break-all mt-1">
                                CPF. {user?.informacoes_usuario?.cpf}
                            </p>
                            <p className="text-md font-mono text-gray-800 break-all mt-1">
                                EMAIL. {user?.informacoes_usuario?.email}
                            </p>
                            <p className="text-md font-mono text-gray-800 break-all mt-1">
                                TELEFONE. {user?.informacoes_usuario?.numero_telefone}
                            </p>
                        </div>
                        <div className="bg-gray-50 py-3">
                            <div>
                                <p className="text-sm text-gray-500 mb-2">
                                    Observação
                                </p>
                                {
                                    user && (
                                        getFeedBack(user, courseData).length === 0 ? "Não há nenhuma observação a ser feita" :
                                            getFeedBack(user, courseData).map((value) => <p key={`${user._id}`} className='text-red-700 font-semibold'>{value}</p>)
                                    )
                                }
                            </div>
                        </div>
                        <div className='flex flex-col items-center content-center justify-center space-y-1'>
                            <button
                                onClick={
                                    async () => {
                                        setIsLoading(true)
                                        const response = await fetch(`/api/post/darPresenca`, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                                eventId: courseData._id,
                                                userId: qrCodeResult,
                                            }),
                                        });
                                        if (!response.ok) {
                                            setIsLoading(false)
                                            alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                                            return;
                                        }
                                        await hydrateData()
                                        setIsLoading(false)
                                        alert("Presença adicionada com sucesso.")
                                        closeModal()

                                    }
                                }
                                className="w-fit px-4 w-lg py-3 bg-red-600 text-white text-base font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            >
                                Dar Presença
                            </button>
                            <button
                                onClick={closeModal}
                                className="w-fit px-4 w-lg py-3 bg-green-600 text-white text-base font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
//
interface AllUsersModalProps {
    courseData: ICourse;
    isOpen: boolean;
    onClose: () => void;
    onUserSelect: (user: string) => Promise<void>; // Função para lidar com a seleção
    usersData: IUser[];
}

const AllUsersModal: React.FC<AllUsersModalProps> = ({ courseData, isOpen, onClose, onUserSelect, usersData }) => {

    const [searchTerm, setSearchTerm] = useState('');
    // Efeito para fechar com a tecla 'Esc'
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    // Não renderiza nada se não estiver aberto
    if (!isOpen) {
        return null;
    }



    const filteredUsers = usersData.filter(user => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true; // Mostra todos se a busca estiver vazia

        const nome = user?.informacoes_usuario?.nome?.toLowerCase();
        const email = user?.informacoes_usuario?.email?.toLowerCase();

        return nome?.includes(term) || email?.includes(term);
    });

    return (
        // Container principal que cobre a tela inteira
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop para fechar o modal */}
            <div className="absolute inset-0 bg-black bg-opacity-60" onClick={onClose}></div>

            {/* Dialog do Modal */}
            <div className="relative z-10 flex h-full max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
                {/* Cabeçalho do Modal */}
                <div className="flex items-center justify-between border-b p-4">
                    <h1 className="text-xl font-bold text-gray-800 w-full text-center">Escolha um Congressista</h1>
                    <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Fechar modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="border-b p-4 text-center">
                    <h2>Pesquisar Congressista</h2>
                    <input
                        type="text"
                        placeholder="Filtrar por nome ou e-mail..."
                        className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Corpo rolável com a lista de usuários */}
                <div className="flex-grow overflow-y-auto p-4">
                    {
                        <p className='w-full text-center font-extrabold text-red-800 py-3'>{!(courseData.participants.length + 1 >= courseData.maxParticipants) && `Atenção, o evento já atingiu seu limite máximo`}</p>
                    }
                    <div className="flex flex-col items-center justify-center content-center space-y-4 w-full">
                        {filteredUsers.map((user) => (
                            // Envolvemos o card em um botão para torná-lo clicável
                            <button
                                key={user._id}
                                onClick={() => onUserSelect(user._id)}
                                className="w-full text-left transition duration-200 hover:scale-[1.02]"
                            >
                                <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0">
                                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                                                {user.informacoes_usuario.nome.charAt(0)}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div>
                                                <p className='text-[11px] bg-orange-500 w-fit px-1 font-extrabold text-white'>
                                                    {courseData.participants.includes(`${user._id}`) ? "Já inscrito no minicurso" : ""}
                                                </p>
                                            </div>
                                            <p className="truncate text-xl font-bold text-gray-800">
                                                {user.informacoes_usuario.titulo_honorario} {user.informacoes_usuario.nome}
                                            </p>
                                            <p className="truncate text-sm text-gray-500">{user.informacoes_usuario.email}</p>
                                            <div>
                                                <p className='text-[12px] font-semibold' style={{
                                                    color: user.pagamento.situacao == 1 ? "blue" : "red"
                                                }}>{
                                                        user.pagamento.situacao == 1 ?
                                                            "" : "Não inscrito no congresso"

                                                    }</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default MyComponent;
