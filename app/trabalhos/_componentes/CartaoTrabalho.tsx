"use client";

import { memo, useId, useState } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import { ChevronDown, ChevronUp, Download, File as IconeArquivo } from "lucide-react";
import { Aviso, Botao, Cartao, Selo } from "@/app/components/ui";
import { Copiavel } from "@/app/components/Copiavel";
import { formatarData, formatarDataHora } from "@/app/lib/formatar";
import { academicWorkDate } from "@/app/lib/academic-work-date";
import type { IAcademicWorks } from "@/app/lib/types/academicWorks/academicWorks.t";
import type { IUser } from "@/app/lib/types/user/user.t";
import { AutorItem } from "./AutorItem";
import { FormAvaliacao } from "./FormAvaliacao";
import { arquivoRevisado, arquivosDe, autoresDe, avaliacoesDe, formatarTamanho, lacunas, tituloDe } from "./registro";
import type { Rascunho } from "./rascunhos";
import { SITUACOES, situacaoDe } from "./situacao";

const ROTULO_TOPICO: Record<string, string> = {
  resu: "Resumo", intro: "Introdução", obj: "Objetivos", met: "Metodologia", disc: "Discussão", conc: "Conclusão", pchave: "Palavras-chave", ref: "Referências",
};

// Cabeçalhos do parecer viram parágrafo em negrito: a página só pode ter um h1 e a hierarquia fica h2 -> h3.
const htmlSeguro = (html: unknown) =>
  DOMPurify.sanitize(typeof html === "string" ? html : "")
    .replace(/<h[1-6]\b[^>]*>/gi, '<p class="font-semibold">')
    .replace(/<\/h[1-6]>/gi, "</p>");

const CLASSE_HTML = "break-words text-[15px] leading-relaxed [&_a]:text-info [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-1";

export interface PropsCartao {
  trabalho: IAcademicWorks;
  titular?: IUser;
  rascunho?: Rascunho;
  aoMudarRascunho: (id: string, patch: Partial<Rascunho> | null) => void;
  aoEnviarAvaliacao: (trabalho: IAcademicWorks, rascunho?: Rascunho) => Promise<boolean>;
  aoSalvarAutor: (id: string, index: number, emailAtual: string | null, nome: string, email: string) => Promise<boolean>;
}

