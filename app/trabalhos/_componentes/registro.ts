import type { IAcademicWorks } from "@/app/lib/types/academicWorks/academicWorks.t";

// Registros legados podem vir sem título, autores, anexos ou ficha: tudo aqui devolve um valor seguro.
type Trabalho = IAcademicWorks;
export type Autor = Trabalho["autores"][number];
export type Arquivo = Trabalho["arquivos"][number];
export type Ficha = Trabalho["configuracaoModalidade"]["ficha_avalicao"][number];

export const autoresDe = (t: Trabalho): Autor[] => (Array.isArray(t.autores) ? t.autores : []);
export const arquivosDe = (t: Trabalho): Arquivo[] => (Array.isArray(t.arquivos) ? t.arquivos : []);
export const avaliacoesDe = (t: Trabalho) => (Array.isArray(t.avaliadorComentarios) ? t.avaliadorComentarios : []);
export const fichasDe = (t: Trabalho): Ficha[] => (Array.isArray(t.configuracaoModalidade?.ficha_avalicao) ? t.configuracaoModalidade.ficha_avalicao : []);

export const tituloDe = (t: Trabalho) => (typeof t.titulo === "string" && t.titulo.trim() ? t.titulo : "Trabalho sem título");

// shortcut: correções antigas não têm a flag; o site gravava o objeto do upload (com progress) e sem uploadDate
export const arquivoRevisado = (arquivo: Arquivo) =>
  Boolean(arquivo.enviadoNaCorrecao || ("progress" in arquivo && !arquivo.uploadDate));

/** O que falta no cadastro, em texto. Vazio = registro completo. */
export function lacunas(t: Trabalho): string[] {
  const faltas: string[] = [];
  if (typeof t.titulo !== "string" || !t.titulo.trim()) faltas.push("título");
  if (!t.modalidade) faltas.push("modalidade");
  if (!Number.isFinite(new Date(t.dataSubmissao as unknown as string).getTime())) faltas.push("data de submissão");
  const autores = autoresDe(t);
  if (!Array.isArray(t.autores) || autores.length === 0) faltas.push("lista de autores");
  else if (autores.some((a) => !a?.nome)) faltas.push("nome de algum autor");
  if (!Array.isArray(t.arquivos)) faltas.push("lista de arquivos");
  return faltas;
}

export function formatarTamanho(bytes: unknown): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "Tamanho não informado";
  if (bytes <= 0) return "0 B";
  const unidades = ["B", "KB", "MB", "GB"];
  const i = Math.min(unidades.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidades[i]}`;
}

/** Sem acento e em minúsculas, para a busca não depender de como o nome foi digitado. */
export const normalizar = (s: unknown) =>
  (typeof s === "string" ? s : "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
