import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Auth0Provider } from "@/app/lib/auth0-client";
import { AvisosProvider } from "@/app/components/Avisos";
import { NavAdmin } from "@/app/components/NavAdmin";
import { menuDaSessao } from "@/app/lib/menu-admin-servidor";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CIEPS Admin", template: "%s · CIEPS Admin" },
  description: "Painel administrativo do CIEPS",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const menu = await menuDaSessao();

  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <Auth0Provider>
          <AvisosProvider>
            <a href="#conteudo" className="pular">Pular para o conteúdo</a>
            <div className="min-h-dvh lg:flex">
              {menu && <NavAdmin itens={menu.itens} nome={menu.nome} email={menu.email} />}
              <div id="conteudo" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
                {children}
              </div>
            </div>
          </AvisosProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