/** Cartão resumido; os detalhes só são montados quando a pessoa expande (o editor é pesado). */
export const CartaoTrabalho = memo(function CartaoTrabalho({ trabalho, titular, rascunho, aoMudarRascunho, aoEnviarAvaliacao, aoSalvarAutor }: PropsCartao) {
  const [aberto, setAberto] = useState(false);
  const idTitulo = useId();
  const idDetalhes = useId();
  const id = `${trabalho._id}`;
  const situacao = SITUACOES[situacaoDe(trabalho.status)];
  const autores = autoresDe(trabalho);
  const arquivos = arquivosDe(trabalho);
  const avaliacoes = avaliacoesDe(trabalho);
  const faltas = lacunas(trabalho);
  const topicos = trabalho.topicos && typeof trabalho.topicos === "object" ? Object.entries(trabalho.topicos) : [];
  const nomeTitular = titular?.informacoes_usuario?.nome;

  return (
    <Cartao aria-labelledby={idTitulo} className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="titulo break-words text-lg leading-snug">{tituloDe(trabalho)}</h2>
          <p className="mt-0.5 text-sm text-sutil">{trabalho.modalidade || "Modalidade não informada"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>
          {faltas.length > 0 && <Selo tom="alerta">Registro incompleto</Selo>}
          {rascunho && <Selo tom="info">Rascunho de avaliação</Selo>}
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-sutil">Titular da conta (quem enviou)</dt>
          <dd>{titular && nomeTitular
            ? <Link href={`/usuarios/informacoes/${titular._id}`} className="font-medium underline underline-offset-2">{nomeTitular}</Link>
            : <span className="italic text-sutil">Usuário não encontrado</span>}</dd>
        </div>
        <div><dt className="text-xs text-sutil">Enviado em</dt><dd className="num">{formatarData(trabalho.dataSubmissao)}</dd></div>
        <div><dt className="text-xs text-sutil">Autores</dt><dd className="num">{autores.length}</dd></div>
        <div><dt className="text-xs text-sutil">Arquivos</dt><dd className="num">{arquivos.length}</dd></div>
      </dl>

      <div>
        <Botao estilo="contorno" aria-expanded={aberto} aria-controls={idDetalhes} onClick={() => setAberto((v) => !v)}>
          {aberto ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
          {aberto ? "Ocultar detalhes" : "Ver detalhes e avaliar"}
        </Botao>
      </div>

      <div id={idDetalhes} hidden={!aberto} className="grid gap-7 border-t border-linha pt-5">
        {aberto && (
          <>
            {faltas.length > 0 && <Aviso tom="alerta" titulo="Registro incompleto">Faltam no cadastro: {faltas.join(", ")}. O restante continua disponível.</Aviso>}

            <section className="grid gap-3" aria-labelledby={`${idDetalhes}-autores`}>
              <h3 id={`${idDetalhes}-autores`} className="titulo text-base">Autores ({autores.length})</h3>
              <p className="text-sm text-sutil">
                Autores são as pessoas listadas na autoria; o titular é a conta que fez a submissão. Corrigir o nome ou o e-mail de um autor
                não troca a conta do titular e vale para os próximos envios.
              </p>
              {autores.length === 0 ? <p className="text-sm italic text-sutil">Nenhum autor registrado.</p> : (
                <ul className="grid gap-2">
                  {autores.map((autor, index) => (
                    <AutorItem key={index} autor={autor} aoSalvar={(nome, email) => aoSalvarAutor(id, index, autor?.email ?? null, nome, email)} />
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-3" aria-labelledby={`${idDetalhes}-arquivos`}>
              <h3 id={`${idDetalhes}-arquivos`} className="titulo text-base">Arquivos ({arquivos.length})</h3>
              {arquivos.length === 0 ? <p className="text-sm italic text-sutil">Nenhum arquivo anexado.</p> : (
                <ul className="grid gap-2">
                  {arquivos.map((arquivo, index) => {
                    const data = academicWorkDate(arquivo?.uploadDate);
                    const revisado = arquivoRevisado(arquivo);
                    return (
                      <li key={index} className={`flex items-center gap-3 rounded-xl border p-3 ${revisado ? "border-info/40 bg-info-fundo" : "border-linha bg-cartao"}`}>
                        <IconeArquivo className="size-5 shrink-0 text-sutil" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          {revisado && <p className="mb-0.5 text-xs font-semibold text-info">Arquivo revisado{arquivo.correcaoNumero ? ` · correção ${arquivo.correcaoNumero}` : ""}</p>}
                          <p className="break-words text-sm font-medium">{arquivo.originalName || "Arquivo sem nome"}</p>
                          <p className="text-xs text-sutil">
                            <span className="num">{formatarTamanho(arquivo.size)}</span> · <time dateTime={data.iso}>{data.label}</time>
                          </p>
                        </div>
                        {arquivo.url
                          ? <a href={arquivo.url} target="_blank" rel="noopener noreferrer" aria-label={`Baixar ${arquivo.originalName || "arquivo"}`} className="grid size-11 shrink-0 place-items-center rounded-full border border-linha bg-cartao hover:border-tinta/40"><Download className="size-5" aria-hidden="true" /></a>
                          : <Selo tom="alerta">Indisponível</Selo>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <details className="rounded-xl border border-linha">
              <summary className="min-h-11 cursor-pointer px-4 py-3 text-base font-semibold">Tópicos do trabalho</summary>
              <div className="grid gap-4 border-t border-linha p-4 sm:grid-cols-2">
                {topicos.length === 0 && <p className="text-sm italic text-sutil">Nenhum tópico registrado.</p>}
                {topicos.map(([chave, valor]) => (
                  <div key={chave}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sutil">{ROTULO_TOPICO[chave] ?? chave.replace(/_/g, " ")}</p>
                    <p className="whitespace-pre-line break-words text-sm">{typeof valor === "string" && valor ? valor : "Não informado."}</p>
                  </div>
                ))}
              </div>
            </details>

            <details className="rounded-xl border border-linha">
              <summary className="min-h-11 cursor-pointer px-4 py-3 text-base font-semibold">Avaliações anteriores ({avaliacoes.length})</summary>
              <div className="grid gap-3 border-t border-linha p-4">
                {avaliacoes.length === 0 && <p className="text-sm italic text-sutil">Nenhuma avaliação registrada.</p>}
                {[...avaliacoes].reverse().map((a, index) => {
                  const s = SITUACOES[situacaoDe(a?.status)];
                  return (
                    <article key={index} className="grid gap-2 rounded-xl bg-recuo/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <time className="num text-xs text-sutil">{formatarDataHora(a?.date)}</time>
                        <Selo tom={s.tom}>{s.rotulo}</Selo>
                      </div>
                      <div className={CLASSE_HTML} dangerouslySetInnerHTML={{ __html: htmlSeguro(a?.comentario) }} />
                    </article>
                  );
                })}
              </div>
            </details>

            <section className="grid gap-4" aria-labelledby={`${idDetalhes}-avaliar`}>
              <h3 id={`${idDetalhes}-avaliar`} className="titulo text-base">Adicionar nova avaliação</h3>
              <FormAvaliacao
                trabalho={trabalho}
                rascunho={rascunho}
                aoMudar={(patch) => aoMudarRascunho(id, patch)}
                aoEnviar={() => aoEnviarAvaliacao(trabalho, rascunho)}
              />
            </section>

            <p className="text-xs text-sutil">Código do trabalho: <Copiavel texto={id} rotulo="código do trabalho" /></p>
          </>
        )}
      </div>
    </Cartao>
  );
});
