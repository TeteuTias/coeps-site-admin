'use client'
import {
    type AdminUserDetails,
    type AdminUserSummary,
    adminUserInitial,
    displayUserField,
    displayUserName,
    parseAdminUserDetailsPayload,
    parseAdminUserListPayload,
} from '@/app/lib/users/admin-user-contract';
import { parseDataObjectPayload } from '@/app/lib/api-data-contract';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Html5Qrcode, CameraDevice, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import LoadingModal from '@/app/components/LoadingModal';
import { useRef } from 'react';
import { ILecture } from '@/app/lib/types/events/event.t';
import ConfirmationModal, { ModalProps } from '@/app/components/ConfirmationModal';
import '../../attendance-detail.css';
import { Users, CheckCircle, XCircle, QrCode, UserPlus, Loader2, Calendar, Clock, Table, ListChecksIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useUser } from '@/app/lib/auth0-client';
import { useParams } from 'next/navigation';

const parseLecturePayload = (value: unknown): ILecture | null => {
    const lecture = parseDataObjectPayload(value)
    if (
        !lecture ||
        typeof lecture._id !== "string" ||
        typeof lecture.name !== "string" ||
        !Array.isArray(lecture.attendanceListInit) ||
        !lecture.attendanceListInit.every((id) => typeof id === "string") ||
        !Array.isArray(lecture.attendanceListEnd) ||
        !lecture.attendanceListEnd.every((id) => typeof id === "string")
    ) {
        return null
    }
    return lecture as unknown as ILecture
}

