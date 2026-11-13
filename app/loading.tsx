import { Esqueleto } from "@/app/components/Estado";

// Esqueleto enquanto a rota carrega: título e três blocos, no lugar do conteúdo e sem tela cheia de "carregando".
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <span className="sr-only">Carregando…</span>
      <div className="grid gap-3">
        <Esqueleto className="h-9 w-2/3 max-w-md" />
        <Esqueleto className="h-4 w-1/2 max-w-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Esqueleto className="h-36" />
        <Esqueleto className="h-36" />
        <Esqueleto className="h-36" />
      </div>
    </div>
  );
}
