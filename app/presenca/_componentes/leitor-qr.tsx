"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import type { CameraDevice } from "html5-qrcode";
import { Aviso, Botao, Campo, Escolha } from "@/app/components/ui";

/**
 * Leitor de QR único (chamadas e busca de usuário). Fica ligado entre uma leitura e outra: quem trata o texto
 * lido decide o que fazer, e uma leitura inválida não derruba a câmera. Libera a câmera ao desmontar.
 * Se a câmera falhar, oferece digitar o código da credencial.
 */
export function LeitorQr({ aoLer, aoFechar, titulo = "Leitor de QR", alternativa = "Use a busca por nome ou e-mail." }: {
  /** Recebe o texto lido; enquanto a promessa não termina, novas leituras são ignoradas. */
  aoLer: (texto: string) => void | Promise<void>;
  aoFechar: () => void;
  titulo?: string;
  alternativa?: string;
}) {
  const leitorId = `leitor-${useId().replace(/:/g, "")}`;
  const tituloId = `${leitorId}-titulo`;
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [codigo, setCodigo] = useState("");

  const aoLerRef = useRef(aoLer);
  useEffect(() => { aoLerRef.current = aoLer; });
  const lendo = useRef(false);
  const ultima = useRef<{ texto: string; ate: number } | null>(null);
  // Parar e limpar a câmera é assíncrono: a próxima câmera só começa depois da anterior liberada.
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await Html5Qrcode.getCameras();
        if (!vivo) return;
        if (!lista.length) { setErro("Nenhuma câmera foi encontrada neste aparelho."); return; }
        setCameras(lista);
        setCameraId((lista.find((c) => /back|rear|traseira|environment/i.test(c.label)) ?? lista[0]).id);
      } catch (e) {
        if (!vivo) return;
        setErro(/permission|notallowed|denied/i.test(String(e))
          ? "O acesso à câmera está bloqueado. Libere a câmera no cadeado do navegador e tente de novo."
          : "Não foi possível abrir a câmera. O navegador pode não oferecer câmera nesta página.");
      } finally {
        if (vivo) setBuscando(false);
      }
    })();
    return () => { vivo = false; };
  }, [tentativa]);

  useEffect(() => {
    if (!cameraId) return;
    let vivo = true;
    const leitor = new Html5Qrcode(leitorId, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });

    const aoDecodificar = (texto: string) => {
      const agora = Date.now();
      if (lendo.current || (ultima.current?.texto === texto && agora < ultima.current.ate)) return;
      lendo.current = true;
      ultima.current = { texto, ate: agora + 4000 };
      Promise.resolve()
        .then(() => aoLerRef.current(texto))
        .catch(() => { /* quem trata a leitura mostra o próprio erro */ })
        .finally(() => { lendo.current = false; ultima.current = { texto, ate: Date.now() + 3000 }; });
    };

    const iniciado = fila.current
      .then(() => (vivo
        ? leitor.start(
          cameraId,
          { fps: 10, qrbox: (w, h) => { const l = Math.floor(Math.min(w, h) * 0.7); return { width: l, height: l }; } },
          aoDecodificar,
          () => { /* quadros sem QR são o normal enquanto ninguém enquadra */ },
        )
        : null))
      .catch(() => { if (vivo) setErro("Não foi possível iniciar esta câmera. Escolha outra ou tente de novo."); });
    fila.current = iniciado;

    return () => {
      vivo = false;
      fila.current = iniciado.then(async () => {
        if (leitor.isScanning) await leitor.stop();
        leitor.clear();
      }).catch(() => { /* a câmera já estava parada */ });
    };
  }, [cameraId, leitorId]);

  return (
    <div role="group" aria-labelledby={tituloId} className="grid gap-3 rounded-2xl border border-linha bg-recuo/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={tituloId} className="titulo text-lg">{titulo}</h3>
        <Botao estilo="fantasma" tamanho="pequeno" onClick={aoFechar}>
          <X className="size-4" aria-hidden="true" />Fechar câmera
        </Botao>
      </div>

      {cameras.length > 1 && (
        <Escolha
          rotulo="Câmera"
          value={cameraId}
          onChange={(e) => { setErro(null); setCameraId(e.target.value); }}
        >
          {cameras.map((c) => <option key={c.id} value={c.id}>{c.label || `Câmera ${c.id}`}</option>)}
        </Escolha>
      )}

      {erro && (
        <div className="grid gap-3">
          <Aviso tom="alerta" titulo="Câmera indisponível">{erro} {alternativa}</Aviso>
          <div className="flex flex-wrap items-end gap-2">
            <Botao estilo="contorno" onClick={() => { setErro(null); setBuscando(true); setCameraId(""); setTentativa((n) => n + 1); }}>
              Tentar de novo
            </Botao>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const c = codigo.trim();
              if (!c) return;
              void aoLer(c);
              setCodigo("");
            }}
          >
            <Campo rotulo="Ou digite o código da credencial" className="min-w-0 flex-1" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" />
            <Botao type="submit" estilo="contorno" className="mb-px">Usar código</Botao>
          </form>
        </div>
      )}

      {buscando && !erro && <p role="status" className="text-sm text-sutil">Procurando câmeras…</p>}
      <div
        id={leitorId}
        className={erro ? "hidden" : "min-h-56 overflow-hidden rounded-xl bg-tinta [&_video]:w-full"}
      />
      {!erro && <p className="text-xs text-sutil">Aponte a câmera para o QR da credencial. A leitura continua ligada para a próxima pessoa.</p>}
    </div>
  );
}