const MyComponent = () => {
    const { _id } = useParams<{ _id: string }>();
    const user = useUser()
    const [data, setData] = useState<string[]>([]);
    const [listType, setListType] = useState<"init" | "end">("init")
    const [allUsers, setAllUsers] = useState<AdminUserSummary[]>([])
    const [errorBolean, setErrorBolean] = useState<boolean>(false);
    const [data2, setData2] = useState<AdminUserSummary[]>([]);
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
                <p className="presenca-lista-confirmation-copy"></p>
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

                const courseResult: unknown = await courseResponse.json().catch(() => null)
                const allUsersResult: unknown = await allUsersResponse.json().catch(() => null)
                const lecture = parseLecturePayload(courseResult)
                const normalizedUsers = parseAdminUserListPayload(allUsersResult)
                if (!lecture || !normalizedUsers) throw new Error("Dados da palestra ou congressistas inválidos")

                setCourseData(lecture)
                setAllUsers(normalizedUsers)
                setDataPresente({
                    init: lecture.attendanceListInit,
                    end: lecture.attendanceListEnd
                })

                return normalizedUsers.map((u) => `${u._id}`)
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

                const result: unknown = await response.json().catch(() => null);
                const normalizedUsers = parseAdminUserListPayload(result)
                if (!normalizedUsers) throw new Error("Dados dos participantes inválidos")
                setData2(normalizedUsers);
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

                    const courseResult: unknown = await courseResponse.json().catch(() => null)
                    const allUsersResult: unknown = await allUsersResponse.json().catch(() => null)
                    const lecture = parseLecturePayload(courseResult)
                    const normalizedUsers = parseAdminUserListPayload(allUsersResult)
                    if (!lecture || !normalizedUsers) throw new Error("Dados da palestra ou congressistas inválidos")
                    setCourseData(lecture)
                    setAllUsers(normalizedUsers)
                    setDataPresente({
                        init: lecture.attendanceListInit,
                        end: lecture.attendanceListEnd
                    })
                    return normalizedUsers.map((u) => `${u._id}`)
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

                    const result: unknown = await response.json().catch(() => null);
                    const normalizedUsers = parseAdminUserListPayload(result)
                    if (!normalizedUsers) throw new Error("Dados dos participantes inválidos")
                    setData2(normalizedUsers);
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
            <main className="presenca-lista-loading-container" role="status" aria-live="polite">
                <div className="presenca-lista-spinner"><Loader2 size={44} aria-hidden="true" /></div>
                <span className="presenca-lista-loading-text">Carregando lista de presença...</span>
            </main>
        );
    }

    if (error || !courseData) {
        return (
            <main className="presenca-lista-state" role="alert">
                <span className="presenca-lista-state-kicker">Não foi possível abrir esta lista</span>
                <h1>Erro ao carregar os dados</h1>
                <p>{error || "A palestra solicitada não foi encontrada."}</p>
            </main>
        );
    }

    const presentes = dataPresentes[listType].length;
    const ausentes = data2.length - presentes;
    const canManageAttendance = Boolean(user?.user?.sub?.includes("67098341f7397b370e9cb8ba"));

    return (
        <main className="presenca-lista-main-container">
            <header className="presenca-lista-header">
                <span className="presenca-lista-eyebrow">CIEPS · Controle de presença</span>
                <h1 className="presenca-lista-title">{courseData.name}</h1>
                <p className="presenca-lista-subtitle">
                    Acompanhe a presença de início e fim, registre participantes e exporte a relação desta palestra.
                </p>
            </header>

            <section className="presenca-lista-estatisticas" aria-label="Resumo da lista de presença">
                <div className="presenca-lista-estatistica-card">
                    <Users size={28} className="presenca-lista-stat-icon stat-blue" aria-hidden="true" />
                    <span className="presenca-lista-estatistica-valor">{data2.length}</span>
                    <span className="presenca-lista-estatistica-label">Total de Inscritos</span>
                </div>
                <div className="presenca-lista-estatistica-card">
                    <CheckCircle size={28} className="presenca-lista-stat-icon stat-green" aria-hidden="true" />
                    <span className="presenca-lista-estatistica-valor">{presentes}</span>
                    <span className="presenca-lista-estatistica-label">Presentes {listType === "init" ? "Início" : "Fim"}</span>
                </div>
                <div className="presenca-lista-estatistica-card">
                    <XCircle size={28} className="presenca-lista-stat-icon stat-red" aria-hidden="true" />
                    <span className="presenca-lista-estatistica-valor">{ausentes}</span>
                    <span className="presenca-lista-estatistica-label">Ausentes {listType === "init" ? "Início" : "Fim"}</span>
                </div>
            </section>

            <div className="presenca-lista-info" aria-label="Data e horário da consulta">
                <div className="presenca-lista-info-item">
                    <Calendar size={18} aria-hidden="true" />
                    <span>{new Date().toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="presenca-lista-info-item">
                    <Clock size={18} aria-hidden="true" />
                    <span>{new Date().toLocaleTimeString('pt-BR')}</span>
                </div>
            </div>

            <section className="attendance-list-mode" aria-label="Etapa da presença">
                <div>
                    <span className="attendance-list-mode-kicker">Lista ativa</span>
                    <strong>{listType === "init" ? "Início do evento" : "Fim do evento"}</strong>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setListType((prev) => prev === "end" ? "init" : "end")
                    }}
                    className="presenca-lista-btn presenca-lista-btn-secondary"
                    aria-label={`Alternar para presença de ${listType === "init" ? "fim" : "início"} do evento`}
                >
                    <ListChecksIcon size={18} aria-hidden="true" />
                    Alternar para {listType === "init" ? "fim" : "início"}
                </button>
            </section>

            <section className="presenca-lista-actions" aria-label="Ações da lista">
                <QRCodeScanner courseData={courseData} hydrateData={hydrateData} listType={listType} />
                {
                    canManageAttendance &&
                    <button
                        type="button"
                        onClick={() => setIsOpenAllUsers(true)}
                        className="presenca-lista-btn presenca-lista-btn-primary"
                    >

                        <UserPlus size={18} aria-hidden="true" />
                        Adicionar Usuário
                    </button>
                }
                <ExportButton inscritos={data} presentes={dataPresentes} todosUsuarios={data2} />
            </section>

            {errorBolean && (
                <p className="presenca-lista-inline-error" role="alert">
                    Não foi possível concluir a última atualização. Tente novamente.
                </p>
            )}

            <div
                className="presenca-lista-table-container"
                role="region"
                aria-label={`Congressistas e presença de ${listType === "init" ? "início" : "fim"}`}
                tabIndex={0}
            >
                <table className="presenca-lista-table">
                    <caption className="presenca-lista-sr-only">
                        Congressistas e status de presença de {listType === "init" ? "início" : "fim"} da palestra
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Nome</th>
                            <th scope="col">Email</th>
                            <th scope="col">Status</th>
                            {
                                canManageAttendance &&
                                <th scope="col" className="presenca-lista-acoes">Ações</th>
                            }
                        </tr>
                    </thead>
                    <tbody>
                        {data2.map((item, index) => (
                            <tr key={item._id} className="presenca-lista-row">
                                <td className="presenca-lista-nome">
                                    <span>{index + 1}. {displayUserName(item).toLocaleUpperCase("pt-BR")}</span>
                                </td>
                                <td className="presenca-lista-email">{displayUserField(item.informacoes_usuario.email)}</td>
                                <td className="presenca-lista-status">
                                    <span className={`presenca-lista-status-badge ${dataPresentes[listType].includes(item._id) ? 'presente' : 'ausente'}`}>
                                        {dataPresentes[listType].includes(`${item._id}`) ? "PRESENTE" : "AUSENTE"}
                                    </span>
                                </td>
                                {
                                    canManageAttendance &&
                                    <td className="presenca-lista-acoes">
                                        <button
                                            type="button"
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
                        {data2.length === 0 && (
                            <tr>
                                <td className="presenca-lista-empty-cell" colSpan={canManageAttendance ? 4 : 3}>
                                    Nenhum congressista disponível para esta palestra.
                                </td>
                            </tr>
                        )}
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
        </main>
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
    const [scannerError, setScannerError] = useState<string>('');

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
                } else {
                    setScannerError("Nenhuma câmera foi encontrada neste dispositivo.");
                }
            } catch (error) {
                console.error('Erro ao buscar câmeras:', error);
                setScannerError("Não foi possível acessar a câmera. Confira a permissão do navegador.");
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
                setScannerError("Não foi possível iniciar a leitura. Selecione outra câmera ou confira a permissão do navegador.");
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
        setScannerError('');
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
        <div className="attendance-scanner">
            {/* Botão para iniciar o processo */}
            <div className="attendance-scanner-trigger">
                {!isScannerOpen && !qrCodeResult && (
                    <button
                        type="button"
                        onClick={openScanner}
                        className="presenca-lista-btn presenca-lista-btn-secondary"
                    >
                        <QrCode size={18} aria-hidden="true" />
                        Presença por QrCode
                    </button>
                )}
            </div>
            {/* Seção do Scanner */}
            {isScannerOpen && (
                <section className="attendance-scanner-panel" aria-labelledby="scanner-title-palestra">
                    <div className="attendance-scanner-heading">
                        <div>
                            <span className="attendance-scanner-kicker">Leitura de credencial</span>
                            <h2 id="scanner-title-palestra">Escanear QR Code</h2>
                        </div>
                        <button
                            type="button"
                            onClick={closeScanner}
                            className="presenca-lista-btn presenca-lista-btn-ghost"
                        >
                            Fechar Câmera
                        </button>
                    </div>
                    <label className="attendance-scanner-label" htmlFor="camera-select-palestra">
                        Câmera
                    </label>
                    <select
                        id="camera-select-palestra"
                        onChange={(e) => {
                            setScannerError('');
                            setSelectedCameraId(e.target.value);
                        }}
                        value={selectedCameraId}
                        className="attendance-scanner-select"
                    >
                        {cameras.length === 0 && <option value="">Buscando câmeras...</option>}
                        {cameras.map((camera) => (
                            <option key={camera.id} value={camera.id}>
                                {camera.label || `Câmera ${camera.id}`}
                            </option>
                        ))}
                    </select>
                    {scannerError && <p className="attendance-scanner-error" role="alert">{scannerError}</p>}
                    {/* O quadrado da câmera será renderizado aqui */}
                    <div id={readerId} className="attendance-scanner-reader" aria-label="Visualização da câmera"></div>
                    <p className="attendance-scanner-help">Posicione o QR Code dentro da área destacada.</p>
                </section>
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
    const [user, setUser] = useState<AdminUserDetails | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userFetch = await fetch(`/api/get/usuarioPorId/${qrCodeResult}`)
                const payload: unknown = await userFetch.json().catch(() => null)
                if (!userFetch.ok) throw new Error("Usuário não encontrado")
                const normalizedUser = parseAdminUserDetailsPayload(payload)
                if (!normalizedUser) throw new Error("Dados do usuário inválidos")
                setUser(normalizedUser)
            } catch (error) {
                setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o usuário")
            } finally {
                setIsLoading(false)
            }
        }
        fetchUser()
    }, [qrCodeResult])

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [closeModal]);

    return (
        <>
            <LoadingModal isLoading={isLoading} />
            <div className="attendance-modal-overlay" onClick={closeModal}>
                <div
                    className="attendance-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="qr-result-title-palestra"
                    onClick={(event) => event.stopPropagation()}
                >
                    <header className="attendance-modal-header">
                        <div>
                            <span className="attendance-modal-kicker">Leitura concluída</span>
                            <h3 id="qr-result-title-palestra">Usuário identificado</h3>
                        </div>
                        <button type="button" className="attendance-modal-close" onClick={closeModal} aria-label="Fechar modal">
                            ×
                        </button>
                    </header>
                    <div className="attendance-modal-body">
                        <section className="attendance-modal-section">
                            <span className="attendance-modal-label">ID de usuário</span>
                            <p className="attendance-modal-code">{qrCodeResult}</p>
                        </section>
                        <section className="attendance-modal-section">
                            <span className="attendance-modal-label">Informações gerais</span>
                            <dl className="attendance-user-details">
                                <div><dt>Nome</dt><dd>{user ? displayUserName(user) : "Não informado"}</dd></div>
                                <div><dt>CPF</dt><dd>{displayUserField(user?.informacoes_usuario.cpf ?? null)}</dd></div>
                                <div><dt>E-mail</dt><dd>{displayUserField(user?.informacoes_usuario.email ?? null)}</dd></div>
                                <div><dt>Telefone</dt><dd>{displayUserField(user?.informacoes_usuario.numero_telefone ?? null)}</dd></div>
                            </dl>
                        </section>
                        <section className="attendance-modal-section">
                            <span className="attendance-modal-label">Observações</span>
                            <div className="attendance-feedback-list" aria-live="polite">
                                {user?.pagamento.situacao !== 1 && (
                                    <p className="attendance-feedback attendance-feedback-warning">
                                        Atenção: esse congressista não realizou o pagamento do congresso.
                                    </p>
                                )}
                                {loadError && (
                                    <p className="attendance-feedback attendance-feedback-warning">{loadError}</p>
                                )}
                                {user?.cadastroPendente && (
                                    <p className="attendance-feedback attendance-feedback-warning">
                                        Cadastro pendente: alguns dados pessoais ainda não foram informados.
                                    </p>
                                )}
                                {listType === "init" && courseData.attendanceListInit?.includes(user?._id || "") && (
                                    <p className="attendance-feedback attendance-feedback-positive">Presença de início já registrada.</p>
                                )}
                                {user && listType === "init" && !courseData.attendanceListInit?.includes(user._id) && (
                                    <p className="attendance-feedback attendance-feedback-neutral">Presença de início ainda não registrada.</p>
                                )}
                                {listType === "end" && courseData.attendanceListEnd?.includes(user?._id || "") && (
                                    <p className="attendance-feedback attendance-feedback-positive">Presença de fim já registrada.</p>
                                )}
                                {user && listType === "end" && !courseData.attendanceListEnd?.includes(user._id) && (
                                    <p className="attendance-feedback attendance-feedback-neutral">Presença de fim ainda não registrada.</p>
                                )}
                            </div>
                        </section>
                    </div>
                    <footer className="attendance-modal-actions">
                        {user && ((listType === "init" && !courseData.attendanceListInit?.includes(user._id)) ||
                            (listType === "end" && !courseData.attendanceListEnd?.includes(user._id))) && (
                                <button
                                    type="button"
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
                                    className="presenca-lista-btn presenca-lista-btn-success"
                                >
                                    Dar Presença · {listType === "init" ? "Início" : "Fim"}
                                </button>
                            )}
                        {user && ((listType === "init" && courseData.attendanceListInit?.includes(user._id)) ||
                            (listType === "end" && courseData.attendanceListEnd?.includes(user._id))) && (
                                <button
                                    type="button"
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
                                    className="presenca-lista-btn presenca-lista-btn-danger"
                                >
                                    Retirar Presença · {listType === "init" ? "Início" : "Fim"}
                                </button>
                            )}
                        <button type="button" onClick={closeModal} className="presenca-lista-btn presenca-lista-btn-ghost">
                            Fechar
                        </button>
                    </footer>
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
    usersData: AdminUserSummary[];
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
        <div className="all-users-modal-overlay">
            <div className="all-users-modal-backdrop" onClick={onClose} aria-hidden="true"></div>
            <div
                className="all-users-modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="all-users-title-palestra"
            >
                <div className="all-users-modal-header">
                    <div>
                        <span className="all-users-modal-kicker">Inclusão manual</span>
                        <h2 id="all-users-title-palestra" className="all-users-modal-title">Escolha um congressista</h2>
                    </div>
                    <button type="button" onClick={onClose} className="all-users-modal-close-btn" aria-label="Fechar modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="all-users-modal-mode">
                    <span className="all-users-modal-search-title">Realizar a presença para</span>
                    <button
                        type="button"
                        onClick={() => {
                            setListType((prev) => prev === "end" ? "init" : "end")
                        }}
                        className="presenca-lista-btn presenca-lista-btn-secondary"
                    >
                        <ListChecksIcon size={18} aria-hidden="true" />
                        {listType === "init" ? "Início do evento" : "Fim do evento"}
                    </button>
                </div>
                <div className="all-users-modal-search-section">
                    <label className="all-users-modal-search-title" htmlFor="all-users-search-palestra">Pesquisar congressista</label>
                    <input
                        id="all-users-search-palestra"
                        type="text"
                        placeholder="Filtrar por nome ou e-mail..."
                        className="all-users-modal-search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="all-users-modal-body">
                    <div className="all-users-modal-list">
                        {filteredUsers.map((user) => (
                            <button
                                type="button"
                                key={user._id}
                                onClick={() => onUserSelect(user._id)}
                                className="all-users-modal-user-button"
                            >
                                <div className="all-users-modal-user-card">
                                    <div className="all-users-modal-user-content">
                                        <div className="all-users-modal-user-avatar">
                                            <span className="all-users-modal-avatar-text">
                                                {adminUserInitial(user)}
                                            </span>
                                        </div>
                                        <div className="all-users-modal-user-info">
                                            <p className="all-users-modal-user-name">
                                                {user.informacoes_usuario.titulo_honorario} {displayUserName(user)}
                                            </p>
                                            <p className="all-users-modal-user-email">{displayUserField(user.informacoes_usuario.email)}</p>
                                            {user.cadastroPendente && (
                                                <p className="all-users-modal-payment-status">Cadastro pendente</p>
                                            )}
                                            {user.pagamento.situacao != 1 && (
                                                <p className="all-users-modal-payment-status">Não inscrito no congresso</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {filteredUsers.length === 0 && (
                            <p className="all-users-modal-empty">Nenhum congressista corresponde à busca.</p>
                        )}
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
    todosUsuarios: AdminUserSummary[];
}) {
    const getDataFromIds = (ids: string[]) =>
        ids
            .map((usuarioId: string) => todosUsuarios.find(u => u._id === usuarioId))
            .filter((usuario): usuario is AdminUserSummary => usuario !== undefined)
            .map(usuario => ({
                NOME: displayUserName(usuario),
                CPF: displayUserField(usuario.informacoes_usuario.cpf),
                EMAIL: displayUserField(usuario.informacoes_usuario.email),
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
            type="button"
            onClick={handleDownload}
            className="presenca-lista-btn presenca-lista-btn-primary"
        >
            <Table size={18} aria-hidden="true" />
            Gerar Planilha
        </button>
    );
}




export default MyComponent;
