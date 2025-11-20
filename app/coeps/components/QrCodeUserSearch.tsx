"use client"
import { useRef, useState, useEffect } from "react";
import { CameraDevice, Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { useRouter } from "next/navigation";
//
export default function QrCodeUserSearch({ titleText }: { titleText: string }) {
    const router = useRouter()
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
    //
    const openScanner = () => {
        setIsScannerOpen(true);
    };
    //
    const closeScanner = () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(err => {
                console.error("Falha ao parar o scanner.", err);
            });
        }
        setIsScannerOpen(false);
    };
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
            const qrCodeSuccessCallback = async (decodedText: string) => {
                setQrCodeResult(decodedText);
                router.push(`/usuarios/informacoes/${decodedText}`)

                // closeScanner(); // Fecha o scanner automaticamente após a leitura
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
    }, [isScannerOpen, selectedCameraId, router]);
    //
    return (
        <div className="w-fit">
            <div className='space-y-2 flex flex-col'>
                {!isScannerOpen && !qrCodeResult && (
                    <button
                        onClick={openScanner}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
                    >
                        {titleText}
                    </button>
                )}
            </div>
            {
                isScannerOpen &&
                <div className="w-full max-w-full mx-auto mt-4 p-6 border border-gray-200 rounded-xl shadow-lg bg-white p-2">
                    <div className="flex flex-col justify-between items-center mb-4 gap-4">
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
            }
        </div>
    )
}