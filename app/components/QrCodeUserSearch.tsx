"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { Botao } from "@/app/components/ui";
import { useAvisos } from "@/app/components/Avisos";
import { LeitorQr } from "@/app/presenca/_componentes/leitor-qr";
import { limparCodigo } from "@/app/presenca/_componentes/chamada";

/** Lê a credencial e abre o cadastro da pessoa. Código que não é de credencial só avisa: a câmera continua ligada. */
export default function QrCodeUserSearch({ titleText }: { titleText: string }) {
    const router = useRouter();
    const { avisar } = useAvisos();
    const [aberto, setAberto] = useState(false);
    const [abrindo, setAbrindo] = useState(false);

    function aoLer(texto: string) {
        const id = limparCodigo(texto);
        if (!id) {
            avisar("alerta", "QR não reconhecido", "Esse código não é de uma credencial do CIEPS. A câmera continua ligada para tentar de novo.");
            return;
        }
        setAbrindo(true);
        router.push(`/usuarios/informacoes/${id}`);
    }

    return (
        <div className="w-full max-w-xl">
            {!aberto ? (
                <Botao estilo="contorno" onClick={() => setAberto(true)}>
                    <ScanLine className="size-4" aria-hidden="true" />{titleText}
                </Botao>
            ) : (
                <LeitorQr
                    titulo="Pesquisa por QR"
                    aoLer={aoLer}
                    aoFechar={() => setAberto(false)}
                    alternativa="Use a busca por nome, e-mail ou CPF da lista."
                />
            )}
            <p role="status" aria-live="polite" className="sr-only">{abrindo ? "QR identificado. Abrindo o cadastro do usuário." : ""}</p>
        </div>
    );
}
