'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <Link href="/" className="logo">
            COEPS Admin
          </Link>
        </div>
        
        <nav className="header-nav">
          <Link 
            href="/trabalhos" 
            className={`nav-link ${isActive('/trabalhos') ? 'active' : ''}`}
          >
            Trabalhos
          </Link>
          <Link 
            href="/listas" 
            className={`nav-link ${isActive('/listas') ? 'active' : ''}`}
          >
            Participantes
          </Link>
          <Link 
            href="/presenca" 
            className={`nav-link ${isActive('/presenca') ? 'active' : ''}`}
          >
            Presença
          </Link>
        </nav>

        <div className="header-right">
          <div className="header-info">
            <span className="header-status">Painel Administrativo</span>
          </div>
        </div>
      </div>
    </header>
  )
} 