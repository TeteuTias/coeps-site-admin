'use client'
import { IUser } from '@/app/lib/types/user/user.t';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Html5Qrcode, CameraDevice, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import LoadingModal from '@/app/components/LoadingModal';
import { useRef } from 'react';
import { ILecture } from '@/app/lib/types/events/event.t';
import ConfirmationModal, { ModalProps } from '@/app/components/ConfirmationModal';
import './style.css';
import { Users, CheckCircle, XCircle, QrCode, UserPlus, Loader2, Calendar, Clock, Table, ListChecksIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useUser } from '@/app/lib/auth0-client';
import { useParams } from 'next/navigation';

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

const MyComponent = () => {
    const { _id } = useParams<{ _id: string }>();
    const user = useUser()
    const [data, setData] = useState<string[]>([]);
    const [listType, setListType] = useState<"init" | "end">("init")
    const [allUsers, setAllUsers] = useState<IUser[]>([])
    const [errorBolean, setErrorBolean] = useState<boolean>(false);
    const [data2, setData2] = useState<Usuario[]>([]);
    const [dataPresentes, setDataPresente] = useState<{
        "init": string[],
        "end": string[],
    }>({
        init: [],
        end: []
    })
    const [courseData, setCourseData] = useState<ILecture | null>(null)
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
        ),
        confirmText: "Continuar",
        cancelText: "Fechar",
    })
    const [isOpenAllUsers, setIsOpenAllUsers] = useState<boolean>(false)

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [loadingContent, setLoadingContent] = useState<boolean>(false)

    const hydrateData = async () => {
        try {
            const fetchParticipantAndAttendanceData = async () => {
                const [courseResponse, allUsersResponse] = await Promise.all([
                    fetch(`/api/get/palestraProps/${_id}`),
                    fetch(`/api/get/todosCongressistasInscritos/`),
                ]);

                if (!courseResponse.ok || !allUsersResponse.ok) {
                    throw new Error("Erro ao buscar dados de participantes ou lista de presença");
                }

                const courseResult: { data: ILecture } = await courseResponse.json()
                const allUsersResult: { data: IUser[] } = await allUsersResponse.json()

                setCourseData(courseResult.data)
                setAllUsers(allUsersResult.data)
                setDataPresente({
                    init: courseResult.data.attendanceListInit,
                    end: courseResult.data.attendanceListEnd
                })

                return allUsersResult.data.map((u) => `${u._id}`)
            };

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

            const participantIds = await fetchParticipantAndAttendanceData();
            await fetchUserInfo(participantIds);

        } catch (error) {
            setErrorBolean(true)
            setError("OCORREU ALGO ERRADO. RECARREGUE");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const fetchParticipantAndAttendanceData = async () => {
                    const [courseResponse, allUsersResponse] = await Promise.all([
                        fetch(`/api/get/palestraProps/${_id}`),
                        fetch(`/api/get/todosCongressistasInscritos/`),
                    ]);

                    if (!courseResponse.ok || !allUsersResponse.ok) {
                        throw new Error("Erro ao buscar dados de participantes ou lista de presença");
                    }

                    const courseResult: { data: ILecture } = await courseResponse.json()
                    const allUsersResult: { data: IUser[] } = await allUsersResponse.json()
                    setCourseData(courseResult.data)
                    setAllUsers(allUsersResult.data)
                    setDataPresente({
                        init: courseResult.data.attendanceListInit,
                        end: courseResult.data.attendanceListEnd
                    })
                    return allUsersResult.data.map((u) => `${u._id}`)
                };

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

                const participantIds = await fetchParticipantAndAttendanceData();
                await fetchUserInfo(participantIds);

            } catch (error) {
                setErrorBolean(true)
                setError("OCORREU ALGO ERRADO. RECARREGUE");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [_id]);

    if (loading) {
        return (
            <div className="presenca-lista-loading-container" style={{
                background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
                backgroundAttachment: 'fixed',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat'
            }}>
                <div className="presenca-lista-spinner"><Loader2 size={48} className="animate-spin" /></div>
                <span className="presenca-lista-loading-text">Carregando lista de presença...</span>
            </div>
        );
    }

    if (error || !courseData) {
        return <div className="text-red-500">{error}</div>;
    }

    const presentes = dataPresentes[listType].length;
    const ausentes = data2.length - presentes;

    return (
        <div className="presenca-lista-main-container" style={{
            background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat'
        }}>
            <h1 className="presenca-lista-title">{courseData.name}</h1>
            <div className="presenca-lista-estatisticas">
                <div className="presenca-lista-estatistica-card">
                    <Users size={32} style={{ marginBottom: '0.3rem', color: 'var(--azul)' }} />
                    <span className="presenca-lista-estatistica-valor">{data2.length}</span>
                    <span className="presenca-lista-estatistica-label">Total de Inscritos</span>
                </div>
                <div className="presenca-lista-estatistica-card">
                    <CheckCircle size={32} style={{ marginBottom: '0.3rem', color: 'var(--carmin)' }} />
                    <span className="presenca-lista-estatistica-valor">{presentes}</span>
                    <span className="presenca-lista-estatistica-label">Presentes {listType === "init" ? "Início" : "Fim"}</span>
                </div>
                <div className="presenca-lista-estatistica-card">
                    <XCircle size={32} style={{ marginBottom: '0.3rem', color: '#ff6b6b' }} />
                    <span className="presenca-lista-estatistica-valor">{ausentes}</span>
                    <span className="presenca-lista-estatistica-label">Ausentes {listType === "init" ? "Início" : "Fim"}</span>
                </div>
            </div>

            <div className="presenca-lista-info">
                <div className="presenca-lista-info-item">
                    <Calendar size={18} />
                    <span>{new Date().toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="presenca-lista-info-item">
                    <Clock size={18} />
                    <span>{new Date().toLocaleTimeString('pt-BR')}</span>
                </div>
            </div>
            <QRCodeScanner courseData={courseData} hydrateData={hydrateData} listType={listType} />
            <div className="presenca-lista-actions mt-4">
                {
                    user && user.user?.sub?.includes("67098341f7397b370e9cb8ba") &&
                    <button
                        onClick={() => setIsOpenAllUsers(true)}
                        className="presenca-lista-btn presenca-lista-btn-primary"
                    >

                        <UserPlus size={18} />
                        Adicionar Usuário
                    </button>
                }
                <ExportButton inscritos={data} presentes={dataPresentes} todosUsuarios={data2} />
            </div>
            <button
                onClick={() => {
                    setListType((prev) => prev === "end" ? "init" : "end"
                    )
                }}
                className="presenca-lista-btn presenca-lista-btn-primary mb-5"
            >
                <ListChecksIcon size={18} />
                {
                    listType === "init" ? "Início do Evento" : "Fim do Evento"
                }
            </button>

            <div className="presenca-lista-table-container">
                <table className="presenca-lista-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Status</th>
                            {
                                user && user.user?.sub?.includes("67098341f7397b370e9cb8ba") &&
                                <th>Ações</th>
                            }
                        </tr>
                    </thead>
                    <tbody>
                        {data2.map((item, index) => (
                            <tr key={index} className="presenca-lista-row">
                                <td className="presenca-lista-nome">
                                    <span>{index + 1}. {item.informacoes_usuario.nome.toLocaleUpperCase()}</span>
                                </td>
                                <td className="presenca-lista-email">{item.informacoes_usuario.email}</td>
                                <td className="presenca-lista-status">
                                    <span className={`presenca-lista-status-badge ${dataPresentes[listType].includes(item._id) ? 'presente' : 'ausente'}`}>
                                        {dataPresentes[listType].includes(`${item._id}`) ? "PRESENTE" : "AUSENTE"}
                                    </span>
                                </td>
                                {
                                    user && user.user?.sub?.includes("67098341f7397b370e9cb8ba") &&
                                    <td className="presenca-lista-acoes">
                                        <button
                                            className={`presenca-lista-btn ${dataPresentes[listType].includes(item._id) ? 'presenca-lista-btn-danger' : 'presenca-lista-btn-success'}`}
                                            onClick={async () => {
                                                setLoadingContent(true)
                                                try {
                                                    if (dataPresentes[listType].includes(item._id)) {
                                                        const response = await fetch(`/api/post/retirarPresencaPalestra`, {
                                                            method: "POST",
                                                            headers: {
                                                                "Content-Type": "application/json",
                                                            },
                                                            body: JSON.stringify({
                                                                eventId: _id,
                                                                userId: item._id,
                                                                listType: listType,
                                                            }),
                                                        });
                                                        if (response.ok) {
                                                            await hydrateData()
                                                        }
                                                        return;
                                                    }
                                                    const response = await fetch(`/api/post/darPresencaPalestra`, {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                        },
                                                        body: JSON.stringify({
                                                            eventId: _id,
                                                            userId: item._id,
                                                            listType: listType
                                                        }),
                                                    });
                                                    if (response.ok) {
                                                        await hydrateData()
                                                    }
                                                }
                                                catch {
                                                    setErrorBolean(true)
                                                }
                                                finally {
                                                    setLoadingContent(false)
                                                }
                                            }}
                                        >
                                            {dataPresentes[listType].includes(item._id) ? "RETIRAR PRESENÇA" : "DAR PRESENÇA"}
                                        </button>
                                    </td>
                                }
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <LoadingModal isLoading={loadingContent} />
            <ConfirmationModal {...isModalProps} />
            {isOpenAllUsers && (
                <AllUsersModal
                    listType={listType}
                    setListType={setListType}
                    courseData={courseData}
                    isOpen={true}
                    onClose={() => { setIsOpenAllUsers(false) }}
                    onUserSelect={async (userId: string) => {
                        setLoadingContent(true)
                        const response = await fetch(`/api/post/darPresencaPalestra`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                eventId: _id,
                                userId: userId,
                                listType: listType
                            }),
                        });
                        if (response.ok) {
                            await hydrateData
                        } else {
                            alert("Ocorreu algum erro. Recarregue a página e tente novamente.")
                            setLoadingContent(false)
                            return;
                        }
                        await hydrateData()
                        setIsOpenAllUsers(false)
                        setLoadingContent(false)
                    }}
                    usersData={allUsers}
                />
            )}
        </div>
    );
};
//
//
const QRCodeScanner: React.FC<{ listType: "end" | "init", courseData: ILecture, hydrateData: () => Promise<void> }> = ({ courseData, hydrateData, listType }) => {
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
                <div className="mt-4 p-6 border border-gray-200 rounded-xl shadow-lg bg-white">
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
                <ModalUserFound listType={listType} courseData={courseData} hydrateData={hydrateData} qrCodeResult={qrCodeResult} closeModal={closeModal} />
            )}
        </div>
    );
};

