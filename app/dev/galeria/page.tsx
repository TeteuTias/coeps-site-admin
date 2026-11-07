import { notFound } from "next/navigation";
import { Galeria } from "./Galeria";

// Vitrine das peças do painel com dados fictícios, para conferir o visual sem tocar no banco.
// Fora do ar só na produção da Vercel; em desenvolvimento e Preview abre (continua atrás do login).
export const metadata = { title: "Galeria de componentes" };

export default function Page() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <Galeria />;
}
