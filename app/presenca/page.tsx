"use client";

import { useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import { Cabecalho, Metrica, Pagina } from "@/app/components/ui";
import { CatalogoAtividades, deMinicurso, dePalestra, useCatalogo } from "@/app/components/CatalogoAtividades";

export default function Page() {
  const { cursos, palestras, estado, atualizando, recarregar } = useCatalogo({ palestras: true });
  const itens = useMemo(() => [...cursos.map(deMinicurso), ...palestras.map(dePalestra)], [cursos, palestras]);
  const ok = estado === "ok";

  return (
    <Pagina>
      <Cabecalho
        etiqueta="Operação"
        titulo="Controle de presença"
        sub="Abra uma atividade para registrar entradas e saídas e acompanhar os participantes."
        acento="ouro"
      >
        {ok && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Metrica rotulo="Minicursos" valor={cursos.length} />
            <Metrica rotulo="Palestras" valor={palestras.length} />
            <Metrica rotulo="Inscritos em minicursos" valor={cursos.reduce((soma, c) => soma + c.participants.length, 0)} />
          </div>
        )}
      </Cabecalho>

      <CatalogoAtividades
        itens={itens}
        estado={estado}
        atualizando={atualizando}
        aoTentar={() => void recarregar()}
        mostrarPresentes
        acoes={(item) => [{
          rotulo: "Abrir lista de presença",
          icone: ClipboardCheck,
          novaAba: true,
          estilo: "principal",
          href: item.natureza === "minicurso" ? `/presenca/gerarListaMinicursoPresenca/${item.id}` : `/presenca/gerarListaPalestraPresenca/${item.id}`,
        }]}
      />
    </Pagina>
  );
}
