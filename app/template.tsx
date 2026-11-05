// Cada troca de página remonta este bloco: o conteúdo entra com um fade curto (a barra lateral fica parada).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pag-entra">{children}</div>;
}
