"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Camera,
    CircleHelp,
    ScanLine,
    X,
} from "lucide-react";
import {
    CameraDevice,
    Html5Qrcode,
    Html5QrcodeCameraScanConfig,
} from "html5-qrcode";
import { useRouter } from "next/navigation";
import styles from "./CiepsAdmin.module.css";

const READER_ID = "qr-code-reader";

export default function QrCodeUserSearch({ titleText }: { titleText: string }) {
    const router = useRouter();
    const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>("");
    const [qrCodeResult, setQrCodeResult] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    const openScanner = () => {
        setCameraError(null);
        setIsScannerOpen(true);
    };

    const stopScanner = useCallback(() => {
        const scanner = html5QrCodeRef.current;

        if (scanner?.isScanning) {
            scanner.stop().catch((error) => {
                console.error("Falha ao parar o scanner.", error);
            });
        }
    }, []);

    const closeScanner = useCallback(() => {
        stopScanner();
        setIsScannerOpen(false);
    }, [stopScanner]);

    useEffect(() => {
        if (!isScannerOpen) {
            return;
        }

        let isMounted = true;

        const fetchCameras = async () => {
            try {
                setCameraError(null);
                const devices = await Html5Qrcode.getCameras();

                if (!isMounted) {
                    return;
                }

                setCameras(devices ?? []);
                if (devices?.length) {
                    setSelectedCameraId((currentCameraId) => currentCameraId || devices[0].id);
                } else {
                    setCameraError("Nenhuma câmera foi encontrada neste dispositivo.");
                }
            } catch (error) {
                console.error("Erro ao buscar câmeras:", error);
                if (isMounted) {
                    setCameraError("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
                }
            }
        };

        void fetchCameras();

        return () => {
            isMounted = false;
        };
    }, [isScannerOpen]);

    useEffect(() => {
        if (!isScannerOpen || !selectedCameraId) {
            return;
        }

        const html5QrCode = new Html5Qrcode(READER_ID);
        html5QrCodeRef.current = html5QrCode;

        const qrCodeSuccessCallback = async (decodedText: string) => {
            setQrCodeResult(decodedText);
            router.push(`/usuarios/informacoes/${decodedText}`);
        };

        const config: Html5QrcodeCameraScanConfig = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
        };

        html5QrCode.start(
            selectedCameraId,
            config,
            qrCodeSuccessCallback,
            () => {
                // Falhas de leitura entre quadros são esperadas enquanto o QR não está enquadrado.
            },
        ).catch((error) => {
            console.error(`Não foi possível iniciar o scanner: ${error}`);
            setCameraError("Não foi possível iniciar a leitura. Tente selecionar outra câmera.");
        });

        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch((error) => {
                    console.error("Falha ao parar o scanner.", error);
                });
            }

            if (html5QrCodeRef.current === html5QrCode) {
                html5QrCodeRef.current = null;
            }
        };
    }, [isScannerOpen, router, selectedCameraId]);

    useEffect(() => {
        if (!isScannerOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeScanner();
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [closeScanner, isScannerOpen]);

    return (
        <div className={styles.scannerRoot}>
            {!isScannerOpen && !qrCodeResult && (
                <button
                    aria-controls={READER_ID}
                    aria-expanded={isScannerOpen}
                    className={styles.scannerLaunch}
                    onClick={openScanner}
                    type="button"
                >
                    <ScanLine aria-hidden="true" size={19} />
                    {titleText}
                </button>
            )}

            {isScannerOpen && (
                <section
                    aria-label="Leitor de QR Code"
                    className={styles.scannerPanel}
                >
                    <div className={styles.scannerHeader}>
                        <div className={styles.cameraField}>
                            <label htmlFor="camera-device">
                                <Camera aria-hidden="true" size={15} />
                                Câmera
                            </label>
                            <select
                                disabled={cameras.length === 0}
                                id="camera-device"
                                onChange={(event) => setSelectedCameraId(event.target.value)}
                                value={selectedCameraId}
                            >
                                {cameras.length === 0 && (
                                    <option value="">Buscando câmeras...</option>
                                )}
                                {cameras.map((camera) => (
                                    <option key={camera.id} value={camera.id}>
                                        {camera.label || `Câmera ${camera.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            className={styles.dangerButton}
                            onClick={closeScanner}
                            type="button"
                        >
                            <X aria-hidden="true" size={18} />
                            Fechar câmera
                        </button>
                    </div>

                    {cameraError && (
                        <p aria-live="polite" className={styles.scannerError} role="status">
                            {cameraError}
                        </p>
                    )}

                    <div className={styles.reader} id={READER_ID} />

                    <p className={styles.scannerHint}>
                        <CircleHelp aria-hidden="true" size={17} />
                        Posicione o QR Code dentro da área de leitura. A página do usuário será aberta automaticamente.
                    </p>
                </section>
            )}

            <span aria-live="polite" className={styles.visuallyHidden}>
                {qrCodeResult ? "QR Code identificado. Abrindo cadastro do usuário." : ""}
            </span>
        </div>
    );
}
