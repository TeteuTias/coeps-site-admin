"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Cabecalho, Metrica, Pagina } from "@/app/components/ui";
import { CatalogoAtividades, deMinicurso, dePalestra, useCatalogo } from "@/app/components/CatalogoAtividades";

const NOTA_PALESTRA = "A lista é a mesma para todas as palestras: reúne os congressistas confirmados, não só quem assiste a esta.";

export default function Page() {
  const { cursos, palestras, estado, atualizando, recarregar } = useCatalogo({ palestras: true });
  const itens = useMemo(
    () => [...cursos.map(deMinicurso), ...palestras.map((p) => ({ ...dePalestra(p), nota: NOTA_PALESTRA }))],
    [cursos, palestras],
  );
  const ok = estado === "ok";

  return (
    <Pagina>
      <Cabecalho
        etiqueta="Relatórios"
        titulo="Listas de participantes"
        sub="Gere listas prontas para conferência ou impressão. Cada lista abre em uma nova aba."
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
        acoes={(item) => item.natureza === "minicurso"
          ? [{ rotulo: "Imprimir lista de inscritos", icone: Printer, novaAba: true, estilo: "principal", href: `/gerarListaMinicurso/${item.id}` }]
          : [{ rotulo: "Lista geral de palestras", icone: Printer, novaAba: true, estilo: "contorno", href: "/gerarListaPalestras/" }]}
      />
    </Pagina>
  );
}
