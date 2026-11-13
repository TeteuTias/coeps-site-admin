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
import { parseDataObjectPayload, parseStringArrayDataPayload } from '@/app/lib/api-data-contract';
import { useEffect, useState } from 'react';
import { Html5Qrcode, CameraDevice, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import LoadingModal from '@/app/components/LoadingModal';
import { useRef } from 'react';
import { ICourse } from '@/app/lib/types/events/event.t';
import ConfirmationModal, { ModalProps } from '@/app/components/ConfirmationModal';
import '../../attendance-detail.css';
import { Users, CheckCircle, XCircle, UserPlus, Loader2, Calendar, Clock, Table, QrCode } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useUser } from '@/app/lib/auth0-client';
import { useParams } from 'next/navigation';
import { registrarPresenca, sinalizar } from '../../presenca-bip';
import { limparCodigo } from '../../fila-presenca';
import { AvisoPendentes, usePendentesPresenca } from '../../PendentesPresenca';

const parseCoursePayload = (value: unknown): ICourse | null => {
    const course = parseDataObjectPayload(value)
    if (
        !course ||
        typeof course._id !== "string" ||
        typeof course.name !== "string" ||
        typeof course.maxParticipants !== "number" ||
        !Number.isFinite(course.maxParticipants) ||
        !Array.isArray(course.participants) ||
        !course.participants.every((id) => typeof id === "string") ||
        !Array.isArray(course.attendanceList) ||
        !course.attendanceList.every((id) => typeof id === "string")
    ) {
        return null
    }
    return course as unknown as ICourse
}

