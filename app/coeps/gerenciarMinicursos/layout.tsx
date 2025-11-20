import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "Gerenciar Minicursos | COEPS Admin",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


