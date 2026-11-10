"use client";

// Envio da presença (bip do QR ou botão) com fila no aparelho para quando a internet cai.
// As rotas usam $addToSet/$pull: reenviar o mesmo pedido não duplica nada.
import { CHAVE_ARMAZENAMENTO, chaveDe, destinoDoEnvio, efeitoDaResposta, enfileirar, lerFila, requisicaoDe } from "./fila-presenca";
import type { Pendente } from "./fila-presenca";

export type EstadoBip = "registrado" | "jaEstava" | "guardado" | "recusado" | "atividadeInexistente";
export interface ResultadoBip { estado: EstadoBip; mensagem: string }

/** Sem resposta em PRAZO_MS conta como rede caída: a presença vai para a fila. */
const PRAZO_MS = 12000;
export const EVENTO_FILA = "cieps-presenca-fila";

// ---------- fila no localStorage (se o navegador bloquear, fica na memória desta aba)
let filaMemoria: Pendente[] = [];
export function lerPendentes(): Pendente[] {
  try { return lerFila(localStorage.getItem(CHAVE_ARMAZENAMENTO)); } catch { return filaMemoria; }
}
function mexerNaFila(f: (atual: Pendente[]) => Pendente[]) {
  const nova = f(lerPendentes());
  filaMemoria = nova;
  try {
    if (nova.length) localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(nova));
    else localStorage.removeItem(CHAVE_ARMAZENAMENTO);
  } catch { /* fica na memória */ }
  window.dispatchEvent(new Event(EVENTO_FILA));
}

async function postar(p: Pendente): Promise<{ status: number | null; corpo: unknown }> {
  const { url, corpo } = requisicaoDe(p);
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), PRAZO_MS);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), signal: controle.signal });
    return { status: res.status, corpo: await res.json().catch(() => null) };
  } catch {
    return { status: null, corpo: null };
  } finally {
    clearTimeout(prazo);
  }
}

// ---------- retorno sonoro: agudo = registrou; dois bipes = já estava / guardado; grave = erro
let audio: AudioContext | null = null;
export function sinalizar(tipo: "ok" | "aviso" | "erro") {
  try { navigator.vibrate?.(tipo === "ok" ? 60 : tipo === "aviso" ? [60, 60, 60] : [250, 80, 250]); } catch { /* sem vibração */ }
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    const ctx = audio;
    if (ctx.state === "suspended") void ctx.resume();
    const tom = (freq: number, inicio: number, duracao: number) => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = freq;
      ganho.gain.value = 0.15;
      osc.connect(ganho).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracao);
    };
    if (tipo === "ok") tom(1320, 0, 0.12);
    else if (tipo === "aviso") { tom(880, 0, 0.09); tom(880, 0.14, 0.09); }
    else tom(220, 0, 0.45);
  } catch { /* sem áudio: o aviso na tela continua */ }
}

/**
 * Dá ou retira a presença de uma pessoa. Nunca lança erro e nunca perde o pedido em silêncio:
 * sem rede, sem resposta ou servidor fora (5xx) => guarda no aparelho e reenvia depois.
 */
export async function registrarPresenca(pedido: Omit<Pendente, "chave" | "criadoEm">): Promise<ResultadoBip> {
  const p: Pendente = { ...pedido, userId: pedido.userId.trim().toLowerCase(), criadoEm: Date.now(), chave: "" };
  p.chave = chaveDe(p);
  const turno = p.turno ? ` (${p.turno === "end" ? "fim" : "início"})` : "";
  const quem = p.nome ? `${p.nome}${turno}` : `Credencial${turno}`;
  // a ação nova substitui o que estava guardado para esta pessoa (ex.: deu presença sem rede e agora retira)
  mexerNaFila((atual) => atual.filter((x) => x.chave !== p.chave));
  const { status, corpo } = await postar(p);
  const destino = destinoDoEnvio(status);
  if (destino === "tentarDepois") {
    mexerNaFila((atual) => enfileirar(atual, p));
    sinalizar("aviso");
    return { estado: "guardado", mensagem: `${quem}: sem conexão com o servidor. ${p.quer === "dar" ? "A presença" : "A retirada"} ficou GUARDADA neste aparelho e será enviada sozinha quando a internet voltar. Não limpe os dados do navegador.` };
  }
  if (destino !== "entregue") {
    sinalizar("erro");
    const motivo = destino === "sessao"
      ? "sua sessão expirou. Entre de novo e repita."
      : (typeof (corpo as { message?: unknown })?.message === "string" ? (corpo as { message: string }).message : `o servidor recusou (código ${status}).`);
    return { estado: "recusado", mensagem: `${quem}: NÃO registrado, ${motivo}` };
  }
  const efeito = efeitoDaResposta(corpo);
  if (efeito === "atividadeInexistente") {
    sinalizar("erro");
    return { estado: "atividadeInexistente", mensagem: "Atividade não encontrada: nada foi alterado. Recarregue a página." };
  }
  if (efeito === "jaEstava") {
    sinalizar("aviso");
    return { estado: "jaEstava", mensagem: `${quem}: ${p.quer === "dar" ? "já estava com presença" : "já estava sem presença"}. Nada foi alterado.` };
  }
  sinalizar("ok");
  return { estado: "registrado", mensagem: `${quem}: ${p.quer === "dar" ? "presença registrada" : "presença retirada"}.` };
}

let enviando = false;
/** Reenvia a fila inteira (todas as atividades). Para no primeiro sinal de rede caída. */
export async function enviarPendentes(): Promise<{ entregues: Pendente[]; recusados: string[] }> {
  const entregues: Pendente[] = [];
  const recusados: string[] = [];
  if (enviando) return { entregues, recusados };
  enviando = true;
  try {
    for (const p of lerPendentes()) {
      const { status, corpo } = await postar(p);
      const destino = destinoDoEnvio(status);
      if (destino === "tentarDepois" || destino === "sessao") break;
      // só tira da fila o que foi enviado: se a pessoa foi bipada de novo enquanto isso, a ação nova fica
      mexerNaFila((atual) => atual.filter((x) => !(x.chave === p.chave && x.criadoEm === p.criadoEm)));
      if (destino === "recusado" || efeitoDaResposta(corpo) === "atividadeInexistente") {
        recusados.push(`${p.nome || p.userId}: o servidor recusou (código ${status}). Esta presença NÃO foi registrada.`);
      } else {
        entregues.push(p);
      }
    }
  } finally {
    enviando = false;
  }
  return { entregues, recusados };
}