const MyComponent = () => {
    const { _id } = useParams<{ _id: string }>();
    const [data, setData] = useState<string[]>([]);
    const user = useUser()
    const [allUsers, setAllUsers] = useState<AdminUserSummary[]>([])
    const [errorBolean, setErrorBolean] = useState<boolean>(false);
    const [data2, setData2] = useState<AdminUserSummary[]>([]);
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
                <p className="presenca-lista-confirmation-copy"></p>
            </>
        ),
        confirmText: "Continuar",
        cancelText: "Fechar",
    })
    const [isOpenAllUsers, setIsOpenAllUsers] = useState<boolean>(false)
    const [usuarioEscolhido, setUsuarioEscolhido] = useState<string | null>(null)

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [loadingContent, setLoadingContent] = useState<boolean>(false)

    const hydrateData = async () => {
        try {
            const fetchParticipantAndAttendanceData = async () => {
                const [participantsResponse, attendanceResponse, courseResponse, allUsersResponse] = await Promise.all([
                    fetch(`/api/get/participantesMinicursos/${_id}`),
                    fetch(`/api/get/listaDePresenca/${_id}`),
                    fetch(`/api/get/minicursoProps/${_id}`),
                    fetch(`/api/get/todosCongressistas/`),
                ]);

                if (!participantsResponse.ok || !attendanceResponse.ok || !courseResponse.ok || !allUsersResponse.ok) {
                    throw new Error("Erro ao buscar dados de participantes ou lista de presença");
                }

                const participantsResult: unknown = await participantsResponse.json().catch(() => null);
                const attendanceResult: unknown = await attendanceResponse.json().catch(() => null);
                const courseResult: unknown = await courseResponse.json().catch(() => null)
                const allUsersResult: unknown = await allUsersResponse.json().catch(() => null)
                const participantIds = parseStringArrayDataPayload(participantsResult)
                const attendanceIds = parseStringArrayDataPayload(attendanceResult)
                const course = parseCoursePayload(courseResult)
                const normalizedUsers = parseAdminUserListPayload(allUsersResult)
                if (!participantIds || !attendanceIds || !course || !normalizedUsers) {
                    throw new Error("Dados de participantes ou presença inválidos")
                }

                setData(participantIds);
                setDataPresente(attendanceIds);
                setCourseData(course)
                setAllUsers(normalizedUsers)

                return participantIds;
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

    // presença sem resposta do servidor fica guardada no aparelho e é reenviada; ao entregar, recarrega a lista
    const { pendentes, enviarAgora } = usePendentesPresenca(_id, () => { void hydrateData() })
    const guardados = new Set(pendentes.filter((p) => p.eventId === _id).map((p) => p.userId))

    useEffect(() => {
        const fetchData = async () => {
            try {
                const fetchParticipantAndAttendanceData = async () => {
                    const [participantsResponse, attendanceResponse, courseResponse, allUsersResponse] = await Promise.all([
                        fetch(`/api/get/participantesMinicursos/${_id}`),
                        fetch(`/api/get/listaDePresenca/${_id}`),
                        fetch(`/api/get/minicursoProps/${_id}`),
                        fetch(`/api/get/todosCongressistas/`),
                    ]);

                    if (!participantsResponse.ok || !attendanceResponse.ok || !courseResponse.ok || !allUsersResponse.ok) {
                        throw new Error("Erro ao buscar dados de participantes ou lista de presença");
                    }

                    const participantsResult: unknown = await participantsResponse.json().catch(() => null);
                    const attendanceResult: unknown = await attendanceResponse.json().catch(() => null);
                    const courseResult: unknown = await courseResponse.json().catch(() => null)
                    const allUsersResult: unknown = await allUsersResponse.json().catch(() => null)
                    const participantIds = parseStringArrayDataPayload(participantsResult)
                    const attendanceIds = parseStringArrayDataPayload(attendanceResult)
                    const course = parseCoursePayload(courseResult)
                    const normalizedUsers = parseAdminUserListPayload(allUsersResult)
                    if (!participantIds || !attendanceIds || !course || !normalizedUsers) {
                        throw new Error("Dados de participantes ou presença inválidos")
                    }

                    setData(participantIds);
                    setDataPresente(attendanceIds);
                    setCourseData(course)
                    setAllUsers(normalizedUsers)

                    return participantIds;
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
                <p>{error || "O minicurso solicitado não foi encontrado."}</p>
            </main>
        );
    }

    const presentes = dataPresentes.length;
    const ausentes = data2.length - presentes;
    // conta de admin (mesmo id de app/lib/user/userPermissionsServerSide.ts)
    const canManageAttendance = Boolean(user?.user?.sub?.includes("6a8799078ecd649be9bdb061"));

    return (
        <main className="presenca-lista-main-container">
            <header className="presenca-lista-header">
                <span className="presenca-lista-eyebrow">CIEPS · Controle de presença</span>
                <h1 className="presenca-lista-title">{courseData.name}</h1>
                <p className="presenca-lista-subtitle">
                    Acompanhe os inscritos, registre presenças e exporte a relação deste minicurso.
                </p>
            </header>

            <section className="presenca-lista-estatisticas" aria-label="Resumo da lista de presença">
                <div className="presenca-lista-estatistica-card">
                    <Users size={28} className="presenca-lista-stat-icon stat-blue" aria-hidden="true" />
                    <span className="presenca-lista-estatistica-valor">{data2.length}</span>
                    <span className="presenca-lista-estatistica-label">Total de Inscritos</span>
                </div>
                <div className="presenca-lista-estatistica-card">
                    <Users size={28} className="presenca-lista-stat-icon stat-yellow" aria-hidden="true" />
                    <span className="presenca-lista-estatistica-valor">{courseData.maxParticipants}</span>
                    <span className="presenca-lista-estatistica-label">Vagas</span>
                </div>
                <div className="presenca-lista-estatistica-card">
                    <CheckCircle size={28} className="presenca-lista-stat-icon stat-green" aria-hidden="true" />
                    <span className="presenca-lista-estatistica-valor">{presentes}</span>
                    <span className="presenca-lista-estatistica-label">Presentes</span>
                </div>
                <div className="presenca-lista-estatistica-card">
                    <XCircle size={28} className="presenca-lista-stat-icon stat-red" aria-hidden="true" />
                    <span className="presenca-lista-estatistica-valor">{ausentes}</span>
                    <span className="presenca-lista-estatistica-label">Ausentes</span>
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

            <section className="presenca-lista-actions" aria-label="Ações da lista">
                <QRCodeScanner courseData={courseData} hydrateData={hydrateData} usuariosCarregados={allUsers} />
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
                <ExportButton eventId={_id} guardados={guardados.size} inscritos={data} presentes={dataPresentes} todosUsuarios={data2} />
            </section>

            {errorBolean && (
                <p className="presenca-lista-inline-error" role="alert">
                    Não foi possível concluir a última atualização. Tente novamente.
                </p>
            )}
            <AvisoPendentes pendentes={pendentes} eventId={_id} enviarAgora={enviarAgora} />

            <div
                className="presenca-lista-table-container"
                role="region"
                aria-label="Congressistas e status de presença"
                tabIndex={0}
            >
                <table className="presenca-lista-table">
                    <caption className="presenca-lista-sr-only">Congressistas e status de presença no minicurso</caption>
                    <thead>
                        <tr>
                            <th scope="col">Nome</th>
                            <th scope="col">Email</th>
                            <th scope="col">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data2.map((item, index) => (
                            <tr key={item._id} className="presenca-lista-row">
                                <td className="presenca-lista-nome">
                                    {canManageAttendance && <button
                                        type="button"
                                        className="presenca-lista-remove-btn"
                                        aria-label={`Remover inscrição de ${displayUserName(item)}`}
                                        title="Remover inscrição"
                                        onClick={() => {
                                            const remover = async (semEstorno: boolean) => {
                                                setLoading(true)
                                                const response = await fetch("/api/delete/removerInscricaoMinicurso/", {
                                                    method: "DELETE",
                                                    body: JSON.stringify({
                                                        eventId: _id,
                                                        userId: item._id,
                                                        semEstorno,
                                                    }),
                                                })
                                                const result = await response.json().catch(() => null)
                                                if (!response.ok) {
                                                    alert(result?.message || "Ocorreu algum erro. Recarregue a página e tente novamente.")
                                                } else if (semEstorno) {
                                                    alert("Inscrição cancelada sem estorno. Nada foi cancelado nem estornado no Asaas.")
                                                } else if (result?.pagamentoMantido) {
                                                    alert("Inscrição retirada. Esta pessoa já tinha PAGO o minicurso: o valor NÃO foi estornado. Se for o caso, faça o estorno pelo painel do Asaas.")
                                                }
                                                await hydrateData()
                                                setLoading(false)
                                                setIsModalProps((prev) => ({ ...prev, isOpen: false }))
                                            }
                                            const pago = courseData.isFree !== true
                                            setIsModalProps(() => ({
                                                isOpen: true,
                                                onClose: () => {
                                                    setIsModalProps((prev) => ({ ...prev, isOpen: false }))
                                                },
                                                onConfirm: () => { void remover(false) },
                                                extraText: pago ? "Cancelar sem estorno" : undefined,
                                                onExtra: pago ? () => { void remover(true) } : undefined,
                                                title: "Atenção!",
                                                children: (
                                                    <>
                                                        <p className="presenca-lista-confirmation-copy">Você está prestes a retirar a inscrição do usuário do minicurso. Se houver cobrança em aberto no Asaas, ela será cancelada. Pagamento já recebido <strong className="presenca-lista-confirmation-emphasis">NÃO</strong> será estornado. Deseja mesmo continuar?</p>
                                                        {pago && (
                                                            <p className="presenca-lista-confirmation-copy"><strong className="presenca-lista-confirmation-emphasis">Cancelar sem estorno</strong>: o congressista aceitou perder o dinheiro. A inscrição sai só do site e nada é cancelado nem estornado no Asaas. Se uma cobrança em aberto for paga depois, a pessoa não volta para o minicurso.</p>
                                                        )}
                                                    </>
                                                ),
                                                confirmText: "Continuar",
                                                cancelText: "Fechar",
                                            }))
                                        }}
                                    >
                                        ×
                                    </button>}
                                    <span>{index + 1}. {displayUserName(item)}</span>
                                </td>
                                <td className="presenca-lista-email">{displayUserField(item.informacoes_usuario.email)}</td>
                                <td className="presenca-lista-status">
                                    {canManageAttendance ? (
                                        <button
                                            type="button"
                                            className={`presenca-lista-status-badge ${dataPresentes.includes(item._id) ? 'presente' : 'ausente'}`}
                                            title={dataPresentes.includes(item._id) ? "Clique para retirar a presença" : "Clique para dar presença"}
                                            onClick={async () => {
                                                setLoadingContent(true)
                                                try {
                                                    const quer = dataPresentes.includes(item._id) ? "retirar" : "dar"
                                                    const r = await registrarPresenca({ tipo: "minicurso", eventId: _id, userId: item._id, nome: item.informacoes_usuario.nome ?? "", quer })
                                                    if (r.estado === "registrado" || r.estado === "jaEstava") {
                                                        setDataPresente(prev => quer === "retirar" ? prev.filter(id => id !== item._id) : prev.includes(item._id) ? prev : [...prev, item._id])
                                                    } else {
                                                        alert(r.mensagem)
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
                                            {dataPresentes.includes(item._id) ? "PRESENTE" : "AUSENTE"}
                                        </button>
                                    ) : (
                                        <span className={`presenca-lista-status-badge ${dataPresentes.includes(item._id) ? 'presente' : 'ausente'}`}>
                                            {dataPresentes.includes(item._id) ? "PRESENTE" : "AUSENTE"}
                                        </span>
                                    )}
                                    {guardados.has(item._id) && <span className="presenca-lista-status-badge ausente">GUARDADA, AGUARDANDO ENVIO</span>}
                                </td>
                            </tr>
                        ))}
                        {data2.length === 0 && (
                            <tr>
                                <td className="presenca-lista-empty-cell" colSpan={3}>
                                    Nenhum congressista inscrito neste minicurso.
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
                    courseData={courseData}
                    isOpen={true}
                    onClose={() => { setIsOpenAllUsers(false) }}
                    onUserSelect={async (userId: string) => {
                        // mesmo modal do QR: avisos de pagamento/inscrição e os botões Inscrever / Inscrever e Dar Presença
                        setIsOpenAllUsers(false)
                        setUsuarioEscolhido(userId)
                    }}
                    usersData={allUsers}
                />
            )}
            {usuarioEscolhido && (
                <ModalUserFound courseData={courseData} hydrateData={hydrateData} qrCodeResult={usuarioEscolhido} closeModal={() => setUsuarioEscolhido(null)} usuariosCarregados={allUsers} />
            )}
        </main>
    );
};
//
//
const QRCodeScanner: React.FC<{ courseData: ICourse, hydrateData: () => Promise<void>, usuariosCarregados: AdminUserSummary[] }> = ({ courseData, hydrateData, usuariosCarregados }) => {
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
                <section className="attendance-scanner-panel" aria-labelledby="scanner-title-minicurso">
                    <div className="attendance-scanner-heading">
                        <div>
                            <span className="attendance-scanner-kicker">Leitura de credencial</span>
                            <h2 id="scanner-title-minicurso">Escanear QR Code</h2>
                        </div>
                        <button
                            type="button"
                            onClick={closeScanner}
                            className="presenca-lista-btn presenca-lista-btn-ghost"
                        >
                            Fechar Câmera
                        </button>
                    </div>
                    <label className="attendance-scanner-label" htmlFor="camera-select-minicurso">
                        Câmera
                    </label>
                    <select
                        id="camera-select-minicurso"
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
                <ModalUserFound courseData={courseData} hydrateData={hydrateData} qrCodeResult={qrCodeResult} closeModal={closeModal} usuariosCarregados={usuariosCarregados} />
            )}
        </div>
    );
};

const ModalUserFound: React.FC<{ courseData: ICourse, qrCodeResult: string, closeModal: () => void, hydrateData: () => Promise<void>, usuariosCarregados: AdminUserSummary[] }> = ({ hydrateData, courseData, qrCodeResult, closeModal, usuariosCarregados }) => {
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [user, setUser] = useState<AdminUserDetails | AdminUserSummary | null>(null)
    const [erroLeitura, setErroLeitura] = useState<string>("")
    const [semRede, setSemRede] = useState<boolean>(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    // "Inscrever" sem presença é só do admin (a rota recusa as outras contas)
    const ehAdmin = Boolean(useUser()?.user?.sub?.includes("6a8799078ecd649be9bdb061"))
    useEffect(() => {
        const fetchUser = async () => {
            const codigo = limparCodigo(qrCodeResult)
            if (!codigo) {
                sinalizar("erro")
                setErroLeitura("QR inválido: este código não é de uma credencial do CIEPS. Nada foi registrado.")
                setIsLoading(false)
                return
            }
            try {
                const userFetch = await fetch(`/api/get/usuarioPorId/${codigo}`)
                if (userFetch.status >= 500) throw new Error("servidor")
                const payload: unknown = await userFetch.json().catch(() => null)
                if (!userFetch.ok) {
                    sinalizar("erro")
                    setErroLeitura(userFetch.status === 404 ? "Credencial não encontrada: não existe cadastro com este código. Nada foi registrado." : "Não foi possível consultar esta credencial. Leia de novo.")
                    return
                }
                const normalizedUser = parseAdminUserDetailsPayload(payload)
                if (!normalizedUser) {
                    sinalizar("erro")
                    setLoadError("Dados do usuário inválidos")
                    return
                }
                setUser(normalizedUser)
            } catch {
                // sem internet: usa a lista que já está carregada nesta tela para a chamada continuar
                const local = usuariosCarregados.find((u) => `${u._id}` === codigo)
                if (local) {
                    setUser(local)
                    setSemRede(true)
                } else {
                    sinalizar("erro")
                    setErroLeitura("Sem conexão e esta credencial não está na lista carregada nesta tela. Leia de novo quando a internet voltar.")
                }
            } finally {
                setIsLoading(false)
            }
        }
        fetchUser()
    }, [qrCodeResult, usuariosCarregados])

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [closeModal]);

    /**
     * Tava sem ideia para nome de função, então coloquei esse kk
     * Mas a ideia é dar um panorama geral para o adm de que se há pendências antes de realizar a presença:
     * Exemplos:
     *  - Notificar o adm se o evento já estourou o limite máximo;
     *  - Notificar o adm se o usuário ainda não pagou sua inscrição;
     *  - Etc.;
     * Após perguntar, vamos verificar se o adm quer continuar com a inscrição.
     */
    const getFeedBack = (user: AdminUserSummary, courseData: ICourse): string[] => {
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
    const feedback = user ? getFeedBack(user, courseData) : [];

    return (
        <>
            <LoadingModal isLoading={isLoading} />
            <div className="attendance-modal-overlay" onClick={closeModal}>
                <div
                    className="attendance-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="qr-result-title-minicurso"
                    onClick={(event) => event.stopPropagation()}
                >
                    <header className="attendance-modal-header">
                        <div>
                            <span className="attendance-modal-kicker">Leitura concluída</span>
                            <h3 id="qr-result-title-minicurso">Usuário identificado</h3>
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
                                {erroLeitura && <p className="attendance-feedback attendance-feedback-warning" role="alert">{erroLeitura}</p>}
                                {semRede && <p className="attendance-feedback attendance-feedback-warning">Sem conexão: dados da lista carregada nesta tela. A presença fica guardada neste aparelho e é enviada quando a internet voltar.</p>}
                                {feedback.map((value, index) => (
                                    <p key={`${user?._id}-${index}`} className="attendance-feedback attendance-feedback-warning">{value}</p>
                                ))}
                                {loadError && (
                                    <p className="attendance-feedback attendance-feedback-warning">{loadError}</p>
                                )}
                                {user?.cadastroPendente && (
                                    <p className="attendance-feedback attendance-feedback-warning">
                                        Cadastro pendente: alguns dados pessoais ainda não foram informados.
                                    </p>
                                )}
                                {user && courseData.participants.includes(`${user._id}`) && (
                                    <p className="attendance-feedback attendance-feedback-positive">
                                        O congressista está inscrito no minicurso.
                                    </p>
                                )}
                                {user && courseData.participants.includes(`${user._id}`) &&
                                    courseData.attendanceList.includes(`${user._id}`) && (
                                        <p className="attendance-feedback attendance-feedback-positive">
                                            O congressista já possui presença no minicurso.
                                        </p>
                                    )}
                                {feedback.length === 0 && user && (
                                    <p className="attendance-feedback attendance-feedback-neutral">Nenhuma pendência encontrada.</p>
                                )}
                            </div>
                        </section>
                    </div>
                    <footer className="attendance-modal-actions">
                        {ehAdmin && user && !courseData.participants.includes(`${user._id}`) && (
                            <button
                                type="button"
                                onClick={
                                    async () => {
                                        // inscreve sem presença; o admin passa por cima de horário, vagas e pagamento (os avisos acima só informam)
                                        setIsLoading(true)
                                        const response = await fetch("/api/post/darPresenca", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ eventId: courseData._id, userId: user._id, apenasInscrever: true }),
                                        }).catch(() => null)
                                        const result = await response?.json().catch(() => null)
                                        if (response?.ok) {
                                            await hydrateData()
                                            setIsLoading(false)
                                            alert(`${displayUserName(user)}: inscrito no minicurso (sem presença).`)
                                            closeModal()
                                            return
                                        }
                                        setIsLoading(false)
                                        alert(result?.message || "Não foi possível inscrever. Confira a conexão e tente de novo.")
                                    }
                                }
                                className="presenca-lista-btn presenca-lista-btn-primary"
                            >
                                Inscrever
                            </button>
                        )}
                        {user && !courseData.attendanceList.includes(`${user._id}`) && (
                            <button
                                type="button"
                                onClick={
                                    async () => {
                                        setIsLoading(true)
                                        const r = await registrarPresenca({ tipo: "minicurso", eventId: courseData._id, userId: user._id, nome: user.informacoes_usuario?.nome ?? "", quer: "dar" })
                                        if (r.estado === "registrado" || r.estado === "jaEstava") await hydrateData()
                                        setIsLoading(false)
                                        alert(r.mensagem)
                                        if (r.estado !== "recusado" && r.estado !== "atividadeInexistente") closeModal()

                                    }
                                }
                                className="presenca-lista-btn presenca-lista-btn-success"
                            >
                                {courseData.participants.includes(`${user._id}`) ? "Dar Presença" : "Inscrever e Dar Presença"}
                            </button>
                        )}
                        {user && courseData.attendanceList.includes(`${user._id}`) && (
                            <button
                                type="button"
                                onClick={
                                    async () => {
                                        //
                                        setIsLoading(true)
                                        const r = await registrarPresenca({ tipo: "minicurso", eventId: courseData._id, userId: user._id, nome: user.informacoes_usuario?.nome ?? "", quer: "retirar" })
                                        if (r.estado === "registrado" || r.estado === "jaEstava") await hydrateData()
                                        setIsLoading(false)
                                        alert(r.mensagem)
                                        if (r.estado !== "recusado" && r.estado !== "atividadeInexistente") closeModal()

                                    }
                                }
                                className="presenca-lista-btn presenca-lista-btn-danger"
                            >
                                Retirar Presença
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
    courseData: ICourse;
    isOpen: boolean;
    onClose: () => void;
    onUserSelect: (user: string) => Promise<void>; // Função para lidar com a seleção
    usersData: AdminUserSummary[];
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
        <div className="all-users-modal-overlay">
            <div className="all-users-modal-backdrop" onClick={onClose} aria-hidden="true"></div>
            <div
                className="all-users-modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="all-users-title-minicurso"
            >
                <div className="all-users-modal-header">
                    <div>
                        <span className="all-users-modal-kicker">Inclusão manual</span>
                        <h2 id="all-users-title-minicurso" className="all-users-modal-title">Escolha um congressista</h2>
                    </div>
                    <button type="button" onClick={onClose} className="all-users-modal-close-btn" aria-label="Fechar modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="all-users-modal-search-section">
                    <label className="all-users-modal-search-title" htmlFor="all-users-search-minicurso">Pesquisar congressista</label>
                    <input
                        id="all-users-search-minicurso"
                        type="text"
                        placeholder="Filtrar por nome ou e-mail..."
                        className="all-users-modal-search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="all-users-modal-body">
                    {courseData.participants.length >= courseData.maxParticipants && (
                        <p className="all-users-modal-warning">Atenção, o evento já atingiu seu limite máximo</p>
                    )}
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
                                            {courseData.participants.includes(`${user._id}`) && (
                                                <p className="all-users-modal-badge">Já inscrito no minicurso</p>
                                            )}
                                            {user.cadastroPendente && (
                                                <p className="all-users-modal-payment-status">Cadastro pendente</p>
                                            )}
                                            <p className="all-users-modal-user-name">
                                                {user.informacoes_usuario.titulo_honorario} {displayUserName(user)}
                                            </p>
                                                <p className="all-users-modal-user-email">{displayUserField(user.informacoes_usuario.email)}</p>
                                            {user.pagamento.situacao != 1 && (
                                                <p className="all-users-modal-payment-status">
                                                    Não inscrito no congresso
                                                </p>
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

function ExportButton({ eventId, guardados, inscritos, presentes, todosUsuarios }: { eventId: string, guardados: number, inscritos: string[], presentes: string[], todosUsuarios: AdminUserSummary[] }) {
    // a tela pode estar velha (outros leitores registram ao mesmo tempo): a planilha usa a lista do servidor no momento do clique
    const montar = (presentes: string[], todosUsuarios: AdminUserSummary[]) => presentes
        // 1. FILTRA: Mantém apenas os IDs que correspondem a um usuário existente
        .map(usuarioId => todosUsuarios.find(u => u._id === usuarioId))
        .filter(usuario => usuario !== undefined) // Remove todos os 'undefined'

        // 2. MAP: Transforma os objetos de usuário encontrados no formato de planilha
        .map(usuario => ({ //
            NOME: displayUserName(usuario!),
            CPF: displayUserField(usuario!.informacoes_usuario.cpf),
            EMAIL: displayUserField(usuario!.informacoes_usuario.email),
        }));

    const handleDownload = async () => {
        let ids = presentes
        let usuarios = todosUsuarios
        try {
            const res = await fetch(`/api/get/listaDePresenca/${eventId}`)
            if (!res.ok) throw new Error("lista")
            ids = (await res.json()).data
            const faltam = ids.filter((id) => !usuarios.some((u) => u._id === id))
            if (faltam.length) {
                const info = await fetch("/api/post/informacoesVariosUsuarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(faltam) })
                if (!info.ok) throw new Error("usuarios")
                const extras = parseAdminUserListPayload(await info.json().catch(() => null))
                if (!extras) throw new Error("usuarios")
                usuarios = [...usuarios, ...extras]
            }
        } catch {
            ids = presentes
            usuarios = todosUsuarios
            alert("Não foi possível buscar a lista atual no servidor. A planilha será gerada com a lista desta tela e podem faltar presenças registradas em outros aparelhos.")
        }
        if (guardados) alert(`${guardados} presença(s) guardada(s) neste aparelho ainda não chegaram ao servidor e não estão na planilha.`)
        const data = montar(ids, usuarios)
        // 1. Crie uma nova planilha a partir dos seus dados JSON
        const worksheet = XLSX.utils.json_to_sheet(data);
        // 2. Crie um novo livro (workbook) e adicione a planilha a ele
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados'); // "Dados" é o nome da aba da planilha

        // 3. Personalize a largura das colunas (opcional)
        worksheet['!cols'] = [
            { wch: 20 }, // Coluna "nome" com 20 caracteres de largura
            { wch: 15 }, // Coluna "categoria" com 15
            { wch: 10 }, // Coluna "preco" com 10
            { wch: 10 }, // Coluna "estoque" com 10
        ];

        // 4. 

        if (worksheet['!ref']) {
            // Pega o range atual (por exemplo, "A1:C10")
            const range = XLSX.utils.decode_range(worksheet['!ref']);

            // Define o novo final da linha como o número total de dados + 1 (para o cabeçalho)
            range.e.r = data.length; // 'e.r' é o índice da última linha (base 0)

            // Codifica o novo range de volta para o formato A1:C10 e aplica à planilha
            worksheet['!ref'] = XLSX.utils.encode_range(range);
        }
        // 4. Gere o arquivo e acione o download
        XLSX.writeFile(workbook, 'MinhaPlanilha.xlsx');
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
