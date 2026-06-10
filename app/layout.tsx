import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./style.css";
import Header from "./components/Header";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CIEPS Admin - Painel Administrativo",
  description: "Painel administrativo do CIEPS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Auth0Provider>
          <Header />
          {children}
        </Auth0Provider>
      </body>
    </html>
  );
}
