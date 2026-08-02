import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "Gerenciar Atividades | CIEPS Admin",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