const ModalUserFound: React.FC<{ listType: "end" | "init", courseData: ILecture, qrCodeResult: string, closeModal: () => void, hydrateData: () => Promise<void> }> = ({ hydrateData, courseData, qrCodeResult, closeModal, listType }) => {
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

    return (
        <>
            <LoadingModal isLoading={isLoading} />
            <div className="fixed inset-0 min-h-sreen bg-black bg-opacity-60 flex items-center justify-center z-[5000] p-5">
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
                                    user?.pagamento.situacao !== 1 ?
                                        <h1><span className='bg-red-500 p-2 font-extrabold text-white'>ATENÇÃO!</span> Esse congressista não realizou o pagamento do congresso</h1> :
                                        ""
                                }
                                {
                                    listType === "init" && courseData.attendanceListInit?.includes(user?._id || "") &&
                                    <p className="text-sm font-medium text-green-600 mt-2">Presença de início já foi registrada</p>

                                }
                                {
                                    listType === "init" && !courseData.attendanceListInit?.includes(user?._id || "") &&
                                    <p className="text-sm font-medium text-green-600 mt-2">Presença de início NÃO foi registrada</p>
                                }
                                {
                                    listType === "end" && courseData.attendanceListEnd?.includes(user?._id || "") &&
                                    <p className="text-sm font-medium text-green-600 mt-2">Presença de fim já foi registrada</p>
                                }
                                {
                                    listType === "end" && !courseData.attendanceListEnd?.includes(user?._id || "") &&
                                    <p className="text-sm font-medium text-green-600 mt-2">Presença de fim NÃO foi registrada</p>
                                }
                            </div>
                        </div>
                        <div className='flex flex-col items-center content-center justify-center space-y-1'>
                            {

                                (listType === "init" && !courseData.attendanceListInit?.includes(user?._id || "")) || (listType === "end" && !courseData.attendanceListEnd?.includes(user?._id || "")) ?
                                    <button
                                        onClick={
                                            async () => {
                                                setIsLoading(true)
                                                const response = await fetch(`/api/post/darPresencaPalestra`, {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        eventId: courseData._id,
                                                        listType: listType,
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
                                        className="w-fit px-4 w-lg py-3 bg-blue-300 text-white text-base font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                    >
                                        Dar Presença - {listType === "init" ? "Início" : "Fim"}
                                    </button> : ""
                            }
                            {
                                (listType === "init" && courseData.attendanceListInit?.includes(user?._id || "")) || (listType === "end" && courseData.attendanceListEnd?.includes(user?._id || "")) ?
                                    <button
                                        onClick={
                                            async () => {
                                                setIsLoading(true)
                                                const response = await fetch(`/api/post/retirarPresencaPalestra`, {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({
                                                        eventId: courseData._id,
                                                        listType: listType,
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
                                                alert("Presença retirada com sucesso.")
                                                closeModal()

                                            }
                                        }
                                        className="w-fit px-4 w-lg py-3 bg-red-600 text-white text-base font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                    >
                                        Retirar Presença - {listType === "init" ? "Início" : "Fim"}
                                    </button> : ""
                            }
                            {/* */}
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
    courseData: ILecture;
    isOpen: boolean;
    onClose: () => void;
    onUserSelect: (user: string) => Promise<void>; // Função para lidar com a seleção
    usersData: IUser[];
    setListType: Dispatch<SetStateAction<"init" | "end">>,
    listType: "init" | "end"
}

const AllUsersModal: React.FC<AllUsersModalProps> = ({ courseData, isOpen, onClose, onUserSelect, usersData, setListType, listType }) => {

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
        <div className="fixed inset-0 min-h-screen z-[5000] flex items-center justify-center p-4">
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
                <div className='mt-5 w-full flex items-center justify-center content-center flex-col'>
                    <h2 className="text-lg font-bold text-gray-800 w-full text-center py-3">Realizar a presença para:</h2>
                    <button
                        onClick={() => {
                            setListType((prev) => prev === "end" ? "init" : "end"
                            )
                        }}
                        className="presenca-lista-btn presenca-lista-btn-primary mb-5"
                    >
                        <ListChecksIcon size={18} />
                        {
                            listType === "init" ? "Início do Evento" : "Fim do Evento"
                        }
                    </button>
                </div>
                <div className="border-b p-4 text-center">
                    <h2 className="text-lg font-bold text-gray-800 w-full text-center py-3">Pesquisar Congressista</h2>
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
                    <div className="flex flex-col items-center justify-center content-center space-y-4 w-full">
                        {filteredUsers.map((user) => (
                            // Envolvemos o card em um botão para torná-lo clicável
                            <button
                                key={user._id}
                                onClick={() => onUserSelect(user._id)}
                                className="min-w-[80%] max-w-[80%] text-left transition duration-200 hover:scale-[1.02]"
                            >
                                <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0">
                                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                                                {user.informacoes_usuario.nome.charAt(0)}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
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

function ExportButton({
    inscritos,
    presentes,
    todosUsuarios,
}: {
    inscritos: string[];
    presentes: { init: string[]; end: string[] };
    todosUsuarios: Usuario[];
}) {
    const getDataFromIds = (ids: string[]) =>
        ids
            .map((usuarioId: string) => todosUsuarios.find(u => u._id === usuarioId))
            .filter((usuario): usuario is Usuario => usuario !== undefined)
            .map(usuario => ({
                NOME: usuario.informacoes_usuario.nome,
                CPF: usuario.informacoes_usuario.cpf,
                EMAIL: usuario.informacoes_usuario.email,
            }));

    const handleDownload = () => {
        // Cria as duas listas (init e end)
        const initData = getDataFromIds(presentes.init);
        const endData = getDataFromIds(presentes.end);

        // Cria o workbook
        const workbook = XLSX.utils.book_new();

        // Cria a aba "init"
        const initSheet = XLSX.utils.json_to_sheet(initData);
        initSheet["!cols"] = [
            { wch: 20 },
            { wch: 15 },
            { wch: 25 },
        ];
        XLSX.utils.book_append_sheet(workbook, initSheet, "init");

        // Cria a aba "end"
        const endSheet = XLSX.utils.json_to_sheet(endData);
        endSheet["!cols"] = [
            { wch: 20 },
            { wch: 15 },
            { wch: 25 },
        ];
        XLSX.utils.book_append_sheet(workbook, endSheet, "end");

        // Salva o arquivo
        XLSX.writeFile(workbook, "Presenca.xlsx");
    };

    return (
        <button
            onClick={handleDownload}
            className="presenca-lista-btn presenca-lista-btn-primary"
        >
            <Table size={18} />
            Gerar Planilha
        </button>
    );
}




export default MyComponent;
