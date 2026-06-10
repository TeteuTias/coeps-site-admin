"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Settings,
  UserCheck,
  Users,
} from "lucide-react"
import "./Header.css"

export default function Header() {
  const pathname = usePathname()

  if (
    pathname.startsWith("/gerarListaMinicurso/") ||
    pathname.startsWith("/gerarListaPalestras")
  ) {
    return null
  }

  const navigationItems = [
    { href: "/", label: "Início", icon: Home },
    { href: "/usuarios", label: "Usuários", icon: Users },
    { href: "/trabalhos", label: "Trabalhos", icon: FileText },
    { href: "/listas", label: "Listas", icon: ClipboardList },
    { href: "/presenca", label: "Presença", icon: UserCheck },
    { href: "/financeiro", label: "Financeiro", icon: CreditCard },
    { href: "/gerenciarMinicursos", label: "Atividades", icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }

    return pathname.startsWith(href)
  }

  return (
    <header className="admin-header">
      <div className="header-container">
        <div className="header-brand">
          <Link href="/" className="header-logo" aria-label="CIEPS Admin">
            <span className="header-title">CIEPS Admin</span>
          </Link>
        </div>

        <nav className="header-nav" aria-label="Navegação principal">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`header-nav-item ${
                  isActive(item.href) ? "active" : ""
                }`}
              >
                <span className="header-nav-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="header-nav-text">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
